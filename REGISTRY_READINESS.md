# Registry Readiness Spec — get `code-intel` listed on every public DSH plugin portal

**Goal:** `code-intel` should be discoverable and installable from every public DeepSeek Harness plugin
registry (dsh-plugins.org, dsh.pub, dsh-plugin-shop, DSHPlugin, DSH Plugin Registry, DSH Plugins,
awesome-dsh-plugin / dshmarket) without manual lobbying.

**Verdict of the audit:** the plugin itself is solid — the **distribution contract** is what is broken.
Today the package is not published anywhere, cannot be published under its current name, is missing a
license file, and its repository carries no discovery signals. Fixing distribution — not code — is the
entire remaining hill.

### Progress (2026-11-11)

Implemented: renamed to `code-intel` (patch row, client factory ID, remote envelope, tab ID, tests),
fixed `repository`/`homepage`/`bugs`, LICENSE added, `lib/` un-ignored for git installs, `dsh.catalog`
declared, version gates harmonized to `>=0.2.2-rc.1`, README install section + disclaimer. Build, typecheck
and all 25 tests pass after the rename.

**Remaining manual steps:** publish to npm, add the `dsh-plugin` GitHub topic (needs `gh auth login`),
then the P2 portal submissions.

---

## 1. How the portal ecosystem actually works

No portal hand-curates the world. Each one crawls two public signals and then applies automated gates.
This is the "ethics" part: **there is nothing to submit to most portals — you make the package
machine-verifiable and they pick it up.**

### 1.1 The two universal discovery signals

| Signal | Who reads it | How to set it |
| --- | --- | --- |
| npm `keywords` containing `dsh-plugin` **or** `deepseek-harness` | dsh-plugin-shop, @dsh-pm/registry, dsh.pub (partial), npm-search-based indexes | `"keywords": ["dsh-plugin", "deepseek-harness", …]` in the published `package.json` |
| GitHub repository **topic** `dsh-plugin` / `deepseek-harness` | dsh-plugins.org, DSHPlugin, dsh-plugin-shop (GitHub fallback), @dsh-pm/registry | Repo → Settings → Topics, or `gh repo edit --add-topic dsh-plugin` |

> `package.json` **already declares both keywords.** The keyword half of the contract is already met —
> it is doing nothing because the package was never published, and could not be under its current name.

### 1.2 The portals and their gates

| Portal | What it crawl-checks | What it requires to list |
| --- | --- | --- |
| **dsh-plugin-shop** (LivXue, daily build) | npm keyword + GitHub topic | 5 gates: (1) valid `dsh.bundle`; (2) license + accessible source repo; (3) not deprecated, no install build scripts / `workspace:` deps; (4) credible metadata (integrity, publish time, non-misleading name); (5) a `dsh.catalog` or npm `description` to display |
| **dsh-plugins.org** (lwmxiaobei/dsh-plugins, ≤15 min sync) | GitHub `dsh-plugin` topic | Public repo, complete plugin manifest, valid package info, installable from default branch |
| **dsh.pub** (14,851 entries) | PR submission (+ auto-discovery) | Public Git repo, **committed** runtime artifacts at root (or documented subpath): `package.json`, `dsh.bundle.patch` file, built entries, README, **LICENSE file**. PR is auto-merged when checks pass |
| **DSHPlugin** (dshplugin.org) | GitHub | Public repo with valid bundle manifest |
| **DSH Plugin Registry** (dshplugin.app) | ecosystem crawl + submission form | Classification checks source evidence, package/bundle metadata, install info, plugin identity before publishing |
| **DSH Plugins** (dshplugins.ai) | editorial form | Public GitHub repo, `package.json` with `dsh.bundle`, README, open-source license → human review ≤48 h |
| **awesome-dsh-plugin** (also the `dsh-plugin-catalog` npm index + dshmarket in-app market) | curated PR | Installs with `dsh plugin add`, **does what its one-line description says**, sits in the right category, is maintained. Claims are verified against source (if it says "8 tools", someone counts them) |
| **@dsh-pm/registry / dsh pm** | awesome list + GitHub topic + npm keyword | Merged automatically from the three sources |

Two more things worth knowing:

- **Ranking is social-proof based.** dsh.pub and dsh-plugins.org order by GitHub stars; dshmarket's
  "most installed" ranks by weekly npm downloads. A good README, screenshots, and being genuinely
  useful move you up — nothing else does.
- **The DSH client itself can load indexes** (the built-in "Custom plugin indexes" plugin →
  Plugins → Discover → Index sources). The awesome-dsh-plugin index (`dsh-plugin-catalog` on npm) is
  the de-facto default, so a curated listing there also reaches users who never visit a website.

### 1.3 The shared social contract (all portals, summarized)

1. **Be discoverable** — npm keyword or GitHub topic.
2. **Be installable** — `dsh.bundle.patch` pointing at a real in-package file; `exports`/`main`
   resolve to committed/published artifacts; patch row `name` == installed package name; no install-time
   builds; no `workspace:` ranges in a published package.
3. **Be reviewable** — an OSI license, **both** in `package.json` and as a repo LICENSE file; a public,
   accessible repository.
4. **Be non-deceptive** — no reserved-scope or impersonating names, no fake stats; listing ≠ endorsement,
   so do not claim verification you do not have.
5. **Be legible** — a one-line npm `description`, or better a `dsh.catalog` section; an icon helps.
6. **Stay healthy** — never unpublish a listed version (deprecate instead), keep installing, keep maintained.

---

## 2. Current-state audit

Repo: `github.com/legen07/code-intel` (public, 3 commits) · Local version `0.2.0` · `prepack` passes.

| # | Check | State | Evidence / impact |
| --- | --- | --- | --- |
| 1 | Published to npm | ❌ **Fail** | `registry.npmjs.org/@deepseek-ai/code-intel` → 404. Nothing that harvests npm (dsh-plugin-shop, dsh pm, dshmarket) can see the plugin at all |
| 2 | Publishable package name | ❌ **Fail** | Name uses the **reserved `@deepseek-ai` scope**. dsh.pub: *"Do not publish community code under the reserved `@deepseek-ai` scope"*; the shop rejects "potentially misleading names". The scope is also DeepSeek's own npm org — `legen07` cannot publish into it in the first place |
| 3 | `repository` field | ❌ **Fail** | `package.json` says `github.com/your-org/code-intel.git` (placeholder) — the shop's "accessible source repository" gate fails; registries cannot link the card to source |
| 4 | GitHub topic `dsh-plugin` | ❌ **Fail** | Repo has **zero topics** — invisible to dsh-plugins.org, DSHPlugin, topic-based crawlers |
| 5 | LICENSE file | ❌ **Fail** | `license: "MIT"` is declared but no LICENSE file exists. dsh.pub and dshplugins.ai **require** the file; the shop's reviewability gate fails |
| 6 | Committed build artifacts | ❌ **Fail** | `.gitignore` excludes `lib/`. GitHub-based listings (dsh.pub, shop, dsh-plugins.org) refuse this as `requires-build` — the git tree does not contain what the patch inserts |
| 7 | `dsh.bundle` contract | ✅ Pass | `dsh.bundle.patch` → existing `cordis.patch.yml` |
| 8 | Discovery keywords | ✅ Pass | `deepseek-harness` + `dsh-plugin` both present (dormant until #1/#2 are fixed) |
| 9 | Runtime entries | ✅ Pass | `exports` map resolves; `prepack` asserts `lib/index.js`, `lib/client.js`, types, patch |
| 10 | Display info | ⚠️ Weak | npm `description` exists (shop falls back to it), but no `dsh.catalog` → category auto-assigned, no zh summary, no capabilities. No icon |
| 11 | `files` whitelist | ⚠️ Minor | Lists `docs/` which does not exist; omits `LICENSE` |
| 12 | Version gates consistent | ⚠️ Minor | `dsh.engines.dsh: ">=0.2.1-rc.5"` vs peers `@deepseek-ai/dsh-*: ">=0.2.2-rc.1"` — dsh checks those peers against the running version; the floors disagree, so engines can pass while peers refuse |
| 13 | README install path | ⚠️ Minor | Explains enabling, but no copy-paste `dsh plugin add` command, no compatibility/licensing section, no disclaimer |

**Root cause in one line:** the plugin was built as a working artifact, not as a distributable product —
it fails the distribution contract at the very first step (name + publication).

---

## 3. The work — ordered

### P0 · unblock everything

**3.1 Rename the package off the reserved scope**
Choose a name you own and that does not imply official DeepSeek authorship. Options:

- `dsh-code-intel` (recommended — matches the ecosystem's `dsh-*` naming, ranks well in npm/topic search)
- `@legen07/code-intel` (keeps scope identity; still clearly community)

The installed package name is **runtime identity**: the row in `cordis.patch.yml` must be updated to the
exact same string, e.g.:

```yaml
- insert:
    - id: code-intel
      name: 'dsh-code-intel'
```

Also fix `repository` and add `homepage`/`bugs`:

```json
"repository": { "type": "git", "url": "git+https://github.com/legen07/code-intel.git" },
"homepage": "https://github.com/legen07/code-intel#readme",
"bugs": { "url": "https://github.com/legen07/code-intel/issues" },
```

**3.2 Add a LICENSE file** — MIT text with `Copyright (c) 2026 legen07`. Add `"LICENSE"` to `files`.

**3.3 Commit the built bundle** — remove `lib/` from `.gitignore` (keep `node_modules`, `.tmp`, etc.).
Git installs, dsh.pub validation, and the shop's GitHub listing all need `lib/index.js` /
`lib/client.js` present in the tree. Keep `prepack` as the safety net.

**3.4 Add the GitHub topic** — `gh repo edit legen07/code-intel --add-topic dsh-plugin --add-topic deepseek-harness --add-topic cordis --add-topic lsp` (deepseek-harness + dsh-plugin are the crawl keys; the rest aid human search).

**3.5 Publish to npm**

```sh
bun run build && bun run check && npm pack --dry-run   # confirm tarball contents
npm publish --access public
```

Verify the published metadata: `npm view dsh-code-intel keywords repository license` must show the
discovery keywords, the real repo, and MIT. Within ~1 day the shop's daily build lists it; the npm
side of every other index sees it too. **Never `npm unpublish` a listed version** — deprecate instead
(`npm deprecate <pkg>@<ver> "reason"`), or the shop records `npm-gone` and readers' installs break.

### P1 · control your listing (do these before/at the same publish)

**3.6 Declare `dsh.catalog`** — takes ownership of category, summaries, capabilities. If declared, **both
languages are mandatory** and unknown fields are rejected outright (not ignored):

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "catalog": {
    "category": "tool",
    "summary": {
      "en": "LSP-backed code intelligence for DSH agents: symbol search, references, a persisted project blueprint graph, and a symbol-browser sidebar.",
      "zh": "为 DSH 智能体提供 LSP 支撑的代码智能：符号搜索、引用查找、持久化项目蓝图图谱与符号浏览器侧栏。"
    },
    "capabilities": ["tools", "lsp", "codegraph", "sidebar"]
  }
}
```

Shop categories: `tool` | `provider` | `ui` | `workflow` | `integration` | `theme` | `other`.
Whole published entry must stay under **12 KiB UTF-8** (we are nowhere near it). Summaries ≤200 chars each.

**3.7 Add an icon** — `"icon": "docs/icon.svg"` (or PNG/JPEG/WebP), ≤32 KiB for the shop (DSH's own page
allows 256 KiB), inside `files`. Fixed colors, not `currentColor` (renders black on dark theme).
Missing icon never costs the listing — it only improves the card.

**3.8 Harmonize version gates**

```json
"engines": { "node": ">=20" },
"dsh": {
  "engines": { "dsh": ">=0.2.2-rc.1" },
  "compatibility": { "dsh": ">=0.2.2-rc.1", "profiles": ["web"] }
}
```

`dsh.engines.dsh` is the install gate; `dsh.compatibility` is what the shop surfaces as a warning
(optional — never a refusal). Keep them equal to the true floor, i.e. what the `@deepseek-ai/dsh-*`
peers already demand. If `dshReleases` is needed for a specific runtime release map, keep it — the shop
drops unrecognized halves silently — but do not rely on it for listing.

**3.9 Fix `files`** — `"files": ["lib/", "cordis.patch.yml", "docs/", "README.md", "LICENSE"]` and make
`docs/` real (icon lives there), or drop the entry.

**3.10 README upgrade for registries** — add near the top:

```sh
dsh plugin --profile web add dsh-code-intel
```

plus a **Compatibility** line (DSH `>=0.2.2-rc.1`, `web` profile, Node ≥20), a screenshot of the
symbol-browser sidebar (several portals surface screenshots; dshmarket has a whole section for them),
and a one-line **"Community plugin. Not affiliated with DeepSeek."** disclaimer — essential given the
old name. Keep the tool table honest (8 tools — they will count it).

### P2 · reach the curated / editorial portals

After P0–P1 land on the default branch and npm:

1. **awesome-dsh-plugin** — open a PR adding one line under *Development & Runtime* (or *Tools &
   Capabilities*):

   `- [legen07/code-intel](https://github.com/legen07/code-intel) - One-line: LSP-backed symbol search, references and a persisted project blueprint graph for DSH agents, with a symbol-browser sidebar.`

   The bar: installs with `dsh plugin add`, does what the line says, right category, maintained.
   This one PR also propagates to **dshmarket's in-app market, the `dsh-plugin-catalog` npm index,
   the Discover-tab index, and every downstream client that ships dsh-market** — the single highest-leverage
   submission in the ecosystem.
2. **dsh.pub** — open the [submit page](https://dsh.pub/en/submit/), paste the repo URL; it opens a PR
   whose checks validate the pinned commit (this is why lib/ must be committed). On merge, grab the
   live "listed" badge for the README.
3. **dshplugin.app** — [submission form](https://dshplugin.app/submit) (repo URL + optional email).
4. **dshplugins.ai** — [submission form](https://dshplugins.ai/submit) (repo URL + email, ≤48 h review).
5. **dsh-plugins.org / DSHPlugin / dsh-plugin-shop / dsh pm** — nothing to submit; the topic + npm
   keyword already feed them. If a listing never appears, check the **build report**
   (`LivXue.github.io/dsh-plugin-shop/v1/report.md`) — it names every rejected plugin and the exact reason.
6. **Tag releases** — `git tag v0.2.0` on the published commit; several portals pin/present versions,
   and a tagged tarball can rescue a GitHub listing that would otherwise need committed builds.

### P3 · keep it listed (the ongoing ethics)

- Do not unpublish; deprecate. Keep the default branch installing at all times.
- Keep claims true: tool counts, "read-only", version support — every curated portal re-checks them.
- Triage the shop's build report after each release if a listing goes missing (`fetch-failed` retries
  next build; field-bound failures do not).
- Answer issues on `legen07/code-intel`; unmaintained entries get removed from the curated lists.
- Listing is not a security review — never present it as one.

---

## 4. Verification (definition of done)

- [ ] `npm view <name>` shows `dsh-plugin` + `deepseek-harness` keywords, real repository, MIT
- [ ] `npm pack --dry-run` lists `lib/index.js`, `lib/client.js`, `cordis.patch.yml`, `LICENSE`, README
- [ ] Fresh-profile install from the public artifact, not the local checkout:
      `export DSH_HOME="$(mktemp -d)"; dsh plugin --profile web add <name> && dsh --profile web --no-open --port 0`
      then confirm the bundle mounts and the 8 tools appear
- [ ] `dsh --profile web --dump-config` shows the `code-intel` bundle row resolving to the new package name
- [ ] GitHub repo has `dsh-plugin` topic; LICENSE, lib/, icon committed on the default branch
- [ ] Appears in dsh-plugin-shop's catalog (checked via its `v1/index.json`) and on dsh-plugins.org
- [ ] dsh.pub PR merged, badge live in README
- [ ] awesome-dsh-plugin PR merged → present in dshmarket and the Discover index
- [ ] One-line description in every portal matches the README claim (8 tools, read-only v1, web profile)

---

## Sources

- [dsh-plugin-shop README](https://github.com/LivXue/dsh-plugin-shop),
  [catalog schema doc](https://github.com/LivXue/dsh-plugin-shop/blob/main/docs/schema.md) — gates,
  `dsh.catalog`, icon rules, 12 KiB budget, peer/version semantics, `requires-build`
- [dsh-plugins.org](https://dsh-plugins.org/) — topic discovery + manifest validation (source: [lwmxiaobei/dsh-plugins](https://github.com/lwmxiaobei/dsh-plugins))
- [dsh.pub](https://dsh.pub/en/) / [submit](https://dsh.pub/en/submit/) /
  [develop-plugin.md](https://dsh.pub/develop-plugin.md) — bundle contract, reserved-scope rule,
  LICENSE/committed-artifact admission, PR workflow
- [dshplugin.app](https://dshplugin.app/plugins) / [submit](https://dshplugin.app/submit)
- [dshplugins.ai/submit](https://dshplugins.ai/submit)
- [awesome-dsh-plugin](https://awesome-dsh-plugin.com/) (via
  [raw README](https://raw.githubusercontent.com/awesome-dsh-plugin/awesome-dsh-plugin/main/README.md)) —
  listing criteria + index distribution; [dshmarket.com](https://dshmarket.com/) for the in-app market
- [@dsh-pm/registry](https://github.com/Jesse-njx/dsh-plugin-manager-registry) — the three-source merge
- Live check: `registry.npmjs.org/-/v1/search?text=keywords:dsh-plugin` (14,275 hits) and
  `registry.npmjs.org/@deepseek-ai/code-intel` (404) on 2026-11-11
