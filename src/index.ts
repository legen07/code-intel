/**
 * The Host entry of the code-intel plugin.
 *
 * Mounts the {@link CodeIntelService} (registering `ctx.codeIntel` and its
 * Typert Gateway binding) and the model-facing tool set, in that order: the
 * tools close over the service and start its language server lazily on the
 * first query against the session's project directory.
 * @module code-intel
 */
import type { Context } from '@deepseek-ai/cordis'
import { CodeIntelService, type CodeIntelConfig } from './host/service.ts'
import { registerCodeIntelTools } from './host/tools.ts'

/** Cordis plugin name. */
export const name = 'code-intel'

/** Services required before the tools can be registered. */
export const inject = ['tools']

/**
 * Mount the code-intel service and tools.
 * @param ctx - plugin context carrying the tools service.
 * @param config - optional plugin configuration (rootPath override, deny list).
 */
export function apply(ctx: Context, config: CodeIntelConfig = {}): void {
  const service = new CodeIntelService(ctx, config)
  registerCodeIntelTools(ctx, service)
  ctx.effect(() => () => {
    void service.dispose()
  }, 'code-intel: stop language servers')
}

export { CodeIntelService, type CodeIntelConfig }
