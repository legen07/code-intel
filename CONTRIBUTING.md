# Contributing to code-intel

Thanks for your interest in improving `code-intel` — the DeepSeek Harness plugin
that gives coding agents LSP-backed code intelligence. This document describes
how to set up the project, what is expected of a change, and how it gets
released.

> Community plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
> Not affiliated with DeepSeek.

## Prerequisites

- [Node.js](https://nodejs.org) `>= 20` (the test runner is `node --test`)
- [Bun](https://bun.sh) (the build pipeline and lockfile are Bun-based)
- A DSH profile install of the Harness `web` profile, or any DSH global install
  the peer linker can find (see below)

## Development setup

```sh
git clone git@github.com:legen07/code-intel.git
cd code-intel
bun install                 # installs dependencies and the @deepseek-ai/* peers
bun run link-peers          # symlink DSH peers from the global profile install
bun run check               # typecheck (tsc --noEmit)
bun run build               # build lib/index.js, lib/client.js, lib/types
bun run test                # unit + integration tests (node --test test/)
node tools/smoke-host.mjs   # load the built bundle against a live language server
```

### Notes on the peers

`@deepseek-ai/*` packages are declared as **peer dependencies**: at runtime the
DSH profile provides them, and the published bundle keeps every `@deepseek-ai/*`
import external. During development `bun install` resolves the peers from the
npm registry; `bun run link-peers` then re-points them at your live profile
install (`~/.bun/install/global/node_modules` by default, override with
`DSH_GLOBAL_INSTALL`) so typechecking and tests run against the same versions
the Harness actually uses. Never import a `@deepseek-ai/*` package that is not
declared as a peer.

### Notes on the tests

Integration tests spawn the real `typescript-language-server` against
`test/fixture` (a small TypeScript project) and may take a while the first run.
The language server downloads its TypeScript engine into `.tmp/`, which is
gitignored. Tests must stay read-only with respect to the fixture.

Keep [README.md](README.md)'s TypeScript pin in mind: TypeScript must stay on
`~5.9` because `typescript-language-server` expects the classic `lib/tsserver.js`.

## Project layout

```
src/
  index.ts          Host plugin entry
  host/             LSP client, symbol graph, service, agent tools
  client/           Web Client sidebar (Typert remote + panel)
  common/           Shared types
lib/                Built distribution (committed)
test/               node:test suites + fixture project
tools/              Dev tooling (peer linking, smoke test, package assertion)
build.mjs           Build pipeline
```

## Making changes

1. **Open an issue first** for anything beyond a small fix — a brief design
   discussion avoids wasted work. Small fixes can go straight to a PR.
2. **Branch** off `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
3. **Write tests.** Every behavior change or bug fix should come with a test
   that fails without it. Keep the suite green:
   `bun run check && bun run build && bun run test`.
4. **Rebuild `lib/`** when host/client sources change (`bun run build`) and
   commit the rebuilt artifacts together with the source change — the built
   distribution is committed on purpose, and a stale `lib/` is a bug. Never
   hand-edit anything under `lib/`.
5. **Update [CHANGELOG.md](CHANGELOG.md)** under `[Unreleased]` in the
   [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format —
   `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`.
6. **Keep the SemVer contract** documented in the README and
   [CHANGELOG.md](CHANGELOG.md): below `1.0.0`, patch = bug fix, minor = feature
   or breaking change.

### Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <imperative summary up to ~72 chars>

<optional body: why, not what>

<optional footer: BREAKING CHANGE:, refs #123>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`. Scope is optional (`lsp`, `graph`, `client`, `tools`,
`docs`, `repo`, …). Write the summary in the imperative present tense
("`add`", not "`added`").

### Pull requests

- One logical change per PR, with a clear description and linked issue.
- Include updated tests and a CHANGELOG `[Unreleased]` entry when user-visible.
- The PR must pass CI (`check`, `build`, `test`) — the workflow runs the same
  commands documented above.
- Be patient and kind — see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Releases

Releases are cut by the maintainer:

1. Move the `[Unreleased]` section to a versioned heading and date it.
2. `bun run check && bun run build && bun run test`.
3. Commit the changelog/version bump, then tag `vX.Y.Z` (annotated):
   `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
4. Push the commit and the tag — `git push origin main --follow-tags` (the
   local config sets `push.followTags`) — which triggers the release workflow.
5. Publish the package per the distribution contract audited in
   [REGISTRY_READINESS.md](REGISTRY_READINESS.md).

## License

By contributing you agree that your contributions are licensed under the
[MIT license](LICENSE) that covers this project.
