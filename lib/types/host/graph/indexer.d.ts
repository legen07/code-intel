import { type ScanOptions } from './scan.ts';
import { GraphStore } from './store.ts';
import { LspClient } from '../lsp/client.ts';
import type { SymbolGraphData } from '../../common/types.ts';
export interface IndexOptions extends ScanOptions {
    /** Signal for cooperative cancellation. */
    signal?: AbortSignal;
    /** Load the cached graph instead of re-indexing when it is still fresh. */
    allowCache?: boolean;
    /** Maximum graph age (ms) for a cached load to be honored. */
    cacheMaxAgeMs?: number;
}
export interface IndexOutcome {
    data: SymbolGraphData;
    /** True when a cached graph was served without touching the language server. */
    fromCache: boolean;
    /** Files whose symbols could not be harvested. */
    failed: string[];
}
/**
 * Whether the source file has changed since the cached graph indexed it.
 * Files absent from the snapshot need a refresh; size and content compare
 * against the cached fields otherwise.
 */
export declare function needsRefresh(cached: SymbolGraphData, relativePath: string, size: number): boolean;
/** Build (or refresh) the code graph of `root` through `client`. */
export declare function indexProject(root: string, client: LspClient, store: GraphStore, options?: IndexOptions): Promise<IndexOutcome>;
