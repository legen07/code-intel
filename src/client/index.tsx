/**
 * The Web Client entry of the code-intel plugin.
 *
 * Mounts the code-intel remote contribution, then — once the remote and the
 * browser services are live — registers the symbol-browser tab type with the
 * right-sidebar tab registry and its body component in the keyed
 * `sidebar.right.pane.tab` slot. Unmounting withdraws the UI first, then the
 * remote, mirroring the shipped panel plugins.
 * @module code-intel/client
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ComponentType } from 'react'
import { CODE_INTEL_REMOTE, codeIntelApi, type CodeIntelApi } from './remote.ts'
import { SymbolBrowser } from './panel.tsx'

/** Registry id of the symbol-browser tab type, also its slot key. */
export const TAB_ID = '@deepseek-ai/code-intel'

/** Kind discriminator of the symbol-browser tab. */
export const TAB_KIND = 'code-intel-symbols'

/** Locale namespace for the panel's copy. */
const NS = 'codeIntel'

/** Browser services the UI registration waits for. */
const UI_INJECT = ['remote.codeIntel', 'locale', 'slots', 'sidebarRightTabs']

const ENGLISH = {
  'tab.title': 'Code-Intel',
  'guide.title': 'Code-Intel: Symbols',
  'guide.description': 'Browse the project blueprint, search symbols, and inspect references.',
}

interface SlotRegistration {
  name: string
  key: string
  locale: string
  order?: number
  inject?: () => Record<string, unknown>
}

interface ClientContext {
  effect: (callback: () => unknown, reason?: string) => () => void
  inject: (dependencies: string[], callback: (ctx: ClientContext) => void) => { dispose: () => Promise<void> }
  locale: {
    register: (namespace: string, dictionaries: Record<string, Record<string, string>>) => () => void
    bind: (namespace: string) => (key: string) => string
  }
  slots: {
    inject: (name: string, factory: () => SlotRegistration) => void
    register: (registration: SlotRegistration, component: ComponentType<Record<string, unknown>>) => SlotRegistration
  }
  sidebarRightTabs: {
    register: (definition: Record<string, unknown>) => () => void
  }
  remote: {
    $mount: (contribution: unknown) => Promise<() => Promise<void>>
    codeIntel: { query: (op: string, args?: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown> }
  }
}

/**
 * Mount the code-intel remote, then the symbol-browser UI that calls it.
 * @param ctx - browser plugin context.
 * @returns the disposer that withdraws the UI, then the remote.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const client = ctx as unknown as ClientContext
  const unmountRemote = await client.remote.$mount(CODE_INTEL_REMOTE)
  const ui = client.inject(UI_INJECT, registerUi)
  try {
    await ui
  } catch (error) {
    await ui.dispose()
    await unmountRemote()
    throw error
  }
  return async () => {
    await ui.dispose()
    await unmountRemote()
  }
}

/** Register the tab type, the tab body, and the panel's locale dictionaries. */
function registerUi(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { en: ENGLISH }), 'code-intel: dictionaries')
  const t = ctx.locale.bind(NS)
  const api = codeIntelApi((op, args, signal) => ctx.remote.codeIntel.query(op, args, signal))

  ctx.effect(
    () =>
      ctx.sidebarRightTabs.register({
        id: TAB_ID,
        kind: TAB_KIND,
        title: () => t('tab.title'),
        guide: [
          {
            id: 'symbols',
            order: 50,
            title: () => t('guide.title'),
            description: () => t('guide.description'),
          },
        ],
      }),
    'code-intel: sidebar tab',
  )

  ctx.slots.inject('sidebar.right.pane.tab', () =>
    ctx.slots.register(
      {
        name: 'sidebar.right.pane.tab',
        key: TAB_ID,
        locale: NS,
        inject: () => ({ api }),
      },
      SymbolBrowser as unknown as ComponentType<Record<string, unknown>>,
    ),
  )
}
