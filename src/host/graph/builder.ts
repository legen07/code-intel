/**
 * Conversion of LSP document-symbol trees into graph symbol records.
 *
 * Computes namePaths from containment, and derives the declaration properties
 * (`exported`, `async`, `static`) by inspecting the declaration prefix the
 * language server's range spans — the span between `range.start` (which begins
 * at the leading modifiers) and `selectionRange.start` (the symbol name).
 * @module code-intel/graph/builder
 */
import type { CodeSymbol, LspDocumentSymbol } from '../../common/types.ts'
import { symbolKindName } from '../../common/types.ts'

export interface BuiltSymbols {
  symbols: CodeSymbol[]
  /** Ids of symbols declared with an `export` modifier. */
  exportedIds: string[]
}

/** Build graph symbols for one file from its LSP document-symbol tree. */
export function buildFileSymbols(fileId: string, source: string, forest: LspDocumentSymbol[]): BuiltSymbols {
  const state: BuiltSymbols = { symbols: [], exportedIds: [] }
  const lines = source.split('\n')
  walkAssign(forest, null, '', new Set<string>(), fileId, lines, state)
  return state
}

function walkAssign(
  symbols: LspDocumentSymbol[],
  containerId: string | null,
  parentPath: string,
  siblingNames: Set<string>,
  fileId: string,
  lines: string[],
  state: BuiltSymbols,
): string[] {
  const ids: string[] = []
  for (const symbol of symbols) {
    const namePath = parentPath.length > 0 ? `${parentPath}.${symbol.name}` : symbol.name
    let id = `${fileId}#${namePath}`
    if (siblingNames.has(namePath)) {
      let counter = 2
      while (siblingNames.has(`${namePath}#${counter}`)) counter++
      id = `${fileId}#${namePath}#${counter}`
    }
    siblingNames.add(namePath)
    ids.push(id)

    const declaration = declarationPrefix(lines, symbol)
    const children = symbol.children ?? []
    // Children are walked first into their own sibling set; their ids come
    // back here, so parent links and child ids can never disagree.
    const childIds = walkAssign(children, id, namePath, new Set<string>(), fileId, lines, state)

    const exported = /\bexport\b/.test(declaration)
    state.symbols.push({
      id,
      name: symbol.name,
      namePath,
      kind: symbol.kind,
      kindName: symbolKindName(symbol.kind),
      fileId,
      containerId,
      children: childIds,
      startLine: symbol.range.start.line + 1,
      startColumn: symbol.range.start.character,
      endLine: symbol.range.end.line + 1,
      endColumn: symbol.range.end.character,
      selectionLine: symbol.selectionRange.start.line + 1,
      selectionColumn: symbol.selectionRange.start.character,
      exported,
      async: /\basync\b/.test(declaration),
      static: /\bstatic\b/.test(declaration),
      detail: symbol.detail ?? null,
    })
    if (exported) state.exportedIds.push(id)
  }
  return ids
}

/** The declaration text from the range start up to the symbol name. */
function declarationPrefix(lines: string[], symbol: LspDocumentSymbol): string {
  const start = symbol.range.start
  const name = symbol.selectionRange.start
  // Same line is the common case (`export async function foo()`).
  if (start.line === name.line) {
    return lines[start.line]!.slice(start.character, name.character)
  }
  // Multi-line declarations (`export default class Foo\n  extends Bar`).
  const parts: string[] = []
  for (let line = start.line; line <= name.line && line < lines.length; line++) {
    const text = lines[line]!
    const from = line === start.line ? start.character : 0
    const to = line === name.line ? name.character : text.length
    parts.push(text.slice(from, to))
  }
  return parts.join('\n')
}
