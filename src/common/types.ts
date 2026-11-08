/**
 * Shared types between the Host plugin, the persisted graph, the model-facing
 * tools, and the Web Client remote.
 *
 * The LSP subset mirrors the Language Server Protocol structures this plugin
 * consumes (a native TypeScript port of what solidlsp carries for the
 * TypeScript/JavaScript backend, kept to the messages we actually exchange).
 * @module code-intel/common
 */

// ---------------------------------------------------------------------------
// LSP protocol subset
// ---------------------------------------------------------------------------

export interface LspPosition {
  line: number
  character: number
}

export interface LspRange {
  start: LspPosition
  end: LspPosition
}

export interface LspLocation {
  uri: string
  range: LspRange
}

export interface LspDocumentSymbol {
  name: string
  detail?: string
  kind: number
  tags?: number[]
  range: LspRange
  selectionRange: LspRange
  children?: LspDocumentSymbol[]
}

export interface LspSymbolInformation {
  name: string
  kind: number
  tags?: number[]
  containerName?: string
  location: LspLocation
}

export interface LspDiagnostic {
  range: LspRange
  severity?: number
  code?: number | string
  source?: string
  message: string
}

export interface LspHover {
  contents: LspMarkupContent | LspMarkupContent[] | string
  range?: LspRange
}

export interface LspMarkupContent {
  kind: 'markdown' | 'plaintext'
  value: string
}

// ---------------------------------------------------------------------------
// Symbol kinds (LSP SymbolKind, named for tool output and the UI)
// ---------------------------------------------------------------------------

export const SymbolKindName: Record<number, string> = {
  1: 'File',
  2: 'Module',
  3: 'Namespace',
  4: 'Package',
  5: 'Class',
  6: 'Method',
  7: 'Property',
  8: 'Field',
  9: 'Constructor',
  10: 'Enum',
  11: 'Interface',
  12: 'Function',
  13: 'Variable',
  14: 'Constant',
  15: 'String',
  16: 'Number',
  17: 'Boolean',
  18: 'Array',
  19: 'Object',
  20: 'Key',
  21: 'Null',
  22: 'EnumMember',
  23: 'Struct',
  24: 'Event',
  25: 'Operator',
  26: 'TypeParameter',
}

export function symbolKindName(kind: number): string {
  return SymbolKindName[kind] ?? 'Other'
}

// ---------------------------------------------------------------------------
// Code graph (the persisted blueprint + symbol index)
// ---------------------------------------------------------------------------

/**
 * One discovered symbol of a script or project.
 *
 * `namePath` is the dotted containment path from the file root
 * (`Account.deposit`), matching how Serena addresses symbols; `id` is the
 * stable graph identity, and `location` is 1-based for tool output.
 */
export interface CodeSymbol {
  /** Stable identity: `<fileId>#<namePath>` (a numeric suffix disambiguates duplicates). */
  id: string
  /** Simple name of the symbol. */
  name: string
  /** Dotted containment path, e.g. `Account.deposit`. */
  namePath: string
  /** LSP SymbolKind number. */
  kind: number
  /** Human-readable kind, e.g. `Method`. */
  kindName: string
  /** File id this symbol lives in. */
  fileId: string
  /** Container symbol id, or null at file top level. */
  containerId: string | null
  /** Child symbol ids. */
  children: string[]
  /** 1-based start line. */
  startLine: number
  /** 0-based start column. */
  startColumn: number
  /** 1-based end line. */
  endLine: number
  /** 0-based end column. */
  endColumn: number
  /** 1-based line of the symbol's selection (the name). */
  selectionLine: number
  /** 0-based column of the symbol's selection (the name). */
  selectionColumn: number
  /** Whether the declaration carries an `export` modifier. */
  exported: boolean
  /** Whether the declaration is `async`. */
  async: boolean
  /** Whether the declaration is `static`. */
  static: boolean
  /** LSP detail string when the server offered one (signatures, types). */
  detail: string | null
}

/** One indexed source file of the project. */
export interface CodeFile {
  /** Identity: project-relative POSIX path. */
  id: string
  /** Project-relative POSIX path (same as id, kept for readable payloads). */
  path: string
  /** Language id sent to the language server. */
  language: string
  /** Count of symbols in the file at index time. */
  symbolCount: number
  /** Ids of project files this file imports. */
  imports: string[]
  /** Outside specifiers this file imports (npm packages and unresolved). */
  externalImports: string[]
  /** Ids of symbols declared `export` in this file. */
  exportedSymbols: string[]
  /** Last known byte size of the file at index time. */
  size: number
}

/** Serialized shape of the whole-project code graph (the blueprint's backing store). */
export interface SymbolGraphData {
  /** Schema version of the serialized graph. */
  version: number
  /** Absolute project root the graph was built from. */
  rootPath: string
  /** ISO timestamp of the first build. */
  createdAt: string
  /** ISO timestamp of the last refresh. */
  updatedAt: string
  /** Language backend used to build the graph. */
  language: string
  files: Record<string, CodeFile>
  symbols: Record<string, CodeSymbol>
  /** Non-fatal indexing problems, e.g. files that failed symbol retrieval. */
  errors: string[]
}

// ---------------------------------------------------------------------------
// Project blueprint (the compact answer to "what is this project?")
// ---------------------------------------------------------------------------

/** One module of the blueprint with its symbol inventory. */
export interface BlueprintModule {
  path: string
  language: string
  symbolCount: number
  exportedSymbols: string[]
  /** Project-relative paths imported from this module. */
  imports: string[]
  externalImports: string[]
}

/** External package dependency aggregated over the project. */
export interface BlueprintExternalDep {
  name: string
  /** Number of modules importing it. */
  importedBy: number
}

/** The persisted project blueprint: modules, symbol inventory, and dependencies. */
export interface ProjectBlueprint {
  rootPath: string
  language: string
  fileCount: number
  symbolCount: number
  countsByKind: Record<string, number>
  exportedSymbolCount: number
  modules: BlueprintModule[]
  /** File→file dependency edges of the project. */
  dependencies: Array<{ from: string; to: string }>
  /** Aggregated external (npm-style) dependencies. */
  externalDependencies: BlueprintExternalDep[]
  /** Modules nothing else in the project imports (candidate entry points). */
  entryPoints: string[]
  errors: string[]
  /** ISO timestamp of the blueprint. */
  generatedAt: string
  /** Whether the graph was served from cache without a refresh. */
  fromCache: boolean
}

/** Diagnostic severity names for tool output and the UI. */
export const DiagnosticSeverityName: Record<number, string> = {
  1: 'error',
  2: 'warning',
  3: 'information',
  4: 'hint',
}

/** One diagnostic attached to a file, with 1-based line numbers. */
export interface SymbolDiagnostics {
  file: string
  diagnostics: Array<{
    line: number
    column: number
    endLine: number
    endColumn: number
    severity: string
    source: string | null
    code: string | null
    message: string
  }>
}

// ---------------------------------------------------------------------------
// Tool- and remote-facing operation results
// ---------------------------------------------------------------------------

/** A discovered symbol in tool output, with its addressable location. */
export interface SymbolHit {
  id: string
  name: string
  namePath: string
  kind: number
  kindName: string
  file: string
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  exported: boolean
  async: boolean
  static: boolean
  detail: string | null
}

/** Symbol overview entry; nested for `get_symbols_overview`. */
export interface SymbolOverviewEntry {
  name: string
  kind: number
  kindName: string
  startLine: number
  endLine: number
  exported: boolean
  detail: string | null
  children: SymbolOverviewEntry[]
}

/** Detailed properties of one symbol for `get_symbol_details`. */
export interface SymbolDetails {
  symbol: SymbolHit
  container: { namePath: string; kindName: string } | null
  children: Array<{ namePath: string; kindName: string }>
  /** Signature/documentation from the language server, when available. */
  hover: string | null
  /** The symbol's declaration body, when requested. */
  body: string | null
}

/** Index status reported to the model and the UI. */
export interface IndexStatus {
  state: 'idle' | 'indexing' | 'ready' | 'error'
  rootPath: string
  fileCount: number
  symbolCount: number
  updatedAt: string | null
  fromCache: boolean
  /** Populated when state is `error`. */
  message: string | null
}
