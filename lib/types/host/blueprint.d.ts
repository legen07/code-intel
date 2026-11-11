/**
 * Assembly of the project blueprint — the compact answer to "what is this
 * project?" — from a built code graph.
 *
 * The blueprint carries the module inventory, the file↔file dependency edges,
 * aggregated external dependencies, and the derived entry points (modules
 * nothing else in the project imports).
 * @module code-intel/blueprint
 */
import type { ProjectBlueprint, SymbolGraphData } from '../common/types.ts';
/** Derive the project blueprint from a built graph. */
export declare function buildBlueprint(data: SymbolGraphData, fromCache: boolean): ProjectBlueprint;
