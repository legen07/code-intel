/**
 * A Language Server Protocol client that drives one language server process.
 *
 * This is the native TypeScript port of the slice of solidlsp dedicated to
 * TypeScript/JavaScript: it spawns `typescript-language-server --stdio`,
 * performs the `initialize`/`initialized` handshake, keeps open documents in
 * sync with their on-disk content, and offers the semantic requests the
 * code-intel services need — document symbols, workspace symbols, references,
 * definition, implementation, hover — while collecting pushed diagnostics.
 * @module code-intel/lsp/client
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { type Disposable, type ProtocolLogger, LspFrameParser, encodeMessage, type JsonRpcMessage } from './protocol.ts'
import type {
  LspDiagnostic,
  LspDocumentSymbol,
  LspHover,
  LspLocation,
  LspMarkupContent,
  LspPosition,
  LspSymbolInformation,
} from '../../common/types.ts'

const require = createRequire(import.meta.url)

/** One published-diagnostics notification for a document. */
export interface DiagnosticsEvent {
  uri: string
  diagnostics: LspDiagnostic[]
}

export interface LspClientOptions {
  /** Absolute workspace root the server indexes. */
  rootPath: string
  /** Server command; defaults to the bundled typescript-language-server. */
  command?: string
  /** Server arguments; defaults to `['--stdio']`. */
  args?: string[]
  /** Environment for the server process. */
  env?: NodeJS.ProcessEnv
  /** Overrides the node executable used to spawn the server. */
  nodeExecutable?: string
  /** Round-trip request timeout (ms), default 120s — indexing is slow on big trees. */
  requestTimeoutMs?: number
  /** Logger for transport-level diagnostics. */
  logger?: ProtocolLogger
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const CONTENT_KIND = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts'])

/** Default: resolve `typescript-language-server/lib/cli.mjs` out of this package. */
export function resolveLanguageServerCommand(): { executable: string; args: string[] } {
  const cliPath = require.resolve('typescript-language-server/lib/cli.mjs')
  return { executable: process.execPath, args: [cliPath, '--stdio'] }
}

export class LspClient extends EventEmitter {
  readonly rootPath: string
  readonly rootUri: string

  private process: ChildProcessWithoutNullStreams | null = null
  private parser = new LspFrameParser()
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private documents = new Map<string, { text: string; version: number }>()
  private diagnostics = new Map<string, LspDiagnostic[]>()
  private logger: ProtocolLogger | undefined
  private requestTimeoutMs: number
  private initializeError: Error | null = null
  private shutdownRequested = false
  private readonly command: string
  private readonly args: string[]
  private readonly env: NodeJS.ProcessEnv | undefined
  private readonly nodeExecutable: string | undefined
  private capabilities: Record<string, unknown> = {}

  constructor(options: LspClientOptions) {
    super()
    this.rootPath = options.rootPath
    this.rootUri = pathToUri(options.rootPath)
    this.logger = options.logger
    this.requestTimeoutMs = options.requestTimeoutMs ?? 120_000
    this.command = options.command ?? resolveLanguageServerCommand().executable
    this.args = options.args ?? resolveLanguageServerCommand().args
    this.env = options.env
    this.nodeExecutable = options.nodeExecutable
    this.parser.on('message', (message: JsonRpcMessage) => this.handleMessage(message))
    this.parser.on('parse-error', (error: unknown) => this.logger?.warn?.(`lsp frame parse error: ${String(error)}`))
  }

  // ------------------------------------------------------------------ lifecycle

  /** Spawn the server and complete the LSP initialization handshake. */
  async start(): Promise<Record<string, unknown>> {
    if (this.process) return this.capabilities
    const executable = this.nodeExecutable ?? this.command
    this.logger?.debug?.(`spawning language server: ${executable} ${this.args.join(' ')}`)
    const child = spawn(executable, this.args, {
      cwd: this.rootPath,
      env: this.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.process = child
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => this.parser.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim()
      if (text.length > 0) this.logger?.debug?.(`language server stderr: ${text}`)
    })
    child.on('exit', (code, signal) => {
      const error = this.initializeError ?? new Error(`language server exited (code ${code}, signal ${signal})`)
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer)
        pending.reject(error)
      }
      this.pending.clear()
      // Keep the last known document/diagnostics state; the server is gone.
      this.process = null
      if (!this.shutdownRequested) this.emit('exit', code, signal)
    })

    const result = (await this.request('initialize', {
      processId: process.pid,
      clientInfo: { name: 'dsh-code-intel', version: '0.2.0' },
      locale: 'en',
      rootPath: this.rootPath,
      rootUri: this.rootUri,
      workspaceFolders: [{ name: 'workspace', uri: this.rootUri }],
      capabilities: {
        textDocument: {
          synchronization: { openClose: true, change: 1 /* full */, willSave: false, save: false },
          hover: { dynamicRegistration: false, contentFormat: ['markdown', 'plaintext'] },
          documentSymbol: { dynamicRegistration: false, hierarchicalDocumentSymbolSupport: true },
          references: { dynamicRegistration: false },
          definition: { dynamicRegistration: false },
          implementation: { dynamicRegistration: false },
          publishDiagnostics: { relatedInformation: false, versionSupport: false },
        },
        workspace: {
          symbol: { dynamicRegistration: false, resolveProvider: true },
        },
      },
    })) as { capabilities: Record<string, unknown>; serverInfo?: { name: string; version?: string } }

    this.capabilities = result.capabilities ?? {}
    this.notify('initialized', {})
    return this.capabilities
  }

  /** Ask the server to shut down, then kill the process. */
  async stop(): Promise<void> {
    const child = this.process
    if (!child) return
    this.shutdownRequested = true
    try {
      await this.request('shutdown', undefined, 5_000)
      this.notify('exit', undefined)
    } catch {
      // Server already gone or ignoring: fall through to kill.
    }
    child.kill('SIGKILL')
    this.process = null
    this.documents.clear()
    this.diagnostics.clear()
  }

  /** True while the server process is alive. */
  get running(): boolean {
    return this.process !== null && !this.process.killed
  }

  /** React to the server exiting unexpectedly; returns its disposer. */
  onExit(listener: (code: number | null, signal: NodeJS.Signals | null) => void): Disposable {
    this.on('exit', listener)
    return { dispose: () => this.off('exit', listener) }
  }

  // -------------------------------------------------------------- JSON-RPC core

  /** Send a request and await its response. */
  request(method: string, params: unknown, timeoutMs?: number): Promise<unknown> {
    const child = this.process
    if (!child) return Promise.reject(new Error('language server is not started'))
    const id = this.nextId++
    const message = encodeMessage({ jsonrpc: '2.0', id, method, params })
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`lsp request timed out after ${timeoutMs ?? this.requestTimeoutMs}ms: ${method}`))
      }, timeoutMs ?? this.requestTimeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      child.stdin.write(message)
    })
  }

  /** Send a notification. */
  notify(method: string, params: unknown): void {
    if (!this.process) return
    this.process.stdin.write(encodeMessage({ jsonrpc: '2.0', method, params }))
  }

  private handleMessage(message: JsonRpcMessage): void {
    if ('id' in message && ('result' in message || 'error' in message)) {
      const response = message
      const pending = this.pending.get(response.id)
      if (!pending) return
      clearTimeout(pending.timer)
      this.pending.delete(response.id)
      if (response.error) {
        pending.reject(new Error(`lsp error ${response.error.code}: ${response.error.message}`))
      } else {
        pending.resolve(response.result)
      }
      return
    }
    if ('method' in message) {
      const notification = message
      if (notification.method === 'textDocument/publishDiagnostics') {
        const params = notification.params as { uri: string; diagnostics: LspDiagnostic[] }
        this.diagnostics.set(params.uri, params.diagnostics ?? [])
        this.emit('diagnostics', { uri: params.uri, diagnostics: params.diagnostics ?? [] } satisfies DiagnosticsEvent)
        return
      }
      if (notification.method === 'window/logMessage' || notification.method === 'window/showMessage') {
        this.logger?.debug?.(`lsp ${notification.method}`)
        return
      }
      this.emit('notification', notification)
    }
  }

  // ------------------------------------------------------------- document sync

  /** Map of currently open document texts, keyed by URI. */
  get openDocuments(): ReadonlyMap<string, { text: string; version: number }> {
    return this.documents
  }

  /** Open a document, sending its full text to the server. */
  openTextDocument(uri: string, languageId: string, text: string, version = 1): void {
    this.documents.set(uri, { text, version })
    this.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version, text },
    })
  }

  /** Replace an open document's full content. */
  changeTextDocument(uri: string, text: string, version: number): void {
    this.documents.set(uri, { text, version })
    this.notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    })
  }

  /** Close a document. */
  closeTextDocument(uri: string): void {
    if (!this.documents.delete(uri)) return
    this.notify('textDocument/didClose', { textDocument: { uri } })
  }

  /** The last pushed diagnostics for a document (empty when none arrived). */
  getDiagnostics(uri: string): LspDiagnostic[] {
    return this.diagnostics.get(uri) ?? []
  }

  /** Every document with currently known diagnostics. */
  *allDiagnostics(): IterableIterator<{ uri: string; diagnostics: LspDiagnostic[] }> {
    for (const [uri, diagnostics] of this.diagnostics) {
      if (diagnostics.length > 0) yield { uri, diagnostics }
    }
  }

  // ----------------------------------------------------------- semantic requests

  /** Full hierarchical symbol tree of one document. */
  async documentSymbol(uri: string): Promise<LspDocumentSymbol[]> {
    const result = (await this.request('textDocument/documentSymbol', { textDocument: { uri } })) as
      | LspDocumentSymbol[]
      | LspSymbolInformation[]
      | null
    if (!result) return []
    // Servers without hierarchical support return flat SymbolInformation.
    return 'range' in result[0] ? (result as LspDocumentSymbol[]) : this.forestFromFlat(result as LspSymbolInformation[])
  }

  /** Project-wide symbol search over the workspace. */
  async workspaceSymbol(query: string): Promise<LspSymbolInformation[]> {
    const result = (await this.request('workspace/symbol', { query })) as LspSymbolInformation[] | null
    return result ?? []
  }

  /** All references to the symbol at a position. */
  async references(uri: string, position: LspPosition, includeDeclaration = true): Promise<LspLocation[]> {
    const result = (await this.request('textDocument/references', {
      textDocument: { uri },
      position,
      context: { includeDeclaration },
    })) as LspLocation[] | null
    return result ?? []
  }

  /** Definition locations for the symbol at a position. */
  async definition(uri: string, position: LspPosition): Promise<LspLocation[]> {
    const result = (await this.request('textDocument/definition', {
      textDocument: { uri },
      position,
    })) as LspLocation | LspLocation[] | null
    if (!result) return []
    return Array.isArray(result) ? result : [result]
  }

  /** Implementations of the interface or abstract class at a position. */
  async implementation(uri: string, position: LspPosition): Promise<LspLocation[]> {
    const result = (await this.request('textDocument/implementation', {
      textDocument: { uri },
      position,
    })) as LspLocation | LspLocation[] | null
    if (!result) return []
    return Array.isArray(result) ? result : [result]
  }

  /** Hover (signature/docs) for the symbol at a position. */
  async hover(uri: string, position: LspPosition): Promise<LspHover | null> {
    return (await this.request('textDocument/hover', {
      textDocument: { uri },
      position,
    })) as LspHover | null
  }

  // --------------------------------------------------------------------- helpers

  /** Rebuild a hierarchical forest from flat SymbolInformation entries. */
  private forestFromFlat(flat: LspSymbolInformation[]): LspDocumentSymbol[] {
    const byContainer = new Map<string | undefined, LspSymbolInformation[]>()
    for (const symbol of flat) {
      const list = byContainer.get(symbol.containerName) ?? []
      list.push(symbol)
      byContainer.set(symbol.containerName, list)
    }
    const toDocumentSymbol = (symbol: LspSymbolInformation): LspDocumentSymbol => {
      const children = (byContainer.get(symbol.name) ?? []).map(toDocumentSymbol)
      return {
        name: symbol.name,
        kind: symbol.kind,
        range: symbol.location.range,
        selectionRange: symbol.location.range,
        children: children.length > 0 ? children : undefined,
      }
    }
    return (byContainer.get(undefined) ?? []).map(toDocumentSymbol)
  }
}

/** Convert a filesystem path to an LSP file URI. */
export function pathToUri(path: string): string {
  return pathToFileURL(path).toString()
}

/** Convert an LSP file URI back to a filesystem path. */
export function uriToPath(uri: string): string {
  return fileURLToPath(uri)
}

/** Language id for a path, or null when the extension is not served. */
export function languageIdOf(path: string): string | null {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  switch (extension) {
    case 'ts':
    case 'mts':
    case 'cts':
      return 'typescript'
    case 'tsx':
      return 'typescriptreact'
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript'
    case 'jsx':
      return 'javascriptreact'
    default:
      return CONTENT_KIND.has(extension) ? 'typescript' : null
  }
}

/** Flatten hover contents into a single markdown/plaintext string. */
export function hoverText(hover: LspHover | null): string | null {
  if (!hover) return null
  const contents = hover.contents as LspMarkupContent | LspMarkupContent[] | string
  if (typeof contents === 'string') return contents
  if (Array.isArray(contents)) return contents.map((content) => content.value).join('\n\n')
  return contents.value
}
