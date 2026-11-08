/**
 * The Host service of the code-intel plugin.
 *
 * One service per DSH profile holds the language-server backed index for each
 * project directory the agent works in, and exposes both the typed API the
 * model tools consume and the single envelope remote method the Web Client
 * sidebar calls through the Typert gateway.
 * @module code-intel/host/service
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { LspClient, hoverText, languageIdOf, pathToUri, uriToPath } from './lsp/client.ts'
import { GraphStore } from './graph/store.ts'
import { SymbolGraph, toSymbolHit } from './graph/model.ts'
import { indexProject } from './graph/indexer.ts'
import { buildBlueprint } from './blueprint.ts'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  IndexStatus,
  LspDiagnostic,
  ProjectBlueprint,
  SymbolDiagnostics,
  SymbolDetails,
  SymbolHit,
  SymbolOverviewEntry,
} from '../common/types.ts'
import { DiagnosticSeverityName } from '../common/types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Code intelligence: symbol graph, blueprint, and semantic queries. */
    codeIntel: CodeIntelService
  }
}

interface ProjectContext {
  root: string
  lsp: LspClient
  store: GraphStore
  graph: SymbolGraph | null
  status: IndexStatus
  inflight: Promise<ProjectContext> | null
}

/** Resolve the project directory for a tool call: the session's directory, or the process's. */
async function resolveRoot(ctx: Context, agent: Agent | undefined, signal?: AbortSignal): Promise<string> {
  if (agent) {
    try {
      const workingDirectory = (ctx as Context & { workingDirectory?: { ensure: (agent: Agent, signal?: AbortSignal) => Promise<string> } }).workingDirectory
      if (workingDirectory) return await workingDirectory.ensure(agent, signal)
    } catch {
      // Fall back to the process directory when the working-directory service is unavailable.
    }
  }
  return process.cwd()
}

export interface CodeIntelConfig {
  /** Root directory override, mainly for tests. */
  rootPath?: string
  /** Extra scan deny patterns. */
  deny?: string[]
}

export class CodeIntelService extends TypertRemoteService {
  private contexts = new Map<string, ProjectContext>()
  private readonly config: CodeIntelConfig

  constructor(ctx: Context, config: CodeIntelConfig = {}) {
    super(ctx, 'codeIntel')
    this.config = config
  }

  /** Ensure the index for a project directory is started and ready. */
  async ensure(root: string, signal?: AbortSignal): Promise<ProjectContext> {
    const context = this.contexts.get(root)
    if (context && context.graph) return context
    if (context?.inflight) return context.inflight
    const fresh: ProjectContext = {
      root,
      lsp: new LspClient({ rootPath: root, logger: this.logger() }),
      store: new GraphStore(root),
      graph: null,
      status: { state: 'indexing', rootPath: root, fileCount: 0, symbolCount: 0, updatedAt: null, fromCache: false, message: null },
      inflight: null,
    }
    this.contexts.set(root, fresh)
    fresh.inflight = (async () => {
      try {
        await fresh.lsp.start()
        const outcome = await indexProject(root, fresh.lsp, fresh.store, { signal, deny: this.config.deny })
        fresh.graph = new SymbolGraph(outcome.data)
        fresh.status = {
          state: 'ready',
          rootPath: root,
          fileCount: outcome.data.files ? Object.keys(outcome.data.files).length : 0,
          symbolCount: Object.keys(outcome.data.symbols).length,
          updatedAt: outcome.data.updatedAt,
          fromCache: outcome.fromCache,
          message: null,
        }
      } catch (error) {
        fresh.status = { state: 'error', rootPath: root, fileCount: 0, symbolCount: 0, updatedAt: null, fromCache: false, message: String(error) }
        throw error
      } finally {
        fresh.inflight = null
      }
      return fresh
    })()
    return fresh.inflight
  }

  private logger() {
    const logger = this.ctx.logger('code-intel')
    return {
      debug: (message: string) => logger.debug(message),
      warn: (message: string) => logger.warn(message),
    }
  }

  /** Resolve a project context from an agent (session directory) or an explicit root. */
  private async contextFor(root: string | undefined, agent: Agent | undefined, signal?: AbortSignal): Promise<ProjectContext> {
    const resolved = root ?? this.config.rootPath ?? (await resolveRoot(this.ctx, agent, signal))
    return this.ensure(resolved, signal)
  }

  // ------------------------------------------------------------- public queries

  /** The blueprint of the project: modules, symbols, dependencies, entry points. */
  async getBlueprint(root?: string, agent?: Agent, signal?: AbortSignal): Promise<ProjectBlueprint> {
    const context = await this.contextFor(root, agent, signal)
    if (!context.graph) throw new Error('code graph is not ready')
    return buildBlueprint(context.graph.data, context.status.fromCache)
  }

  /** Index status of a project. */
  async status(root?: string, agent?: Agent): Promise<IndexStatus> {
    const resolved = root ?? this.config.rootPath ?? process.cwd()
    const context = this.contexts.get(resolved)
    if (!context) {
      return { state: 'idle', rootPath: resolved, fileCount: 0, symbolCount: 0, updatedAt: null, fromCache: false, message: null }
    }
    return context.status
  }

  /** Overview of a file's symbols (optionally depth-capped). */
  async getSymbolsOverview(relativePath: string, depth = -1, root?: string, agent?: Agent, signal?: AbortSignal): Promise<{ file: string; symbols: SymbolOverviewEntry[]; symbolCount: number }> {
    const context = await this.contextFor(root, agent, signal)
    if (!context.graph) throw new Error('code graph is not ready')
    const entries = context.graph.overview(relativePath, depth)
    return { file: relativePath, symbols: entries, symbolCount: context.graph.symbolsOfFile(relativePath).length }
  }

  /** Search the project's symbols by name-path pattern. */
  async searchSymbols(pattern: string, options: { substring?: boolean; includeKinds?: number[]; excludeKinds?: number[]; maxMatches?: number; relativePath?: string } = {}, root?: string, agent?: Agent, signal?: AbortSignal): Promise<SymbolHit[]> {
    const context = await this.contextFor(root, agent, signal)
    if (!context.graph) throw new Error('code graph is not ready')
    return context.graph.lookup(pattern, options)
  }

  /** Detailed properties of a symbol, including hover and optional body. */
  async getSymbolDetails(namePath: string, options: { relativePath?: string; includeBody?: boolean } = {}, root?: string, agent?: Agent, signal?: AbortSignal): Promise<SymbolDetails> {
    const context = await this.contextFor(root, agent, signal)
    if (!context.graph) throw new Error('code graph is not ready')
    const symbol = context.graph.findByNamePath(namePath, options.relativePath)
    if (!symbol) throw new Error(`symbol not found: ${namePath}`)
    const container = symbol.containerId ? context.graph.symbol(symbol.containerId) : null
    const children = symbol.children
      .map((id) => context.graph!.symbol(id))
      .filter((child) => child !== undefined)
      .map((child) => ({ namePath: child!.namePath, kindName: child!.kindName }))

    const uri = pathToUri(join(context.root, symbol.fileId))
    const hover = hoverText(await context.lsp.hover(uri, { line: symbol.selectionLine - 1, character: symbol.selectionColumn }).catch(() => null))
    let body: string | null = null
    if (options.includeBody) {
      body = await readSymbolBody(context.root, symbol.fileId, symbol.startLine, symbol.endLine)
    }
    return {
      symbol: toSymbolHit(symbol),
      container: container ? { namePath: container.namePath, kindName: container.kindName } : null,
      children,
      hover,
      body,
    }
  }

  /** All references to a symbol across the project. */
  async findReferencingSymbols(namePath: string, options: { relativePath?: string } = {}, root?: string, agent?: Agent, signal?: AbortSignal): Promise<Array<{ symbol: SymbolHit; references: Array<{ namePath: string; file: string; line: number; column: number; snippet: string | null }> }>> {
    const context = await this.contextFor(root, agent, signal)
    if (!context.graph) throw new Error('code graph is not ready')
    const symbols = options.relativePath
      ? context.graph.symbolsOfFile(options.relativePath).filter((symbol) => symbol.namePath === namePath)
      : context.graph.lookup(namePath)
    if (symbols.length === 0) throw new Error(`symbol not found: ${namePath}`)

    const results: Array<{ symbol: SymbolHit; references: Array<{ namePath: string; file: string; line: number; column: number; snippet: string | null }> }> = []
    for (const hit of symbols) {
      const symbol = context.graph.symbol(hit.id)
      if (!symbol) continue
      const uri = pathToUri(join(context.root, symbol.fileId))
      const locations = await context.lsp.references(uri, { line: symbol.selectionLine - 1, character: symbol.selectionColumn }, true)
      const references = await Promise.all(
        locations.map(async (location) => {
          const file = relativePathOf(context, location.uri)
          const snippet = await readLine(context.root, file, location.range.start.line + 1)
          return {
            namePath: containerNameAt(context, file, location.range.start.line) ?? '(anonymous)',
            file,
            line: location.range.start.line + 1,
            column: location.range.start.character,
            snippet,
          }
        }),
      )
      results.push({ symbol: toSymbolHit(symbol), references })
    }
    return results
  }

  /** Implementations of an interface or abstract class. */
  async findImplementations(namePath: string, options: { relativePath?: string } = {}, root?: string, agent?: Agent, signal?: AbortSignal): Promise<Array<{ symbol: SymbolHit; implementations: Array<{ namePath: string; file: string; line: number; column: number }> }>> {
    const context = await this.contextFor(root, agent, signal)
    if (!context.graph) throw new Error('code graph is not ready')
    const symbols = options.relativePath
      ? context.graph.symbolsOfFile(options.relativePath).filter((symbol) => symbol.namePath === namePath)
      : context.graph.lookup(namePath)
    if (symbols.length === 0) throw new Error(`symbol not found: ${namePath}`)

    const results: Array<{ symbol: SymbolHit; implementations: Array<{ namePath: string; file: string; line: number; column: number }> }> = []
    for (const hit of symbols) {
      const symbol = context.graph.symbol(hit.id)
      if (!symbol) continue
      const uri = pathToUri(join(context.root, symbol.fileId))
      const locations = await context.lsp.implementation(uri, { line: symbol.selectionLine - 1, character: symbol.selectionColumn })
      const implementations = locations.map((location) => ({
        namePath: containerNameAt(context, relativePathOf(context, location.uri), location.range.start.line) ?? '(anonymous)',
        file: relativePathOf(context, location.uri),
        line: location.range.start.line + 1,
        column: location.range.start.character,
      }))
      results.push({ symbol: toSymbolHit(symbol), implementations })
    }
    return results
  }

  /** Diagnostics for a file (all files of the project when omitted). */
  async getDiagnostics(relativePath?: string, root?: string, agent?: Agent, signal?: AbortSignal): Promise<SymbolDiagnostics[]> {
    const context = await this.contextFor(root, agent, signal)
    const collect = async (file: string): Promise<SymbolDiagnostics> => {
      const uri = pathToUri(join(context.root, file))
      const diagnostics = await this.collectDiagnostics(context, uri)
      return {
        file,
        diagnostics: diagnostics.map((diagnostic) => ({
          line: diagnostic.range.start.line + 1,
          column: diagnostic.range.start.character,
          endLine: diagnostic.range.end.line + 1,
          endColumn: diagnostic.range.end.character,
          severity: DiagnosticSeverityName[diagnostic.severity ?? 1] ?? 'error',
          source: diagnostic.source ?? null,
          code: diagnostic.code === undefined ? null : String(diagnostic.code),
          message: diagnostic.message,
        })),
      }
    }
    if (relativePath) return [await collect(relativePath)]
    const files = context.graph ? Object.keys(context.graph.data.files) : []
    const withDiagnostics: SymbolDiagnostics[] = []
    for (const file of files) {
      const entry = await collect(file)
      if (entry.diagnostics.length > 0) withDiagnostics.push(entry)
    }
    return withDiagnostics
  }

  /** Force a full re-index of a project. */
  async refresh(root?: string, agent?: Agent, signal?: AbortSignal): Promise<IndexStatus> {
    const resolved = root ?? this.config.rootPath ?? (await resolveRoot(this.ctx, agent, signal))
    const context = this.contexts.get(resolved)
    if (context) {
      await context.store.save(context.graph?.data ?? freshGraph(resolved)).catch(() => undefined)
      this.contexts.delete(resolved)
    }
    await this.ensure(resolved, signal)
    return this.status(resolved)
  }

  /** Stop and drop all held contexts (plugin unload). */
  async dispose(): Promise<void> {
    await Promise.all([...this.contexts.values()].map((context) => context.lsp.stop().catch(() => undefined)))
    this.contexts.clear()
  }

  // ------------------------------------------------------ client remote envelope

  /**
   * One envelope remote method for the Web Client.
   *
   * Every sidebar operation funnels through `query(op, argsJson)` with a JSON
   * string payload; the host runs the typed service method and returns a JSON
   * string result. Typed client wrappers in `src/client/remote.ts` shape it
   * back into calls and results.
   */
  async query(op: string, argsJson: string): Promise<string> {
    const args = safeParse(argsJson) as Record<string, unknown>
    switch (op) {
      case 'blueprint':
        return JSON.stringify(await this.getBlueprint(args.root as string | undefined))
      case 'status':
        return JSON.stringify(await this.status(args.root as string | undefined))
      case 'overview':
        return JSON.stringify(await this.getSymbolsOverview(args.file as string, args.depth as number | undefined))
      case 'search':
        return JSON.stringify(await this.searchSymbols(args.pattern as string, args.options as never))
      case 'details':
        return JSON.stringify(await this.getSymbolDetails(args.namePath as string, args.options as never))
      case 'references':
        return JSON.stringify(await this.findReferencingSymbols(args.namePath as string, args.options as never))
      case 'implementations':
        return JSON.stringify(await this.findImplementations(args.namePath as string, args.options as never))
      case 'diagnostics':
        return JSON.stringify(await this.getDiagnostics(args.file as string | undefined))
      case 'refresh':
        return JSON.stringify(await this.refresh())
      default:
        throw new Error(`unknown code-intel operation: ${op}`)
    }
  }

  // --------------------------------------------------------------------- helpers

  /** Collect pushed diagnostics, waiting for a fresh publication. */
  private async collectDiagnostics(context: ProjectContext, uri: string): Promise<LspDiagnostic[]> {
    const cached = context.lsp.getDiagnostics(uri)
    if (cached.length > 0) return cached
    const open = context.lsp.openDocuments.get(uri)
    if (!open) {
      // Opening triggers a publication for untouched files.
      const content = await readFile(uriToPath(uri), 'utf8').catch(() => null)
      if (content !== null) {
        const language = languageIdOf(uriToPath(uri))
        if (language) context.lsp.openTextDocument(uri, language, content)
      }
    } else {
      // A no-op full-sync change re-runs diagnostics for an already-open file.
      context.lsp.changeTextDocument(uri, open.text, open.version + 1)
    }
    return waitForDiagnostics(context.lsp, uri, 8_000)
  }
}

/**
 * Mark one method of a Service prototype as a direct Remote invocation.
 *
 * Decorator syntax is non-erasable for runtimes that strip types (Node's
 * native loader); the public `Remote` factory attaches the same prototype
 * marker without it, so both the bundler and the type-stripping loader can
 * load this module.
 * @param prototype - the Service class prototype.
 * @param method - public instance method name to expose.
 * @param exportName - exported endpoint method; defaults to the method name.
 */
function markRemote(prototype: object, method: string, exportName?: string): void {
  const context = {
    name: method,
    private: false,
    static: false,
    kind: 'method',
    addInitializer: (init: (this: object) => void) => init.call(Object.create(prototype)),
  }
  Remote(exportName ?? method)(undefined as never, context as never)
}

markRemote(CodeIntelService.prototype, 'query')

function freshGraph(rootPath: string) {
  return { version: 1, rootPath, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), language: 'typescript', files: {}, symbols: {}, errors: [] }
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value) ?? {}
  } catch {
    return {}
  }
}

function relativePathOf(context: ProjectContext, uri: string): string {
  const absolute = uriToPath(uri)
  return absolute.startsWith(context.root + '/') || absolute === context.root
    ? absolute.slice(context.root.length + 1)
    : absolute
}

/** Name of the symbol containing `line` (0-based) of a file, when indexed. */
function containerNameAt(context: ProjectContext, file: string, line: number): string | null {
  if (!context.graph) return null
  const symbols = context.graph.symbolsOfFile(file)
  let best: { namePath: string; startLine: number; endLine: number } | null = null
  for (const symbol of symbols) {
    if (symbol.startLine - 1 <= line && line <= symbol.endLine - 1) {
      if (!best || symbol.startLine > best.startLine) best = symbol
    }
  }
  return best?.namePath ?? null
}

async function readLine(root: string, file: string, line: number): Promise<string | null> {
  const content = await readFile(join(root, file), 'utf8').catch(() => null)
  if (content === null) return null
  return content.split('\n')[line - 1] ?? null
}

async function readSymbolBody(root: string, file: string, startLine: number, endLine: number): Promise<string | null> {
  const content = await readFile(join(root, file), 'utf8').catch(() => null)
  if (content === null) return null
  const lines = content.split('\n')
  return lines.slice(startLine - 1, endLine).join('\n')
}

function languageIdFromUri(uri: string): string | null {
  return languageIdOf(uriToPath(uri))
}

/** Wait for one publishDiagnostics notification for a document. */
function waitForDiagnostics(client: LspClient, uri: string, timeoutMs: number): Promise<LspDiagnostic[]> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup()
      resolve(client.getDiagnostics(uri))
    }, timeoutMs)
    const listener = (event: { uri: string; diagnostics: LspDiagnostic[] }) => {
      if (event.uri === uri) {
        cleanup()
        resolve(event.diagnostics)
      }
    }
    const cleanup = () => {
      clearTimeout(timer)
      client.off('diagnostics', listener)
    }
    client.on('diagnostics', listener)
  })
}
