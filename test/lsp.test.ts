/**
 * Language-server integration tests.
 *
 * Drives the real `typescript-language-server` against the fixture project and
 * asserts the semantic requests the plugin depends on: document symbols,
 * hover, references, implementations, and pushed diagnostics.
 * @module code-intel/test/lsp
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LspClient, pathToUri } from '../src/host/lsp/client.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = join(here, 'fixture')
const accountUri = pathToUri(join(fixture, 'src', 'account.ts'))
const repoUri = pathToUri(join(fixture, 'src', 'repo.ts'))

async function startedClient(): Promise<LspClient> {
  const client = new LspClient({ rootPath: fixture })
  await client.start()
  // The whole fixture participates in the program: implementations and
  // cross-file references only resolve with every module open.
  for (const file of ['src/account.ts', 'src/repo.ts', 'src/sqlite_repo.ts', 'src/index.ts', 'src/utils.ts', 'src/broken.ts']) {
    const uri = pathToUri(join(fixture, file))
    client.openTextDocument(uri, 'typescript', await readFile(pathOf(uri), 'utf8'))
  }
  return client
}

function pathOf(uri: string): string {
  return fileURLToPath(uri)
}

/** Poll until pushed diagnostics arrive for a document, re-syncing once. */
async function awaitDiagnostics(client: LspClient, uri: string, timeoutMs = 20_000): Promise<number> {
  const started = Date.now()
  let nudged = false
  while (Date.now() - started < timeoutMs) {
    const diagnostics = client.getDiagnostics(uri)
    if (diagnostics.length > 0) return diagnostics.length
    if (!nudged && Date.now() - started > 3_000) {
      // A no-op full-sync change re-runs diagnostics when the open publication is late.
      const open = client.openDocuments.get(uri)
      if (open) client.changeTextDocument(uri, open.text, open.version + 1)
      nudged = true
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return client.getDiagnostics(uri).length
}

test('initialize handshake completes with capabilities', async () => {
  const client = new LspClient({ rootPath: fixture })
  const capabilities = await client.start()
  assert.ok(capabilities, 'initialize returns a capabilities object')
  assert.equal(client.running, true)
  await client.stop()
  assert.equal(client.running, false)
})

test('documentSymbol returns the hierarchical symbol tree', async () => {
  const client = await startedClient()
  try {
    const symbols = await client.documentSymbol(accountUri)
    const names = symbols.map((symbol) => symbol.name)
    assert.ok(names.includes('AccountSnapshot'), 'interface AccountSnapshot is a top-level symbol')
    assert.ok(names.includes('Account'), 'class Account is a top-level symbol')
    const account = symbols.find((symbol) => symbol.name === 'Account')
    assert.ok(account, 'Account symbol exists')
    const methods = (account?.children ?? []).map((child) => child.name)
    assert.ok(methods.includes('deposit'), 'Account has a deposit method')
    assert.ok(methods.includes('snapshot'), 'Account has a snapshot method')
  } finally {
    await client.stop()
  }
})

test('hover returns signature information', async () => {
  const client = await startedClient()
  try {
    const symbols = await client.documentSymbol(accountUri)
    const account = symbols.find((symbol) => symbol.name === 'Account')
    const deposit = account?.children?.find((child) => child.name === 'deposit')
    assert.ok(deposit, 'deposit method found')
    const hover = await client.hover(accountUri, deposit!.selectionRange.start)
    assert.ok(hover, 'hover resolves for deposit')
  } finally {
    await client.stop()
  }
})

test('references finds usages across files', async () => {
  const client = await startedClient()
  try {
    const symbols = await client.documentSymbol(accountUri)
    const account = symbols.find((symbol) => symbol.name === 'Account')
    const references = await client.references(accountUri, account!.selectionRange.start, true)
    const files = references.map((reference) => reference.uri)
    assert.ok(files.some((uri) => uri.endsWith('src/index.ts')), 'Account is referenced from index.ts')
    assert.ok(references.length >= 2, 'Account has several references')
  } finally {
    await client.stop()
  }
})

test('implementation resolves an interface implementer', async () => {
  const client = await startedClient()
  try {
    const symbols = await client.documentSymbol(repoUri)
    const repository = symbols.find((symbol) => symbol.name === 'Repository')
    assert.ok(repository, 'Repository interface found')
    const implementations = await client.implementation(repoUri, repository!.selectionRange.start)
    const targets = implementations.map((location) => location.uri)
    assert.ok(targets.some((uri) => uri.endsWith('src/sqlite_repo.ts')), 'SqliteRepository implements Repository')
  } finally {
    await client.stop()
  }
})

test('publishDiagnostics surfaces type errors', async () => {
  const client = await startedClient()
  try {
    const brokenUri = pathToUri(join(fixture, 'src', 'broken.ts'))
    client.openTextDocument(brokenUri, 'typescript', await readFile(pathOf(brokenUri), 'utf8'))
    const count = await awaitDiagnostics(client, brokenUri)
    assert.ok(count > 0, 'broken.ts reports at least one diagnostic')
    const diagnostics = client.getDiagnostics(brokenUri)
    assert.ok(diagnostics.some((diagnostic) => /not assignable/i.test(diagnostic.message) || /Type/.test(diagnostic.message)), 'diagnostic describes the type mismatch')
  } finally {
    await client.stop()
  }
})
