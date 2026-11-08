/**
 * Persistence of the built code graph.
 *
 * One JSON snapshot per project under a version-pinned cache directory. Writes
 * are atomic (temporary file + rename) so an interrupted refresh never leaves a
 * torn graph behind, and the snapshot's own schema version gates stale loads.
 * @module code-intel/graph/store
 */
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { SymbolGraphData } from '../../common/types.ts'

export const GRAPH_SCHEMA_VERSION = 1

export interface StoreOptions {
  /** Cache root; defaults to `$DSH_CODE_INTEL_CACHE` or `~/.dsh/code-intel/caches`. */
  cacheDir?: string
}

export class GraphStore {
  readonly cachePath: string

  constructor(rootPath: string, options: StoreOptions = {}) {
    const base = options.cacheDir ?? process.env.DSH_CODE_INTEL_CACHE ?? join(homedir(), '.dsh', 'code-intel', 'caches')
    const stamp = createHash('sha1').update(rootPath).digest('hex').slice(0, 16)
    this.cachePath = join(base, stamp, 'graph.json')
  }

  /** Persist a graph atomically. */
  async save(data: SymbolGraphData): Promise<void> {
    await mkdir(dirname(this.cachePath), { recursive: true })
    const staging = `${this.cachePath}.tmp`
    await writeFile(staging, JSON.stringify(data), 'utf8')
    await rename(staging, this.cachePath)
  }

  /** Load the cached graph, or null when absent or schema-incompatible. */
  async load(): Promise<SymbolGraphData | null> {
    try {
      const raw = await readFile(this.cachePath, 'utf8')
      const data = JSON.parse(raw) as SymbolGraphData
      if (data.version !== GRAPH_SCHEMA_VERSION) return null
      return data
    } catch {
      return null
    }
  }

  /** Whether the snapshot exists and is at least this fresh (default: 24h). */
  async isFresh(maxAgeMs = 24 * 60 * 60 * 1000): Promise<boolean> {
    try {
      const stats = await stat(this.cachePath)
      return stats.isFile() && Date.now() - stats.mtimeMs < maxAgeMs
    } catch {
      return false
    }
  }
}
