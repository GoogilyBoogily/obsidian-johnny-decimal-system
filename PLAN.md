# Implementation Plan — obsidian-johnny-decimal-system

> Roadmap derived from auditing this repo against the reference plugin
> `pwaclawiak/johnny-decimal-plugin-obsidian` (v0.9.0). The two plugins are
> complementary: pwaclawiak is a passive rename-driven prefixing engine with no
> UI; this repo is active command/modal tooling with no event handlers. The plan
> below ports pwaclawiak's engine and roadmap onto this repo's parser/validator
> foundation, plus net-new work neither plugin has.

## Current State (audit snapshot)

**Implemented and working** (4-level model: System `H01` → Area `XX-YY` → Category `XX` → ID `XX.YY`):

- Commands: `validate`, `create-system`, `create-area`, `create-category`, `create-id`, `navigate`, `generate-jdex`
- Modals: create-system/area/category/id, navigate (`SuggestModal`), validation report
- `core/parser.ts` — parse/format/sanitize, pure functions, Obsidian-decoupled (testable)
- `core/validator.ts` — recursive 3-level scan, 11 error types
- Settings: `rootFolder`, `defaultSystemPrefix`, `ignorePatterns`, `idNoteTemplate`, `jdexPath`
- Ribbon icon → navigate modal

**No event handlers at all** — no `file-menu`, no `vault.on('rename'|'create')`. No auto-prefixing, no propagation, no context menu.

**Hygiene debt:**

- Entire plugin uncommitted. Only commit on `master` is the bare Obsidian sample template.
- `README.md` is still unmodified Obsidian sample boilerplate.
- `main.js` is a stale build artifact (predates current source; gitignored — correct).
- No tests despite `parser.ts` being pure and trivially testable.
- `manifest.json` `authorUrl` empty.

## Progress

- [x] **Phase 0** — jj colocated, README rewritten, build green (commit `9d350d86`)
- [x] **Phase 0.5** — exclusion system: `core/exclusions.ts`, settings migration, validator rewire (commit `09b55068`)
- [x] **Phase 1** — auto-prefix engine: `core/rename-engine.ts`, `vault.on('rename')` via `registerEvent`, move→category/ID assignment, propagation, strip-on-exit, exclusion-gated, toggles. (`07a6e09a`)
- [x] **Phase 1.1** — fix: Area (`XX-YY`) folders never demoted/stripped (`2ec97ec2`)
- [x] **Phase 1.5** — MODEL PIVOT: system-prefix-on-every-name → **system = top folder** + managed systems list. Clean unprefixed area/cat/ID names; system derived from path. Rewrote parser/validator; system-aware create-system/area + modals; settings systems manager; `defaultSystemPrefix`→`systems[]` migration; engine simplified (no system cascade — cross-system move = pure path change). Lint+build green.
- [ ] **Phase 2** — context-aware right-click menu
- [ ] **Phase 3** — create-time prefixing
- [ ] **Phase 4** — roadmap commands (incl. area-range renumber)
- [ ] **Phase 5** — polish + test harness

## Reference Plugin — What We Can Port

**pwaclawiak implemented:**

- Auto-prefix on move (next free prefix when item moved into a JD parent)
- Subtree prefix propagation on rename (parent prefix change cascades to children, preserving child ID digits)
- Duplicate / mismatched-prefix protection with revert + Notice
- Strip prefix when moved out of JD structure
- Flattened mode (IDs on files instead of subfolders)
- Per-root promise queue with retry/backoff; `fileManager.renameFile` for `.md` (preserves wikilinks), `vault.rename` for folders

**pwaclawiak bugs to fix on port (do NOT copy verbatim):**

- Unescaped `.` in level-2 regex `/^\d{2}.\d{2} /` → must be `/^\d{2}\.\d{2} /`
- Listener registered via raw `vault.on(...)` not `registerEvent(...)` → leaks on unload
- Next-number = highest-existing + 1, no gap fill (decide policy explicitly here)
- String comparison for capacity bound (`> "YY"`) → compare numbers

**pwaclawiak roadmap (unbuilt there — net-new for both):**

- Assign prefix on folder/file creation inside JD structure
- Command: remove prefixes from a folder's children
- Command: auto-renumber children by parent prefix (with confirm)
- Setting: block manual prefixes at levels > 2
- Multi-file move support (their queue blocks all but one)
- Visual highlight fade on plugin-driven rename
- Decouple core from Obsidian API for unit testing (this repo's `parser.ts` is already decoupled — free win)

## Exclusion System (decided design)

`ignorePatterns` today is exact-name match, validator-only (`validator.ts:220 shouldIgnore`). Insufficient: `35.00 Karakeep` is path-specific (intentional sub-11 ID), tracking dirs need whole-subtree exclusion, and exclusions must gate the new engine, not only the validator.

**Decision: subtree-inclusive exclusion.** Excluding a folder excludes that folder AND every descendant.

Replace `ignorePatterns: string[]` with `exclusions: string[]`. Match modes:

| Mode | Example | Matches |
|------|---------|---------|
| Exact path | `30-39 Knowledge & Inspiration/35 Web Resources & Sites/35.00 Karakeep` | that folder + all descendants |
| Subtree | `70-79 Journals & Self-Tracking/72 Daily Tracking` | folder + all descendants |
| Glob | `**/72 Daily Tracking/**`, `*.excalidraw` | pattern across vault |

Excluded path = **frozen**: engine assigns no prefix on move/create, propagation does not cascade into it, no revert/guard on manual names, validator emits no errors for it.

New module `core/exclusions.ts`, single pure fn:

```ts
export function isExcluded(path: string, exclusions: string[]): boolean
```

Logic: normalize path → exact match any exclusion → `path === ex || path.startsWith(ex + '/')` (subtree) → glob test (custom matcher or `picomatch`). Pure, no Obsidian import — heavily unit-tested (high-risk fn touching destructive rename paths).

Migration: old `ignorePatterns` (exact names) auto-convert to `**/<name>/**` glob once on load. User keeps config (no backwards-compat constraint, but free).

Every event handler early-returns on `isExcluded`. Context menu hides JD items on excluded folders. Validator's `shouldIgnore` rewired to call `isExcluded(path, ...)` with full path instead of bare name.

## Phased Roadmap

| Phase | Scope | Value | Risk |
|-------|-------|-------|------|
| 0 | Hygiene: commit feature work, rewrite README, rebuild `main.js`, set `authorUrl` | — | Low |
| 0.5 | **Exclusion system** — `core/exclusions.ts`, settings migration, validator rewire, tests | High | Low |
| 1 | Auto-prefix engine — `registerEvent(vault.on('rename'))`, move-prefixing + subtree propagation, per-root queue, bug-fixed regex, exclusion-aware | High | High (rename ops touch user data) |
| 2 | Context-aware right-click menu — `workspace.on('file-menu')` → existing create modals by JD level; "Exclude from JD" item writes path into `exclusions` | High | Low |
| 3 | Create-time prefixing — `registerEvent(vault.on('create'))`, reuse `create-id` auto-increment logic | Med | Med |
| 4 | Roadmap commands — remove-prefixes, renumber-children (confirm modal), block-deep-prefix setting, multi-file move queue | Med | Low |
| 5 | Polish — rename highlight fade, real-time dup/mismatch guard (wire validator pre-rename), `parser.ts` + `exclusions.ts` unit tests | Med | Low |

**Sequencing rationale:** 0.5 before 1 because the engine must be exclusion-aware from its first line — retrofitting exclusion into a live rename engine risks data damage. 2 is cheap (modals already exist) and delivers the original requested feature. 5's tests are deferred only because the suite scaffold doesn't exist yet, but `isExcluded` gets tests in 0.5 regardless.

## Open / Decided

- [x] Exclusion default scope → **subtree-inclusive** (excluding a folder excludes all under it)
- [x] Glob strategy → **minimal hand-rolled matcher** (`**` / `*` / `?`, zero deps); literal paths use exact+subtree rule
- [x] Next-number policy → **highest + 1** (JD-idiomatic, matches pwaclawiak; deleted IDs never reused)
- [x] VCS → **jj colocated** (`jj git init --colocate`), commits via jj
- [ ] Test harness: repo has no test runner. `isExcluded`/`parser` unit tests deferred to Phase 5 (needs `node:test` or vitest scaffold). Tracked, not yet built.
