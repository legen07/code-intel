import { EventEmitter } from 'node:events';
import { type Disposable, type ProtocolLogger } from './protocol.ts';
import type { LspDiagnostic, LspDocumentSymbol, LspHover, LspLocation, LspPosition, LspSymbolInformation } from '../../common/types.ts';
/** One published-diagnostics notification for a document. */
export interface DiagnosticsEvent {
    uri: string;
    diagnostics: LspDiagnostic[];
}
export interface LspClientOptions {
    /** Absolute workspace root the server indexes. */
    rootPath: string;
    /** Server command; defaults to the bundled typescript-language-server. */
    command?: string;
    /** Server arguments; defaults to `['--stdio']`. */
    args?: string[];
    /** Environment for the server process. */
    env?: NodeJS.ProcessEnv;
    /** Overrides the node executable used to spawn the server. */
    nodeExecutable?: string;
    /** Round-trip request timeout (ms), default 120s — indexing is slow on big trees. */
    requestTimeoutMs?: number;
    /** Logger for transport-level diagnostics. */
    logger?: ProtocolLogger;
}
/** Default: resolve `typescript-language-server/lib/cli.mjs` out of this package. */
export declare function resolveLanguageServerCommand(): {
    executable: string;
    args: string[];
};
export declare class LspClient extends EventEmitter {
    readonly rootPath: string;
    readonly rootUri: string;
    private process;
    private parser;
    private nextId;
    private pending;
    private documents;
    private diagnostics;
    private logger;
    private requestTimeoutMs;
    private initializeError;
    private shutdownRequested;
    private readonly command;
    private readonly args;
    private readonly env;
    private readonly nodeExecutable;
    private capabilities;
    constructor(options: LspClientOptions);
    /** Spawn the server and complete the LSP initialization handshake. */
    start(): Promise<Record<string, unknown>>;
    /** Ask the server to shut down, then kill the process. */
    stop(): Promise<void>;
    /** True while the server process is alive. */
    get running(): boolean;
    /** React to the server exiting unexpectedly; returns its disposer. */
    onExit(listener: (code: number | null, signal: NodeJS.Signals | null) => void): Disposable;
    /** Send a request and await its response. */
    request(method: string, params: unknown, timeoutMs?: number): Promise<unknown>;
    /** Send a notification. */
    notify(method: string, params: unknown): void;
    private handleMessage;
    /** Map of currently open document texts, keyed by URI. */
    get openDocuments(): ReadonlyMap<string, {
        text: string;
        version: number;
    }>;
    /** Open a document, sending its full text to the server. */
    openTextDocument(uri: string, languageId: string, text: string, version?: number): void;
    /** Replace an open document's full content. */
    changeTextDocument(uri: string, text: string, version: number): void;
    /** Close a document. */
    closeTextDocument(uri: string): void;
    /** The last pushed diagnostics for a document (empty when none arrived). */
    getDiagnostics(uri: string): LspDiagnostic[];
    /** Every document with currently known diagnostics. */
    allDiagnostics(): IterableIterator<{
        uri: string;
        diagnostics: LspDiagnostic[];
    }>;
    /** Full hierarchical symbol tree of one document. */
    documentSymbol(uri: string): Promise<LspDocumentSymbol[]>;
    /** Project-wide symbol search over the workspace. */
    workspaceSymbol(query: string): Promise<LspSymbolInformation[]>;
    /** All references to the symbol at a position. */
    references(uri: string, position: LspPosition, includeDeclaration?: boolean): Promise<LspLocation[]>;
    /** Definition locations for the symbol at a position. */
    definition(uri: string, position: LspPosition): Promise<LspLocation[]>;
    /** Implementations of the interface or abstract class at a position. */
    implementation(uri: string, position: LspPosition): Promise<LspLocation[]>;
    /** Hover (signature/docs) for the symbol at a position. */
    hover(uri: string, position: LspPosition): Promise<LspHover | null>;
    /** Rebuild a hierarchical forest from flat SymbolInformation entries. */
    private forestFromFlat;
}
/** Convert a filesystem path to an LSP file URI. */
export declare function pathToUri(path: string): string;
/** Convert an LSP file URI back to a filesystem path. */
export declare function uriToPath(uri: string): string;
/** Language id for a path, or null when the extension is not served. */
export declare function languageIdOf(path: string): string | null;
/** Flatten hover contents into a single markdown/plaintext string. */
export declare function hoverText(hover: LspHover | null): string | null;
