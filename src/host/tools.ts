/**
 * Serena-style, fixed generic tool set exposing the code graph to the agent.
 *
 * Every tool is a read-only semantic query over the session's project: the
 * agent addresses symbols by name path (as Serena does), the graph supplies
 * locations and properties, and the language server supplies references,
 * implementations, hover, and diagnostics.
 * @module code-intel/host/tools
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CodeIntelService } from './service.ts'

const jsonRender = (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]

/**
 * Adapt a service result to its declared free-form JSON output.
 *
 * Every tool declares the author-only `{ type: 'json' }` output schema, so the
 * pipeline runs no structural validation and the rendered text carries the full
 * record; this keeps the service's exact TypeScript types intact at the seam.
 */
const asJsonOutput = (value: unknown): JsonValue => value as unknown as JsonValue

/**
 * Register the code-intel tools in the shared tool registry.
 *
 * Registered in the calling plugin's scope, so the tools are visible while the
 * plugin is enabled. Each `execute` resolves the calling agent's project
 * directory through the working-directory service before querying the graph.
 * @param ctx - plugin context carrying the tools service.
 * @param service - the code-intel host service.
 */
export function registerCodeIntelTools(ctx: Context, service: CodeIntelService): void {
  ctx.tools.register(
    defineTool({
      name: 'find_symbol',
      description:
        'Find symbols of the project by name path (e.g. `Account.deposit`, or a plain name for a suffix match). Returns matches with kind, file, and exact location. Use substring matching for partial names.',
      parameters: {
        namePathPattern: {
          type: 'string',
          required: true,
          description: 'Symbol name or dotted name path to find; matched exactly or as a suffix (`deposit` matches `Account.deposit`).',
        },
        relativePath: {
          type: 'string',
          description: 'Limit the search to this project-relative file.',
        },
        substringMatching: {
          type: 'boolean',
          description: 'Case-insensitive substring match instead of exact/suffix matching.',
        },
        includeKinds: {
          type: 'array',
          description: 'Only include these LSP symbol kinds (5 Class, 11 Interface, 12 Function, 13 Variable, 6 Method, 8 Field, ...).',
          items: { type: 'integer' },
        },
        excludeKinds: {
          type: 'array',
          description: 'Exclude these LSP symbol kinds.',
          items: { type: 'integer' },
        },
        maxMatches: {
          type: 'integer',
          description: 'Cap the number of matches; negative (default) means no cap.',
        },
      },
      output: {
        schema: { type: 'json' as const },
        render: jsonRender,
      },
      async execute(args, exec) {
        const hits = await service.searchSymbols(args.namePathPattern, {
          substring: args.substringMatching,
          includeKinds: args.includeKinds,
          excludeKinds: args.excludeKinds,
          maxMatches: args.maxMatches,
          relativePath: args.relativePath,
        }, undefined, exec.agent, exec.signal)
        return asJsonOutput({ symbols: hits })
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'find_referencing_symbols',
      description:
        'Find every reference to a symbol across the project (call sites, usages), resolved through the language server. Pass the symbol name path as shown by find_symbol or get_symbols_overview.',
      parameters: {
        namePath: {
          type: 'string',
          required: true,
          description: 'Dotted name path of the symbol, e.g. `Account.deposit`.',
        },
        relativePath: {
          type: 'string',
          description: 'Project-relative file of the symbol, to disambiguate same-named symbols.',
        },
      },
      output: {
        schema: { type: 'json' as const },
        render: jsonRender,
      },
      async execute(args, exec) {
        return asJsonOutput(await service.findReferencingSymbols(args.namePath, { relativePath: args.relativePath }, undefined, exec.agent, exec.signal))
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'find_implementations',
      description: 'Find all implementations of an interface or abstract class (language-server resolved).',
      parameters: {
        namePath: {
          type: 'string',
          required: true,
          description: 'Dotted name path of the interface or abstract class.',
        },
        relativePath: {
          type: 'string',
          description: 'Project-relative file of the symbol, to disambiguate same-named symbols.',
        },
      },
      output: {
        schema: { type: 'json' as const },
        render: jsonRender,
      },
      async execute(args, exec) {
        return asJsonOutput(await service.findImplementations(args.namePath, { relativePath: args.relativePath }, undefined, exec.agent, exec.signal))
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'get_symbols_overview',
      description:
        'Get an overview of the symbols defined in a file, grouped by kind and containment. This should be the first tool to understand a file (Serena guidance), before reading the full content.',
      parameters: {
        relativePath: {
          type: 'string',
          required: true,
          description: 'Project-relative path of the file (e.g. `src/host/service.ts`).',
        },
        depth: {
          type: 'integer',
          description: 'Depth up to which nested symbols are included; -1 (default) uses a language-specific choice.',
        },
      },
      output: {
        schema: { type: 'json' as const },
        render: jsonRender,
      },
      async execute(args, exec) {
        return asJsonOutput(await service.getSymbolsOverview(args.relativePath, args.depth, undefined, exec.agent, exec.signal))
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'get_symbol_details',
      description: 'Get every property of one symbol: kind, location, exported/async/static modifiers, container, children, signature/documentation, and optionally the declaration body.',
      parameters: {
        namePath: {
          type: 'string',
          required: true,
          description: 'Dotted name path of the symbol, e.g. `Account.deposit`.',
        },
        relativePath: {
          type: 'string',
          description: 'Project-relative file of the symbol, to disambiguate same-named symbols.',
        },
        includeBody: {
          type: 'boolean',
          description: 'Include the symbol declaration body in the result.',
        },
      },
      output: {
        schema: { type: 'json' as const },
        render: jsonRender,
      },
      async execute(args, exec) {
        return asJsonOutput(await service.getSymbolDetails(args.namePath, { relativePath: args.relativePath, includeBody: args.includeBody }, undefined, exec.agent, exec.signal))
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'get_diagnostics',
      description: 'Get language-server diagnostics (errors, warnings) for a file, or every diagnostic of the project when no file is given.',
      parameters: {
        relativePath: {
          type: 'string',
          description: 'Project-relative path of the file; omit for all files with diagnostics.',
        },
      },
      output: {
        schema: { type: 'json' as const },
        render: jsonRender,
      },
      async execute(args, exec) {
        return asJsonOutput(await service.getDiagnostics(args.relativePath, undefined, exec.agent, exec.signal))
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'get_project_blueprint',
      description:
        'Get the blueprint of the project: every module with its symbol inventory and exports, file-to-file dependency edges, external package dependencies, and derived entry points. Derived from the persisted code graph (built at startup).',
      parameters: {},
      output: {
        schema: { type: 'json' as const },
        render: jsonRender,
      },
      async execute(_args, exec) {
        return asJsonOutput(await service.getBlueprint(undefined, exec.agent, exec.signal))
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'refresh_code_index',
      description: 'Force a full re-index of the project code graph (scan files, harvest symbols, rebuild the persisted blueprint). Only needed after large outside changes; the graph refreshes itself per session.',
      parameters: {},
      output: {
        schema: { type: 'json' as const },
        render: jsonRender,
      },
      async execute(_args, exec) {
        return asJsonOutput(await service.refresh(undefined, exec.agent, exec.signal))
      },
    }),
  )
}

/** Resolve the agent of a tool execution (exported for tests). */
export function agentOf(exec: { agent?: Agent }): Agent | undefined {
  return exec.agent
}
