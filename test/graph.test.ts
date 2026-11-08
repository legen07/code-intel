/**
 * Code graph tests: discovery, import resolution, symbol building, index
 * orchestration, persistence, and blueprint derivation.
 * @module code-intel/test/graph
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeImports, extractSpecifiers, packageNameOf, resolveSpecifier } from '../src/host/graph/imports.ts'
import { scanProject } from '../src/host/graph/scan.ts'
import { buildFileSymbols } from '../src/host/graph/builder.ts'
import { GraphStore, GRAPH_SCHEMA_VERSION } from '../src/host/graph/store.ts'
import { indexProject } from '../src/host/graph/indexer.ts'
import { buildBlueprint } from '../src/host/blueprint.ts'
import { SymbolGraph } from '../src/host/graph/model.ts'
import { LspClient, pathToUri } from '../src/host/lsp/client.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = join(here, 'fixture')

test('scan respects .gitignore and the deny list', async () => {
  const { files, errors } = await scanProject(fixture)
  assert.deepEqual(errors, [], 'no scan errors')
  assert.ok(files.includes('src/account.ts'), 'source files are found')
  assert.ok(!files.some((file) => file.startsWith('ignored-dir/')), 'gitignored directory is skipped')
  assert.ok(!files.some((file) => file.endsWith('.ignored.ts')), 'gitignored extension pattern is skipped')
})

test('scan reports an unreachable root', async () => {
  const { errors } = await scanProject(join(fixture, 'does-not-exist'))
  assert.ok(errors.length === 1, 'scan root failure is reported')
})

test('import specifiers are extracted and resolved', () => {
  const source = `
import { Account } from './account.ts'
import { applyInterest } from './utils.ts'
import * as fs from 'node:fs'
import { Repos } from 'typed-repos'
export { openAccount } from './index.ts'
const x = require('./dynamic.ts')
`
  const specifiers = extractSpecifiers(source)
  assert.ok(specifiers.includes('./account.ts'))
  assert.ok(specifiers.includes('node:fs'))
  assert.ok(specifiers.includes('typed-repos'))
  assert.ok(specifiers.includes('./dynamic.ts'))

  const known = new Set(['src/account.ts', 'src/utils.ts', 'src/index.ts'])
  const analysis = analyzeImports(source, 'src/sqlite_repo.ts', known)
  assert.deepEqual(analysis.resolved.sort(), ['src/account.ts', 'src/index.ts', 'src/utils.ts'])
  assert.ok(analysis.external.includes('node:fs'))
  assert.ok(analysis.external.includes('typed-repos'))
  assert.ok(analysis.external.includes('./dynamic.ts'), 'unknown relative specifier is external')

  assert.equal(packageNameOf('@scope/pkg/sub'), '@scope/pkg')
  assert.equal(packageNameOf('lodash'), 'lodash')
  assert.equal(resolveSpecifier('src/a.ts', './b.ts', known), null)
})

test('builder derives symbol properties from declaration prefixes', () => {
  // Source lines (0-based): the fabricated LSP forest below mirrors them.
  // 0: export const INTEREST_RATE = 0.05
  // 1:
  // 2: export class Account {
  // 3:   deposit(amount: number): number {
  // 4:     return amount
  // 5:   }
  // 6: }
  const source = [
    'export const INTEREST_RATE = 0.05',
    '',
    'export class Account {',
    '  deposit(amount: number): number {',
    '    return amount',
    '  }',
    '}',
  ].join('\n')
  const forest = [
    {
      name: 'Account',
      kind: 5,
      range: { start: { line: 2, character: 0 }, end: { line: 6, character: 1 } },
      selectionRange: { start: { line: 2, character: 13 }, end: { line: 2, character: 20 } },
      children: [
        {
          name: 'deposit',
          kind: 6,
          range: { start: { line: 3, character: 2 }, end: { line: 5, character: 3 } },
          selectionRange: { start: { line: 3, character: 2 }, end: { line: 3, character: 9 } },
        },
      ],
    },
    {
      name: 'INTEREST_RATE',
      kind: 14,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 31 } },
      selectionRange: { start: { line: 0, character: 11 }, end: { line: 0, character: 24 } },
    },
  ]
  const { symbols, exportedIds } = buildFileSymbols('src/f.ts', source, forest)
  const account = symbols.find((symbol) => symbol.namePath === 'Account')
  const deposit = symbols.find((symbol) => symbol.namePath === 'Account.deposit')
  assert.ok(account, 'Account symbol built')
  assert.equal(account!.exported, true, 'exported is detected from the export modifier')
  assert.equal(deposit!.containerId, account!.id, 'container links to the class')
  assert.deepEqual(account!.children, [deposit!.id], 'children link to methods')
  assert.equal(symbols.find((symbol) => symbol.namePath === 'INTEREST_RATE')?.exported, true)
  assert.equal(exportedIds.length, 2)
  assert.equal(deposit!.startLine, 4, '1-based start line')
})

test('indexProject builds and persists the graph', async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'code-intel-graph-'))
  const client = new LspClient({ rootPath: fixture })
  await client.start()
  const store = new GraphStore(fixture, { cacheDir })
  try {
    const outcome = await indexProject(fixture, client, store, { allowCache: false })
    assert.equal(outcome.fromCache, false)
    assert.deepEqual(outcome.failed, [], 'no failed files')
    const { data } = outcome
    assert.ok(data.files['src/account.ts'], 'account.ts is indexed')
    assert.ok(!data.files['src/notes.ignored.ts'], 'ignored files are not indexed')
    const accountDeposit = Object.values(data.symbols).find((symbol) => symbol.namePath === 'Account.deposit')
    assert.ok(accountDeposit, 'Account.deposit is in the graph')
    assert.ok(data.files['src/index.ts']!.imports.includes('src/account.ts'), 'module dependency edge exists')
    assert.equal(data.version, GRAPH_SCHEMA_VERSION)

    const reloaded = await store.load()
    assert.ok(reloaded, 'graph persists to disk')
    assert.equal(reloaded!.rootPath, fixture)

    const cached = await indexProject(fixture, client, store, { allowCache: true })
    assert.equal(cached.fromCache, true, 'second index serves the cache')

    const graph = new SymbolGraph(cached.data)
    const hits = graph.lookup('deposit')
    assert.ok(hits.some((hit) => hit.namePath === 'Account.deposit'), 'lookup finds deposit by suffix')
  } finally {
    await client.stop()
    await rm(cacheDir, { recursive: true, force: true })
  }
})

test('blueprint derives modules, dependencies, and entry points', async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'code-intel-blueprint-'))
  const client = new LspClient({ rootPath: fixture })
  await client.start()
  const store = new GraphStore(fixture, { cacheDir })
  try {
    const outcome = await indexProject(fixture, client, store, { allowCache: false })
    const blueprint = buildBlueprint(outcome.data, false)
    assert.equal(blueprint.rootPath, fixture)
    assert.ok(blueprint.modules.length >= 6, 'every fixture module is listed')
    assert.ok(blueprint.modules.some((module) => module.path === 'src/sqlite_repo.ts'), 'sqlite_repo is a module')
    const sqlite = blueprint.modules.find((module) => module.path === 'src/sqlite_repo.ts')!
    assert.ok(sqlite.exportedSymbols.includes('SqliteRepository'), 'exported symbols are listed')
    assert.ok(sqlite.imports.includes('src/repo.ts'), 'implementation depends on the interface module')
    assert.ok(blueprint.dependencies.some((edge) => edge.from === 'src/index.ts' && edge.to === 'src/account.ts'), 'file dependency edges exist')
    assert.ok(blueprint.entryPoints.includes('src/index.ts'), 'index.ts is an entry point')
    assert.ok(blueprint.countsByKind.Class! >= 2, 'classes are counted by kind')
    assert.equal(blueprint.fromCache, false)
  } finally {
    await client.stop()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
