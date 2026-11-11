import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { CodeIntelService } from './service.ts';
/**
 * Register the code-intel tools in the shared tool registry.
 *
 * Registered in the calling plugin's scope, so the tools are visible while the
 * plugin is enabled. Each `execute` resolves the calling agent's project
 * directory through the working-directory service before querying the graph.
 * @param ctx - plugin context carrying the tools service.
 * @param service - the code-intel host service.
 */
export declare function registerCodeIntelTools(ctx: Context, service: CodeIntelService): void;
/** Resolve the agent of a tool execution (exported for tests). */
export declare function agentOf(exec: {
    agent?: Agent;
}): Agent | undefined;
