/**
 * The in-memory model over a built {@link SymbolGraphData}.
 *
 * Owns symbol addressing (namePath construction, lookup by name, kind
 * filtering) and the derived queries both the model tools and the browser
 * remote consume. Mutation belongs to the indexer; this type is read-only.
 * @module code-intel/graph/model
 */
import type { CodeFile, CodeSymbol, SymbolGraphData, SymbolHit, SymbolOverviewEntry } from '../../common/types.ts'

export interface SymbolLookupOptions {
  /** Case-insensitive substring match when true (default exact/suffix). */
  substring?: boolean
  /** Restrict to these LSP SymbolKinds. */
  includeKinds?: number[]
  /** Exclude these LSP SymbolKinds. */
  excludeKinds?: number[]
  /** Cap the number of hits; negative means unlimited. */
  maxMatches?: number
  /** Project-relative path to limit the search to. */
  relativePath?: string
}

export class SymbolGraph {
  readonly data: SymbolGraphData

  constructor(data: SymbolGraphData) {
    this.data = data
  }

  get rootPath(): string {
    return this.data.rootPath
  }

  get files(): ReadonlyMap<string, CodeFile> {
    return new Map(Object.entries(this.data.files))
  }

  get symbols(): ReadonlyMap<string, CodeSymbol> {
    return new Map(Object.entries(this.data.symbols))
  }

  file(fileId: string): CodeFile | undefined {
    return this.data.files[fileId]
  }

  symbol(symbolId: string): CodeSymbol | undefined {
    return this.data.symbols[symbolId]
  }

  /** All symbols of one file in document order. */
  symbolsOfFile(fileId: string): CodeSymbol[] {
    return Object.values(this.data.symbols)
      .filter((symbol) => symbol.fileId === fileId)
      .sort((a, b) => a.startLine - b.startLine || a.startColumn - b.startColumn)
  }

  /** The first symbol whose namePath matches (exact, then suffix segments). */
  findByNamePath(namePath: string, relativePath?: string): CodeSymbol | undefined {
    const candidates = Object.values(this.data.symbols).filter((symbol) => symbol.namePath === namePath)
    if (relativePath) {
      const exact = candidates.find((symbol) => symbol.fileId === relativePath)
      if (exact) return exact
    }
    if (candidates.length > 0) return candidates[0]
    // Suffix match: "Account.deposit" query may carry a longer path or vice versa.
    const segments = namePath.split('.').filter((segment) => segment.length > 0)
    for (let length = segments.length - 1; length > 0; length--) {
      const suffix = segments.slice(-length).join('.')
      const hit = Object.values(this.data.symbols).find((symbol) => symbol.namePath === suffix)
      if (hit) return hit
    }
    return undefined
  }

  /** Search symbols by name-path pattern, Serena-style. */
  lookup(namePathPattern: string, options: SymbolLookupOptions = {}): SymbolHit[] {
    const substring = options.substring ?? false
    const maxMatches = options.maxMatches ?? -1
    const hits: SymbolHit[] = []
    const pattern = substring ? namePathPattern.toLowerCase() : namePathPattern
    for (const symbol of Object.values(this.data.symbols)) {
      if (options.relativePath && symbol.fileId !== options.relativePath) continue
      if (options.includeKinds && !options.includeKinds.includes(symbol.kind)) continue
      if (options.excludeKinds && options.excludeKinds.includes(symbol.kind)) continue
      const matches = substring
        ? symbol.namePath.toLowerCase().includes(pattern)
        : symbol.namePath === pattern || symbol.namePath.endsWith('.' + pattern)
      if (!matches) continue
      hits.push(toSymbolHit(symbol))
      if (maxMatches > 0 && hits.length >= maxMatches) break
    }
    return hits
  }

  /** Hierarchical overview entries for one file, grouped at `depth`. */
  overview(fileId: string, depth = -1): SymbolOverviewEntry[] {
    const file = this.data.files[fileId]
    if (!file) return []
    const symbols = this.symbolsOfFile(fileId)
    const childrenOf = new Map<string | null, CodeSymbol[]>()
    for (const symbol of symbols) {
      const list = childrenOf.get(symbol.containerId) ?? []
      list.push(symbol)
      childrenOf.set(symbol.containerId, list)
    }
    const build = (parentId: string | null, remaining: number): SymbolOverviewEntry[] =>
      (childrenOf.get(parentId) ?? []).map((symbol) => ({
        name: symbol.name,
        kind: symbol.kind,
        kindName: symbol.kindName,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
        exported: symbol.exported,
        detail: symbol.detail,
        children: remaining !== 0 ? build(symbol.id, remaining === -1 ? -1 : remaining - 1) : [],
      }))
    const effectiveDepth = depth === -1 ? defaultDepth(file.language) : depth
    return build(null, effectiveDepth)
  }

  /** Count of symbols per kind name, for the blueprint summary. */
  countsByKind(): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const symbol of Object.values(this.data.symbols)) {
      counts[symbol.kindName] = (counts[symbol.kindName] ?? 0) + 1
    }
    return counts
  }
}

function defaultDepth(language: string): number {
  return language.startsWith('typescript') || language.startsWith('javascript') ? 1 : 0
}

/** Convert a stored symbol into its transport shape. */
export function toSymbolHit(symbol: CodeSymbol): SymbolHit {
  return {
    id: symbol.id,
    name: symbol.name,
    namePath: symbol.namePath,
    kind: symbol.kind,
    kindName: symbol.kindName,
    file: symbol.fileId,
    startLine: symbol.startLine,
    startColumn: symbol.startColumn,
    endLine: symbol.endLine,
    endColumn: symbol.endColumn,
    exported: symbol.exported,
    async: symbol.async,
    static: symbol.static,
    detail: symbol.detail,
  }
}
