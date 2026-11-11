/**
 * Static import analysis for the project's module dependency graph.
 *
 * Extracts module specifiers from TypeScript/JavaScript modules with a regex
 * pass over the source (the blueprint needs speed, and the language server
 * owns full semantics), then resolves relative specifiers against the scanned
 * file set. Bare specifiers stay as external dependencies.
 * @module code-intel/graph/imports
 */
interface ImportAnalysis {
    /** Specifiers as written in the source. */
    specifiers: string[];
    /** Relative specifiers resolved to project-relative paths (when `known` had them). */
    resolved: string[];
    /** Bare specifiers (package names) and unresolved relative specifiers. */
    external: string[];
}
/** Extract all module specifiers (import, dynamic import, require, export-from). */
export declare function extractSpecifiers(source: string): string[];
/**
 * Resolve a relative specifier against the importing file and the project's
 * file set. Tries the literal path and the common index/extensions.
 */
export declare function resolveSpecifier(importerRelative: string, specifier: string, known: ReadonlySet<string>): string | null;
/** Package name of a bare specifier (`@scope/pkg/sub` → `@scope/pkg`). */
export declare function packageNameOf(specifier: string): string;
/** Analyze one file's imports against the known project file set. */
export declare function analyzeImports(source: string, importerRelative: string, known: ReadonlySet<string>): ImportAnalysis;
export {};
