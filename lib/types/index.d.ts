/**
 * The Host entry of the code-intel plugin.
 *
 * Mounts the {@link CodeIntelService} (registering `ctx.codeIntel` and its
 * Typert Gateway binding) and the model-facing tool set, in that order: the
 * tools close over the service and start its language server lazily on the
 * first query against the session's project directory.
 * @module code-intel
 */
import type { Context } from '@deepseek-ai/cordis';
import { CodeIntelService, type CodeIntelConfig } from './host/service.ts';
/** Cordis plugin name. */
export declare const name = "code-intel";
/** Services required before the tools can be registered. */
export declare const inject: string[];
/**
 * Mount the code-intel service and tools.
 * @param ctx - plugin context carrying the tools service.
 * @param config - optional plugin configuration (rootPath override, deny list).
 */
export declare function apply(ctx: Context, config?: CodeIntelConfig): void;
export { CodeIntelService, type CodeIntelConfig };
