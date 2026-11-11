/**
 * Client entry tests: the Web Client bundle declares the browser services the
 * Loader must provide before `apply` runs, and it settles (activates) once
 * those services exist.
 *
 * The Loader starts a Client entry's `apply` as soon as its bundle loads,
 * unless the bundle declares the services it consumes; without that
 * declaration the entry raced the boot of its siblings, read services it had
 * no claim to, and stayed inactive while the web boot failed. These tests
 * load the built bundle (what the browser loads, via `window.__ModuleLoader__`
 * require stubs), so run `bun run build` first — the same prerequisite as
 * `tools/smoke-host.mjs` on the Host half.
 * @module code-intel/test/client-entry
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context, Service } from '@deepseek-ai/cordis'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, '..', 'lib', 'client.js')

/** Browser services `apply` and its nested registration consume. */
const SERVICES = ['locale', 'remote', 'sidebarRightTabs', 'slots'] as const

/**
 * Load the built Client bundle the way the browser module loader does and
 * return its exports.
 */
function loadClientBundle(): Record<string, unknown> {  const require = createRequire(import.meta.url)
  const modules = new Map()
  const windowStub: unknown = globalThis
  const loader = {
    load({ id, factory }: { id: string; factory: (require: (spec: string) => unknown) => unknown }) {
      modules.set(id, factory((spec) => require(spec)))
    },
  }
  const savedWindow = (globalThis as { window?: unknown }).window
  const savedLoader = (globalThis as { __ModuleLoader__?: unknown }).__ModuleLoader__
  ;(globalThis as { window?: unknown }).window = windowStub
  ;(globalThis as { __ModuleLoader__?: unknown }).__ModuleLoader__ = loader
  try {
    require(bundle)
  } finally {
    ;(globalThis as { window?: unknown }).window = savedWindow
    ;(globalThis as { __ModuleLoader__?: unknown }).__ModuleLoader__ = savedLoader
  }
  const entry = modules.get('code-intel')
  assert.ok(entry !== undefined, 'the bundle registers code-intel with the module loader')
  return entry as Record<string, unknown>
}

/** The built bundle's plugin shape: `apply` plus the declared service deps. */
type ClientEntry = { apply: (ctx: Context) => Promise<() => Promise<void>>; inject: string[] }

const entry: ClientEntry | undefined = existsSync(bundle)
  ? (loadClientBundle() as unknown as ClientEntry)
  : undefined

/** Minimal stand-ins for the browser services the entry registers against. */
class FakeRemoteService extends Service {
  mounted = false

  constructor(ctx: Context) {
    super(ctx, 'remote')
  }

  /** Installs the namespace service the way api-gateway's $mount does. */
  async $mount(): Promise<() => Promise<void>> {
    this.mounted = true
    const dispose = this.ctx.provide('remote.codeIntel', { query: async () => '{}' })
    return async () => {
      this.mounted = false
      await dispose()
    }
  }
}

function browserServices() {
  return {
    locale: {
      register: () => () => {},
      bind: () => (key: string) => key,
    },
    slots: {
      inject: () => {},
      register: (registration: unknown) => registration,
    },
    sidebarRightTabs: { register: () => () => {} },
  }
}

test('the client bundle declares the browser services it consumes', { skip: !entry && 'run bun run build first' }, () => {
  assert.deepEqual([...entry!.inject].sort(), [...SERVICES].sort())
})

test('the entry stays pending — and does not apply — before its services exist', { skip: !entry && 'run bun run build first' }, async () => {
  const root = new Context()
  new FakeRemoteService(root)
  const fiber = root.registry.plugin(entry!, {})
  try {
    assert.equal(fiber.state, 0, 'the entry waits for its declared services')
    assert.ok(root.get('remote') !== undefined, 'the remote service is up, so only the others are missing')
    await fiber.await()
    assert.equal(fiber.state, 0, 'apply still has not run')
  } finally {
    await fiber.dispose()
  }
})

test('apply activates once every declared service is provided', { skip: !entry && 'run bun run build first' }, async () => {
  const root = new Context()
  const remote = new FakeRemoteService(root)
  for (const [name, service] of Object.entries(browserServices())) root.provide(name, service)
  const fiber = root.registry.plugin(entry!, {})
  try {
    await fiber.await()
    assert.equal(fiber.state, 2, 'the entry activates')
    assert.equal(remote.mounted, true, 'the remote contribution is mounted')
    assert.ok(root.get('remote.codeIntel') !== undefined, 'the remote namespace service is installed')
  } finally {
    await fiber.dispose()
  }
})

test('a rejected remote mount fails the entry instead of parking it', { skip: !entry && 'run bun run build first' }, async () => {
  const root = new Context()
  class BrokenRemote extends FakeRemoteService {
    override async $mount(): Promise<() => Promise<void>> {
      throw new Error('remote mount refused')
    }
  }
  new BrokenRemote(root)
  for (const [name, service] of Object.entries(browserServices())) root.provide(name, service)
  const fiber = root.registry.plugin(entry!, {})
  try {
    await assert.rejects(() => fiber.await(), /remote mount refused/)
  } finally {
    await fiber.dispose()
  }
})
