/**
 * Unit tests for the pushed-diagnostics wait: an empty publication must not
 * close the wait while a real (semantic) batch may still supersede it — the
 * race that made `getDiagnostics` report a broken file as clean.
 * @module code-intel/test/diagnostics-wait
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import type { LspClient } from '../src/host/lsp/client.ts'
import { waitForDiagnostics } from '../src/host/service.ts'
import type { LspDiagnostic } from '../src/common/types.ts'

type DiagnosticsListener = (event: { uri: string; diagnostics: LspDiagnostic[] }) => void

/** The LspClient surface `waitForDiagnostics` consumes, with scriptable publications. */
class FakeLspClient {
  private listeners = new Set<DiagnosticsListener>()
  private cache = new Map<string, LspDiagnostic[]>()

  on(_event: string, listener: DiagnosticsListener): void {
    this.listeners.add(listener)
  }

  off(_event: string, listener: DiagnosticsListener): void {
    this.listeners.delete(listener)
  }

  getDiagnostics(uri: string): LspDiagnostic[] {
    return this.cache.get(uri) ?? []
  }

  /** Publish as the server does: update the cache, then emit. */
  publish(uri: string, diagnostics: LspDiagnostic[]): void {
    this.cache.set(uri, diagnostics)
    const event = { uri, diagnostics }
    for (const listener of this.listeners) listener(event)
  }
}

const uri = 'file:///project/src/broken.ts'
const realBatch: LspDiagnostic[] = [
  { range: { start: { line: 3, character: 0 }, end: { line: 3, character: 5 } }, severity: 1, message: "Type 'string' is not assignable to type 'number'.", code: 2322, source: 'ts' },
]

test('an empty publication does not close the wait before the real batch', async () => {
  const client = new FakeLspClient()
  const started = Date.now()
  const pending = waitForDiagnostics(client as unknown as LspClient, uri, 5_000)
  client.publish(uri, [])
  await new Promise((resolve) => setTimeout(resolve, 40))
  client.publish(uri, realBatch)
  const diagnostics = await pending
  const elapsed = Date.now() - started
  assert.equal(diagnostics.length, 1, 'the real batch wins over the earlier empty flush')
  assert.ok(elapsed < 5_000, 'a non-empty batch settles immediately')
})

test('an empty publication alone resolves empty after the grace window', async () => {
  const client = new FakeLspClient()
  const started = Date.now()
  const pending = waitForDiagnostics(client as unknown as LspClient, uri, 5_000)
  client.publish(uri, [])
  const diagnostics = await pending
  const elapsed = Date.now() - started
  assert.equal(diagnostics.length, 0, 'a clean file settles empty')
  assert.ok(elapsed >= 1_400, 'the wait outlives an empty publication by at least the grace window')
  assert.ok(elapsed < 5_000, 'the overall deadline still applies')
})

test('no publication at all resolves with the cache at the deadline', async () => {
  const client = new FakeLspClient()
  const started = Date.now()
  const diagnostics = await waitForDiagnostics(client as unknown as LspClient, uri, 120)
  const elapsed = Date.now() - started
  assert.equal(diagnostics.length, 0)
  assert.ok(elapsed >= 100, 'the deadline is awaited')
})
