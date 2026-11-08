/**
 * Host service tests: the typed query API the model tools consume, plus the
 * envelope remote method the Web Client sidebar calls.
 * @module code-intel/test/service
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { CodeIntelService } from '../src/host/service.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = join(here, 'fixture')

async function withService(fn: (service: CodeIntelService) => Promise<void>): Promise<void> {
  const cacheDir = await mkdtemp(join(tmpdir(), 'code-intel-service-'))
  process.env.DSH_CODE_INTEL_CACHE = cacheDir
  const ctx = new Context()
  const service = new CodeIntelService(ctx, { rootPath: fixture })
  try {
    await fn(service)
  } finally {
    await service.dispose()
    await rm(cacheDir, { recursive: true, force: true })
    delete process.env.DSH_CODE_INTEL_CACHE
  }
}

test('getBlueprint returns the project blueprint', async () => { await withService(async (service) => {
  const blueprint = await service.getBlueprint(fixture)
  assert.equal(blueprint.rootPath, fixture)
  assert.ok(blueprint.symbolCount > 10, 'the fixture has many symbols')
  assert.ok(blueprint.entryPoints.includes('src/index.ts'), 'entry points are derived')
}) })

test('searchSymbols finds symbols by name path', async () => { await withService(async (service) => {
  const exact = await service.searchSymbols('Account.deposit', {}, fixture)
  assert.equal(exact.length, 1)
  assert.equal(exact[0]!.kindName, 'Method')
  const suffix = await service.searchSymbols('deposit', {}, fixture)
  assert.ok(suffix.some((hit) => hit.namePath === 'Account.deposit'))
  const substring = await service.searchSymbols('posit', { substring: true }, fixture)
  assert.ok(substring.length >= 1, 'substring search matches')
  const limited = await service.searchSymbols('a', { substring: true, maxMatches: 2 }, fixture)
  assert.ok(limited.length <= 2, 'maxMatches caps results')
}) })

test('getSymbolsOverview returns a grouped file overview', async () => { await withService(async (service) => {
  const overview = await service.getSymbolsOverview('src/account.ts', -1, fixture)
  assert.equal(overview.file, 'src/account.ts')
  assert.ok(overview.symbolCount >= 6, 'account.ts has several symbols')
  const names = overview.symbols.map((entry) => entry.name)
  assert.ok(names.includes('AccountSnapshot'))
  assert.ok(names.includes('Account'))
}) })

test('getSymbolDetails exposes symbol properties and body', async () => { await withService(async (service) => {
  const details = await service.getSymbolDetails('Account.deposit', { includeBody: true }, fixture)
  assert.equal(details.symbol.namePath, 'Account.deposit')
  assert.equal(details.container!.namePath, 'Account')
  assert.ok(details.symbol.exported === false, 'deposit is not exported')
  assert.ok(details.body !== null && /this\.balance/.test(details.body!), 'body reads the method source')
  assert.ok(details.hover, 'hover text is attached')
}) })

test('findReferencingSymbols resolves usages across files', async () => { await withService(async (service) => {
  const references = await service.findReferencingSymbols('Account', {}, fixture)
  assert.equal(references.length, 1)
  const [result] = references
  assert.equal(result!.symbol.namePath, 'Account')
  assert.ok(result!.references.some((reference) => reference.file === 'src/index.ts'), 'index.ts references Account')
}) })

test('findImplementations resolves interface implementers', async () => { await withService(async (service) => {
  const implementations = await service.findImplementations('Repository', {}, fixture)
  assert.equal(implementations.length, 1)
  const [result] = implementations
  assert.equal(result!.symbol.namePath, 'Repository')
  assert.ok(result!.implementations.some((location) => location.file === 'src/sqlite_repo.ts'), 'SqliteRepository implements Repository')
}) })

test('getDiagnostics reports type errors', async () => { await withService(async (service) => {
  const diagnostics = await service.getDiagnostics('src/broken.ts', fixture)
  assert.equal(diagnostics.length, 1)
  assert.equal(diagnostics[0]!.file, 'src/broken.ts')
  assert.ok(diagnostics[0]!.diagnostics.length > 0, 'broken.ts reports diagnostics')
  const all = await service.getDiagnostics(undefined, fixture)
  assert.ok(all.some((entry) => entry.file === 'src/broken.ts'), 'project-wide diagnostics include broken.ts')
}) })

test('query envelope round-trips every operation', async () => { await withService(async (service) => {
  const blueprint = JSON.parse(await service.query('blueprint', JSON.stringify({ root: fixture })))
  assert.equal(blueprint.rootPath, fixture)
  const status = JSON.parse(await service.query('status', JSON.stringify({ root: fixture })))
  assert.equal(status.state, 'ready')
  const overview = JSON.parse(await service.query('overview', JSON.stringify({ file: 'src/account.ts' })))
  assert.ok(overview.symbolCount > 0)
  const search = JSON.parse(await service.query('search', JSON.stringify({ pattern: 'deposit' })))
  assert.ok(search.some((hit: { namePath: string }) => hit.namePath === 'Account.deposit'))
  const details = JSON.parse(await service.query('details', JSON.stringify({ namePath: 'Account.deposit', options: { includeBody: true } })))
  assert.equal(details.symbol.namePath, 'Account.deposit')
  const references = JSON.parse(await service.query('references', JSON.stringify({ namePath: 'Account' })))
  assert.ok(Array.isArray(references))
  const implementations = JSON.parse(await service.query('implementations', JSON.stringify({ namePath: 'Repository' })))
  assert.ok(implementations.length > 0)
  const diagnostics = JSON.parse(await service.query('diagnostics', JSON.stringify({ file: 'src/broken.ts' })))
  assert.ok(diagnostics[0]!.diagnostics.length > 0)
  await assert.rejects(() => service.query('unknown-op', '{}'), /unknown code-intel operation/, 'unknown ops are rejected')
}) })

test('status reports idle before first use and ready after', async () => { await withService(async (service) => {
  const idle = await service.status(undefined)
  assert.equal(idle.state, 'idle')
  await service.getBlueprint(fixture)
  const ready = await service.status(undefined)
  assert.equal(ready.state, 'ready')
  assert.equal(ready.rootPath, fixture)
}) })
