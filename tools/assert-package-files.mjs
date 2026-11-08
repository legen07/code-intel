/**
 * Assert the package ships every artifact the DSH plugin loaders need.
 * Runs as `prepack`; fails the pack when anything is missing.
 */
import { stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const REQUIRED = [
  'lib/index.js',
  'lib/client.js',
  'lib/types/index.d.ts',
  'lib/types/client/index.d.ts',
  'cordis.patch.yml',
  'package.json',
]

const missing = []
for (const relative of REQUIRED) {
  const path = resolve(root, relative)
  try {
    const stats = await stat(path)
    if (!stats.isFile() && !stats.isDirectory()) missing.push(relative)
  } catch {
    missing.push(relative)
  }
}

if (missing.length > 0) {
  console.error('code-intel: missing package files:')
  for (const relative of missing) console.error('  - ' + relative)
  console.error('Run `bun run build` before packing.')
  process.exitCode = 1
} else {
  console.log('code-intel: package files complete')
}
