import type { SymbolGraphData } from '../../common/types.ts';
export declare const GRAPH_SCHEMA_VERSION = 1;
export interface StoreOptions {
    /** Cache root; defaults to `$DSH_CODE_INTEL_CACHE` or `~/.dsh/code-intel/caches`. */
    cacheDir?: string;
}
export declare class GraphStore {
    readonly cachePath: string;
    constructor(rootPath: string, options?: StoreOptions);
    /** Persist a graph atomically. */
    save(data: SymbolGraphData): Promise<void>;
    /** Load the cached graph, or null when absent or schema-incompatible. */
    load(): Promise<SymbolGraphData | null>;
    /** Whether the snapshot exists and is at least this fresh (default: 24h). */
    isFresh(maxAgeMs?: number): Promise<boolean>;
}
