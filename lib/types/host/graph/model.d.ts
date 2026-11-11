/**
 * The in-memory model over a built {@link SymbolGraphData}.
 *
 * Owns symbol addressing (namePath construction, lookup by name, kind
 * filtering) and the derived queries both the model tools and the browser
 * remote consume. Mutation belongs to the indexer; this type is read-only.
 * @module code-intel/graph/model
 */
import type { CodeFile, CodeSymbol, SymbolGraphData, SymbolHit, SymbolOverviewEntry } from '../../common/types.ts';
export interface SymbolLookupOptions {
    /** Case-insensitive substring match when true (default exact/suffix). */
    substring?: boolean;
    /** Restrict to these LSP SymbolKinds. */
    includeKinds?: number[];
    /** Exclude these LSP SymbolKinds. */
    excludeKinds?: number[];
    /** Cap the number of hits; negative means unlimited. */
    maxMatches?: number;
    /** Project-relative path to limit the search to. */
    relativePath?: string;
}
export declare class SymbolGraph {
    readonly data: SymbolGraphData;
    constructor(data: SymbolGraphData);
    get rootPath(): string;
    get files(): ReadonlyMap<string, CodeFile>;
    get symbols(): ReadonlyMap<string, CodeSymbol>;
    file(fileId: string): CodeFile | undefined;
    symbol(symbolId: string): CodeSymbol | undefined;
    /** All symbols of one file in document order. */
    symbolsOfFile(fileId: string): CodeSymbol[];
    /** The first symbol whose namePath matches (exact, then suffix segments). */
    findByNamePath(namePath: string, relativePath?: string): CodeSymbol | undefined;
    /** Search symbols by name-path pattern, Serena-style. */
    lookup(namePathPattern: string, options?: SymbolLookupOptions): SymbolHit[];
    /** Hierarchical overview entries for one file, grouped at `depth`. */
    overview(fileId: string, depth?: number): SymbolOverviewEntry[];
    /** Count of symbols per kind name, for the blueprint summary. */
    countsByKind(): Record<string, number>;
}
/** Convert a stored symbol into its transport shape. */
export declare function toSymbolHit(symbol: CodeSymbol): SymbolHit;
