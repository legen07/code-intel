/**
 * Conversion of LSP document-symbol trees into graph symbol records.
 *
 * Computes namePaths from containment, and derives the declaration properties
 * (`exported`, `async`, `static`) by inspecting the declaration prefix the
 * language server's range spans — the span between `range.start` (which begins
 * at the leading modifiers) and `selectionRange.start` (the symbol name).
 * @module code-intel/graph/builder
 */
import type { CodeSymbol, LspDocumentSymbol } from '../../common/types.ts';
export interface BuiltSymbols {
    symbols: CodeSymbol[];
    /** Ids of symbols declared with an `export` modifier. */
    exportedIds: string[];
}
/** Build graph symbols for one file from its LSP document-symbol tree. */
export declare function buildFileSymbols(fileId: string, source: string, forest: LspDocumentSymbol[]): BuiltSymbols;
