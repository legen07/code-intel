/**
 * Assembly of the project blueprint — the compact answer to "what is this
 * project?" — from a built code graph.
 *
 * The blueprint carries the module inventory, the file↔file dependency edges,
 * aggregated external dependencies, and the derived entry points (modules
 * nothing else in the project imports).
 * @module code-intel/blueprint
 */
import type {
  CodeFile,
  ProjectBlueprint,
  SymbolGraphData,
} from '../common/types.ts'

/** Derive the project blueprint from a built graph. */
export function buildBlueprint(data: SymbolGraphData, fromCache: boolean): ProjectBlueprint {
  const files = Object.values(data.files) as CodeFile[]
  const countsByKind: Record<string, number> = {}
  for (const symbol of Object.values(data.symbols) as unknown as Array<{ kindName: string }>) {
    countsByKind[symbol.kindName] = (countsByKind[symbol.kindName] ?? 0) + 1
  }

  const dependencies: Array<{ from: string; to: string }> = []
  const externalCounts = new Map<string, number>()
  for (const file of files) {
    for (const target of file.imports) {
      if (data.files[target]) dependencies.push({ from: file.path, to: target })
    }
    for (const external of file.externalImports) {
      externalCounts.set(external, (externalCounts.get(external) ?? 0) + 1)
    }
  }

  const importedByCount = new Map<string, number>()
  for (const edge of dependencies) {
    importedByCount.set(edge.to, (importedByCount.get(edge.to) ?? 0) + 1)
  }
  const entryPoints = files
    .filter((file) => (importedByCount.get(file.path) ?? 0) === 0)
    .map((file) => file.path)
    .sort()

  const externalDependencies = [...externalCounts.entries()]
    .map(([name, importedBy]) => ({ name, importedBy }))
    .sort((a, b) => b.importedBy - a.importedBy || a.name.localeCompare(b.name))

  const exportedSymbolCount = files.reduce((total, file) => total + file.exportedSymbols.length, 0)

  return {
    rootPath: data.rootPath,
    language: data.language,
    fileCount: files.length,
    symbolCount: Object.keys(data.symbols).length,
    countsByKind,
    exportedSymbolCount,
    modules: files
      .map((file) => ({
        path: file.path,
        language: file.language,
        symbolCount: file.symbolCount,
        exportedSymbols: namesOfExported(file, data),
        imports: file.imports,
        externalImports: file.externalImports,
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    dependencies,
    externalDependencies,
    entryPoints,
    errors: data.errors,
    generatedAt: data.updatedAt,
    fromCache,
  }
}

/** Resolve a file's exported symbol ids to their namePaths. */
function namesOfExported(file: CodeFile, data: SymbolGraphData): string[] {
  return file.exportedSymbols
    .map((id) => (data.symbols[id] as { namePath: string } | undefined)?.namePath)
    .filter((namePath): namePath is string => Boolean(namePath))
    .sort()
}
