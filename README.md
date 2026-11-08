# @deepseek-ai/code-intel

DeepSeek Harness plugin that gives coding agents IDE-grade code intelligence about the project they are working in — a Serena-style, language-server-backed symbol layer for TypeScript and JavaScript projects.

Code-intel discovers every symbol of every script in the project, derives each symbol's properties, persists the results as a **project blueprint** (a symbol + module-dependency graph), and exposes it all to the agent as a fixed set of callable tools — plus a symbol-browser panel in the Web Client's right sidebar.

## What it does

- **Symbol discovery.** A native TypeScript LSP client spawns `typescript-language-server` for the session's project, opens the whole tree (gitignore-aware), and harvests every symbol of every module with the language server's semantic model — name paths (`Account.deposit`), kinds, exact locations, signatures, docs.
- **Symbol properties.** For each symbol: kind, location range, exported/async/static modifiers (read from the declaration prefix the language server spans), container, children, signature/documentation (hover), and the declaration body on request.
- **The project blueprint.** The graph is persisted to a per-project cache and summarized as a blueprint: every module with its symbol inventory and exports, file→file dependency edges, aggregated external package dependencies, derived entry points, and counts by symbol kind.
- **Agent tools.** Serena-style, fixed generic tools (read-only in v1) that address symbols by name path. The agent gets a compact, structured view of the code instead of grepping raw text.
- **Symbol browser.** A Web Client sidebar tab searches symbols, browses modules, inspects symbol details, references, implementations, and diagnostics through the same service.

## Tools

| Tool | Purpose |
| --- | --- |
| `find_symbol` | Find symbols by name path (exact, suffix, or substring) with kind filters |
| `find_referencing_symbols` | Every usage of a symbol across the project (LSP references) |
| `find_implementations` | All implementers of an interface or abstract class |
| `get_symbols_overview` | A file's symbol tree, grouped by kind and containment |
| `get_symbol_details` | Every property of one symbol: modifiers, container, children, signature, body |
| `get_diagnostics` | Language-server diagnostics for a file, or the whole project |
| `get_project_blueprint` | The persisted blueprint: modules, dependencies, entry points |
| `refresh_code_index` | Force a full re-index of the project graph |

## Architecture

```
src/
  index.ts                  Host plugin entry: mounts the service and the tools
  host/
    lsp/protocol.ts         JSON-RPC 2.0 Content-Length framing (solidlsp-style)
    lsp/client.ts           LSP client: spawn tsserver-backed LS, doc sync,
                            documentSymbol / hover / references / implementation,
                            publishDiagnostics collection
    graph/
      ignore.ts             .gitignore pattern engine
      scan.ts               Project file discovery (deny list + gitignore)
      imports.ts            Static import analysis and specifier resolution
      builder.ts            LSP symbol trees → graph symbol records + properties
      model.ts              Read-only view: namePath addressing, search, overview
      store.ts              Atomic JSON snapshot persistence (per project hash)
      indexer.ts            Whole-project index orchestration with caching
    blueprint.ts            Graph → blueprint summary
    service.ts              CodeIntelService: typed queries + Typert remote envelope
    tools.ts                defineTool registrations (the agent-facing tool set)
  client/
    remote.ts               Hand-authored Typert remote (single envelope method)
    panel.tsx               The symbol-browser sidebar panel
    index.tsx               Client entry: remote mount, tab + slot registration
  common/types.ts           Shared types: graph, blueprint, tool results
```

The Host half is a Node ESM bundle with every `@deepseek-ai/*` peer external; the Web Client half is a browser bundle in the DSH module-loader factory shape with React and zod external. `typescript` and `typescript-language-server` are never imported by the bundle — the language server runs as a spawned subprocess, resolved from this package's own dependencies at runtime.

## Development

```sh
bun install                          # install dependencies
bun run link-peers                   # link DSH peer packages from the global install
bun run check                        # typecheck
bun run build                        # build lib/index.js, lib/client.js, lib/types
bun test                             # unit + integration tests
node tools/smoke-host.mjs            # load the built bundle and query a live server
```

Tests drive the real `typescript-language-server` against `test/fixture` (a small TypeScript project) and verify the protocol layer, the graph model, persistence and caching, the blueprint, and the service's typed API and remote envelope.

> TypeScript must stay on `~5.9` while `typescript-language-server` expects a classic `lib/tsserver.js`; TypeScript 7 ships the native compiler without it.

### Enabling in DeepSeek Harness

Install the package into a profile that can resolve it, then enable the plugin — `cordis.patch.yml` inserts `code-intel` into the plugin tree and the browser module loader picks up `lib/client.js` through the package's `./client` export. The plugin targets DSH `>=0.2.1-rc.5` with `@deepseek-ai/cordis ~4.1`.

## Design notes

- **Why a fixed tool set.** Serena's central insight: a handful of generic, parameterized tools beats a tool per symbol, which would flood the model's context. Symbol *discovery* is the engine behind the tools, not the tool list itself.
- **Why one envelope remote.** The browser panel funnels every operation through a single validated `codeIntel/query(op, argsJson)` method, keeping the Gateway wire surface small while the client-side wrappers keep calls typed.
- **Read-only v1.** Symbol-level mutations (rename, move, delete) are deliberately deferred; they need full workspace-edit handling and are where agents can corrupt code.
- **Session project.** Tools resolve the calling agent's session directory through the working-directory service; `get_project_blueprint` answers for that root and caches the graph under `~/.dsh/code-intel/caches/<hash>/graph.json` (override with `DSH_CODE_INTEL_CACHE`).
