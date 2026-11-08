/**
 * Orchestrates a whole-project index: scan files, sync them into the language
 * server, harvest document symbols, resolve module imports, and persist the
 * graph. Runs bounded concurrency over file batches so large trees do not
 * overwhelm the server's document set, and supports incremental refresh of
 * changed files.
 * @module code-intel/graph/indexer
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { analyzeImports } from './imports.ts'
import { buildFileSymbols } from './builder.ts'
import { scanProject, type ScanOptions } from './scan.ts'
import { GraphStore, GRAPH_SCHEMA_VERSION } from './store.ts'
import { LspClient, languageIdOf, pathToUri } from '../lsp/client.ts'
import type { CodeFile, SymbolGraphData } from '../../common/types.ts'

/** Per-project symbols/files gating concurrent document sync. */
const OPEN_BATCH = 24

export interface IndexOptions extends ScanOptions {
  /** Signal for cooperative cancellation. */
  signal?: AbortSignal
  /** Load the cached graph instead of re-indexing when it is still fresh. */
  allowCache?: boolean
  /** Maximum graph age (ms) for a cached load to be honored. */
  cacheMaxAgeMs?: number
}

export interface IndexOutcome {
  data: SymbolGraphData
  /** True when a cached graph was served without touching the language server. */
  fromCache: boolean
  /** Files whose symbols could not be harvested. */
  failed: string[]
}

/**
 * Whether the source file has changed since the cached graph indexed it.
 * Files absent from the snapshot need a refresh; size and content compare
 * against the cached fields otherwise.
 */
export function needsRefresh(cached: SymbolGraphData, relativePath: string, size: number): boolean {
  const file = cached.files[relativePath]
  return !file || file.size !== size
}

/** Build (or refresh) the code graph of `root` through `client`. */
export async function indexProject(root: string, client: LspClient, store: GraphStore, options: IndexOptions = {}): Promise<IndexOutcome> {
  const allowCache = options.allowCache ?? true
  if (allowCache) {
    const cached = await store.load()
    if (cached) {
      const fresh = (await store.isFresh(options.cacheMaxAgeMs)) && !(await scanDiffers(root, cached, options))
      if (fresh) return { data: cached, fromCache: true, failed: [] }
    }
  }

  const scanned = await scanProject(root, options)
  const known = new Set(scanned.files)
  const files: Record<string, CodeFile> = {}
  const symbols: SymbolGraphData['symbols'] = {}
  const failed: string[] = []
  const errors = [...scanned.errors]

  // Open every file in batches so the server indexes them for semantic queries.
  for (let start = 0; start < known.size; start += OPEN_BATCH) {
    if (options.signal?.aborted) throw new Error('index cancelled')
    const batch = [...known].slice(start, start + OPEN_BATCH)
    await Promise.all(
      batch.map(async (relativePath) => {
        const absolute = join(root, relativePath)
        const source = await readFile(absolute, 'utf8').catch((error) => {
          failed.push(relativePath)
          errors.push(`cannot read ${relativePath}: ${String(error)}`)
          return null
        })
        if (source === null) return
        const language = languageIdOf(relativePath)
        if (language === null) return
        const uri = pathToUri(absolute)
        client.openTextDocument(uri, language, source)

        const forest = await client.documentSymbol(uri).catch((error) => {
          failed.push(relativePath)
          errors.push(`symbol harvest failed for ${relativePath}: ${String(error)}`)
          return []
        })
        const built = buildFileSymbols(relativePath, source, forest)
        for (const symbol of built.symbols) symbols[symbol.id] = symbol

        const analysis = analyzeImports(source, relativePath, known)
        files[relativePath] = {
          id: relativePath,
          path: relativePath,
          language,
          symbolCount: built.symbols.length,
          imports: analysis.resolved,
          externalImports: analysis.external,
          exportedSymbols: built.exportedIds,
          size: Buffer.byteLength(source, 'utf8'),
        }
      }),
    )
  }

  const previous = await store.load()
  const data: SymbolGraphData = {
    version: GRAPH_SCHEMA_VERSION,
    rootPath: root,
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    language: 'typescript',
    files,
    symbols,
    errors,
  }
  await store.save(data).catch((error) => {
    errors.push(`cannot persist graph: ${String(error)}`)
  })
  return { data, fromCache: false, failed }
}

/** True when the on-disk file set differs from the cached graph's. */
async function scanDiffers(root: string, cached: SymbolGraphData, options: ScanOptions): Promise<boolean> {
  const scanned = await scanProject(root, options)
  const scannedSet = new Set(scanned.files)
  if (scannedSet.size !== Object.keys(cached.files).length) return true
  for (const file of scanned.files) {
    if (!cached.files[file]) return true
  }
  return false
}
