# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Repository standards: `.gitattributes` (LF normalization, binary handling, archive exclusions), `.editorconfig`, `CONTRIBUTING.md` (development setup, Conventional Commits, release process), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md` (private vulnerability reporting), and `.github/CODEOWNERS`.
- GitHub repository automation: CI workflow (`check`/`build`/`test`/`prepack` assertion across Node 20/22 on Ubuntu and macOS), a release workflow that verifies a tag and publishes a GitHub Release with generated notes, issue templates (bug report, feature request), a pull-request template, and Dependabot configuration for npm and GitHub Actions.
- `author` metadata in `package.json`; CI, license, and registry badges in the README.
- Annotated git tags `v0.1.0` and `v0.2.0` marking the historical releases.
- Client-entry test suite (`test/client-entry.test.ts`) covering the Web Client entry: the module-loader factory shape, tab and right-sidebar slot registration, and the remote envelope.
- `REGISTRY_READINESS.md`, an audit of the plugin-registry distribution contract and the listing strategy for the plugin portals.
- dsh-plugin.org listing badge to the README.
- `LICENSE` (MIT) file in the repository root and the package `files` list. The package declared `MIT` from the start, but the license text itself was missing.

### Changed

- Renamed the git remote from `remote` to the conventional `origin` and corrected the malformed local `user.name` (`Joe\ Legen` → `Joe Legen`); enabled `push.followTags` so releases push their tag with the branch.
- Fixed the `bun test` instruction in the README to `bun run test` (`npm test`-style, the package script drives `node --test test/`).
- Changelog version references now point at git tags (`compare/v0.1.0...v0.2.0`) instead of raw commit hashes.
- Renamed the package from `@deepseek-ai/code-intel` to `code-intel` and corrected the repository metadata (`github.com/legen07/code-intel`, homepage, issues URL).
- Committed the built distribution (`lib/index.js`, `lib/client.js`, `lib/types/**`) so installs resolve to committed artifacts instead of an install-time build.
- Harmonized the DSH engine and compatibility gates to `>=0.2.2-rc.1` on the `web` profile and added `dsh.catalog` metadata (category, en/zh summaries, capabilities).

### Fixed

- Plugin installation: removed the `dsh.client.inject` module list (now `[]`), which broke installation, and dropped the vendored `serena` source link.

## [0.2.0] - 2026-11-08

### Added

- Full TypeScript implementation replacing the prebuilt bundles:
  - **LSP layer** — JSON-RPC 2.0 Content-Length framing; spawns `typescript-language-server` for the session project; document sync; `documentSymbol`, `hover`, `references`, `implementation`; diagnostics collection.
  - **Symbol graph** — `.gitignore`-aware project discovery, static import analysis and specifier resolution, LSP symbol trees → symbol records with properties (kind, location, exported/async/static modifiers, container, children, signature/documentation), name-path addressing and search, atomic per-project JSON snapshot persistence, and whole-project index orchestration with caching.
  - **Blueprint** — modules with symbol inventories and exports, file→file dependency edges, aggregated external package dependencies, derived entry points, and counts by symbol kind.
  - **Service** — `CodeIntelService` typed query API behind a single Typert remote envelope, `codeIntel/query(op, argsJson)`.
  - **Agent tools** — read-only v1 tool set: `find_symbol`, `find_referencing_symbols`, `find_implementations`, `get_symbols_overview`, `get_symbol_details`, `get_diagnostics`, `get_project_blueprint`, `refresh_code_index`.
  - **Web Client** — symbol-browser sidebar: symbol search, module browsing, symbol details, references, implementations, and diagnostics.
- Build pipeline (`build.mjs`): a Node ESM host bundle with every `@deepseek-ai/*` peer external, a browser client bundle with React and zod external, and generated `.d.ts` type declarations.
- Test suite driving the real `typescript-language-server` against `test/fixture` (protocol, graph model, persistence and caching, blueprint, service API and remote envelope).
- README documenting the tool set, architecture, development workflow, and installation.

### Removed

- Prebuilt `lib/host` and `lib/client` bundles, replaced by the source tree and build pipeline.
- Serena-style configuration resources (`resources/config/contexts/*`, `resources/config/modes/*`).

## [0.1.0] - 2026-11-03

### Added

- Initial `code-intel` DeepSeek Harness plugin: a prebuilt host bundle (`lib/host/`) mounting the code-intelligence service, and a Web Client bundle (`lib/client/`), providing IDE-like code intelligence — semantic code retrieval, editing, refactoring, and debugging capabilities.
- `cordis.patch.yml` inserting the plugin into the DSH profile tree.
- Serena-style configuration resources: `agent` and `codebuddy` contexts, and `editing`, `one-shot`, and `query-projects` modes.
- Package metadata: MIT license, `dsh` bundle/client manifest, keywords, and a `prepack` file assertion.

[Unreleased]: https://github.com/legen07/code-intel/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/legen07/code-intel/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/legen07/code-intel/releases/tag/v0.1.0
