/**
 * The Host service of the code-intel plugin.
 *
 * One service per DSH profile holds the language-server backed index for each
 * project directory the agent works in, and exposes both the typed API the
 * model tools consume and the single envelope remote method the Web Client
 * sidebar calls through the Typert gateway.
 * @module code-intel/host/service
 */
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { LspClient } from './lsp/client.ts';
import { GraphStore } from './graph/store.ts';
import { SymbolGraph } from './graph/model.ts';
import type { IndexStatus, ProjectBlueprint, SymbolDiagnostics, SymbolDetails, SymbolHit, SymbolOverviewEntry } from '../common/types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Code intelligence: symbol graph, blueprint, and semantic queries. */
        codeIntel: CodeIntelService;
    }
}
interface ProjectContext {
    root: string;
    lsp: LspClient;
    store: GraphStore;
    graph: SymbolGraph | null;
    status: IndexStatus;
    inflight: Promise<ProjectContext> | null;
}
export interface CodeIntelConfig {
    /** Root directory override, mainly for tests. */
    rootPath?: string;
    /** Extra scan deny patterns. */
    deny?: string[];
}
export declare class CodeIntelService extends TypertRemoteService {
    private contexts;
    private readonly config;
    constructor(ctx: Context, config?: CodeIntelConfig);
    /** Ensure the index for a project directory is started and ready. */
    ensure(root: string, signal?: AbortSignal): Promise<ProjectContext>;
    private logger;
    /** Resolve a project context from an agent (session directory) or an explicit root. */
    private contextFor;
    /** The blueprint of the project: modules, symbols, dependencies, entry points. */
    getBlueprint(root?: string, agent?: Agent, signal?: AbortSignal): Promise<ProjectBlueprint>;
    /** Index status of a project. */
    status(root?: string, agent?: Agent): Promise<IndexStatus>;
    /** Overview of a file's symbols (optionally depth-capped). */
    getSymbolsOverview(relativePath: string, depth?: number, root?: string, agent?: Agent, signal?: AbortSignal): Promise<{
        file: string;
        symbols: SymbolOverviewEntry[];
        symbolCount: number;
    }>;
    /** Search the project's symbols by name-path pattern. */
    searchSymbols(pattern: string, options?: {
        substring?: boolean;
        includeKinds?: number[];
        excludeKinds?: number[];
        maxMatches?: number;
        relativePath?: string;
    }, root?: string, agent?: Agent, signal?: AbortSignal): Promise<SymbolHit[]>;
    /** Detailed properties of a symbol, including hover and optional body. */
    getSymbolDetails(namePath: string, options?: {
        relativePath?: string;
        includeBody?: boolean;
    }, root?: string, agent?: Agent, signal?: AbortSignal): Promise<SymbolDetails>;
    /** All references to a symbol across the project. */
    findReferencingSymbols(namePath: string, options?: {
        relativePath?: string;
    }, root?: string, agent?: Agent, signal?: AbortSignal): Promise<Array<{
        symbol: SymbolHit;
        references: Array<{
            namePath: string;
            file: string;
            line: number;
            column: number;
            snippet: string | null;
        }>;
    }>>;
    /** Implementations of an interface or abstract class. */
    findImplementations(namePath: string, options?: {
        relativePath?: string;
    }, root?: string, agent?: Agent, signal?: AbortSignal): Promise<Array<{
        symbol: SymbolHit;
        implementations: Array<{
            namePath: string;
            file: string;
            line: number;
            column: number;
        }>;
    }>>;
    /** Diagnostics for a file (all files of the project when omitted). */
    getDiagnostics(relativePath?: string, root?: string, agent?: Agent, signal?: AbortSignal): Promise<SymbolDiagnostics[]>;
    /** Force a full re-index of a project. */
    refresh(root?: string, agent?: Agent, signal?: AbortSignal): Promise<IndexStatus>;
    /** Stop and drop all held contexts (plugin unload). */
    dispose(): Promise<void>;
    /**
     * One envelope remote method for the Web Client.
     *
     * Every sidebar operation funnels through `query(op, argsJson)` with a JSON
     * string payload; the host runs the typed service method and returns a JSON
     * string result. Typed client wrappers in `src/client/remote.ts` shape it
     * back into calls and results.
     */
    query(op: string, argsJson: string): Promise<string>;
    /** Collect pushed diagnostics, waiting for a fresh publication. */
    private collectDiagnostics;
}
export {};
