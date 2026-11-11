/**
 * The client half of the code-intel remote.
 *
 * A hand-authored Typert remote contribution whose single envelope method
 * (`codeIntel/query`) shuttles every sidebar operation: typed wrappers here
 * shape calls into `(op, argsJson)` and results back out, keeping the wire
 * surface minimal and the panel code typed.
 * @module code-intel/client/remote
 */
import { z } from 'zod'
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info'

const stringCodec = (description: string) => ({
  mode: 'strict' as const,
  typeSymbol: 'string',
  create: () => z.string(),
  jsonSchema: { type: 'string' as const, description },
})

export const CODE_INTEL_REMOTE = createTypertRemoteInfo(
  {
    package: 'code-intel',
    methods: {
      'codeIntel/query': {
        service: 'codeIntel',
        description: 'Run one read-only code-intel host operation for the symbol browser (blueprint, overview, search, details, references, implementations, diagnostics, status, refresh).',
        invocation: { kind: 'direct' },
        parameters: [
          {
            name: 'op',
            wire: 'op',
            description: 'Operation name: blueprint | status | overview | search | details | references | implementations | diagnostics | refresh.',
            source: 'json',
            codec: stringCodec('Operation name.'),
            strictCodec: stringCodec('Operation name.'),
          },
          {
            name: 'argsJson',
            wire: 'argsJson',
            description: 'JSON-encoded arguments object of the operation.',
            source: 'json',
            codec: stringCodec('JSON-encoded arguments.'),
            strictCodec: stringCodec('JSON-encoded arguments.'),
          },
        ],
        cancellation: { parameter: 'signal' },
        result: stringCodec('JSON-encoded result of the operation.'),
      },
    },
  },
  z,
)

export interface CodeIntelRemoteApi {
  query: (op: string, args?: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>
}

/** Typed wrappers over the envelope method shared by the panel. */
export function codeIntelApi(query: (op: string, args?: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>) {
  return {
    blueprint: (signal?: AbortSignal) => query('blueprint', {}, signal),
    status: (signal?: AbortSignal) => query('status', {}, signal),
    overview: (file: string, depth?: number, signal?: AbortSignal) => query('overview', { file, depth }, signal),
    search: (pattern: string, options?: { substring?: boolean; relativePath?: string; maxMatches?: number }, signal?: AbortSignal) =>
      query('search', { pattern, options }, signal),
    details: (namePath: string, options?: { relativePath?: string; includeBody?: boolean }, signal?: AbortSignal) =>
      query('details', { namePath, options }, signal),
    references: (namePath: string, options?: { relativePath?: string }, signal?: AbortSignal) => query('references', { namePath, options }, signal),
    implementations: (namePath: string, options?: { relativePath?: string }, signal?: AbortSignal) => query('implementations', { namePath, options }, signal),
    diagnostics: (file?: string, signal?: AbortSignal) => query('diagnostics', { file }, signal),
    refresh: (signal?: AbortSignal) => query('refresh', {}, signal),
  }
}

export type CodeIntelApi = ReturnType<typeof codeIntelApi>
