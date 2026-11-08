/**
 * Development-time linking of DSH peer packages from a shared global install.
 *
 * The DSH packages this plugin declares as peers ship their built `lib/` in the
 * Harness profile install; during local development we symlink them into this
 * project's node_modules so `tsc --noEmit` and the test runner can resolve them
 * without publishing. The bundled output keeps every @deepseek-ai/* import
 * external, exactly as the DSH plugin loader expects.
 */
import { symlink, mkdir, access, readFile, lstat, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const nodeModules = resolve(root, 'node_modules')
const candidates = [
  process.env.DSH_GLOBAL_INSTALL,
  resolve(process.env.HOME ?? '', '.bun/install/global/node_modules'),
].filter(Boolean)

const PEERS = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/cosmokit',
  '@deepseek-ai/dsh-agent',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/dsh-typert-protocol',
  '@deepseek-ai/dsh-working-directory',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-scope',
  '@deepseek-ai/dsh-util-values',
]

async function findGlobal() {
  for (const candidate of candidates) {
    try {
      await access(resolve(candidate, '@deepseek-ai/cordis/package.json'))
      return candidate
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`Could not locate a DSH global install; set DSH_GLOBAL_INSTALL (tried: ${candidates.join(', ')})`)
}

const target = await findGlobal()
const targetGlobal = target
await mkdir(resolve(nodeModules, '@deepseek-ai'), { recursive: true })

async function globalVersion(name) {
  try {
    const { readFile } = await import('node:fs/promises')
    const raw = await readFile(resolve(targetGlobal, name, 'package.json'), 'utf8')
    return (JSON.parse(raw).version ?? '').toString()
  } catch {
    return ''
  }
}

async function localVersion(dest) {
  try {
    const raw = await readFile(resolve(dest, 'package.json'), 'utf8')
    return (JSON.parse(raw).version ?? '').toString()
  } catch {
    return ''
  }
}

let linked = 0
for (const peer of PEERS) {
  const source = resolve(targetGlobal, peer)
  const dest = resolve(nodeModules, peer)
  try {
    await access(source)
  } catch {
    console.log(`skip   ${peer} (absent in global install)`)
    continue
  }
  try {
    await access(dest)
    // A real directory (registry copy) whose version differs from the profile
    // install is stale: bun can resolve older peers that lack APIs the running
    // profile provides. Replace it with the profile's own tree.
    const stats = await lstat(dest)
    if (!stats.isSymbolicLink()) {
      const local = await localVersion(dest)
      const global = await globalVersion(peer)
      if (local !== global) {
        await rm(dest, { recursive: true, force: true })
        await symlink(source, dest, 'dir')
        console.log(`relink ${peer} ${local} -> ${global}`)
        linked++
      } else {
        console.log(`keep   ${peer} ${local}`)
      }
    } else {
      console.log(`keep   ${peer}`)
    }
    continue
  } catch {
    // not linked yet; fall through to create the symlink
  }
  await symlink(source, dest, 'dir')
  console.log(`link   ${peer} -> ${source}`)
  linked++
}

console.log(`linked ${linked} peer package(s) from ${targetGlobal}`)
