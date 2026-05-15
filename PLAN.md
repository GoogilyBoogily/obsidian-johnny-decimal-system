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
- [ ] **Phase 6** — JDex auto-sync (design locked, see below)
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

## Phase 6 — JDex Auto-Sync (design)

Goal: keep the JDex file current automatically on create / rename / move /
delete, efficiently and without loops or fighting the rename engine.

### Core decision: debounced idempotent regen, NOT an incremental delta-map

Researched both. The JD tree is small (hundreds–low-thousands of nodes) and
`validateVault` is a pure in-memory `TFolder.children` walk with zero disk
I/O — the only expensive operation is the file write. A Dataview-style
in-memory `Map<path,node>` with per-event deltas would add significant bug
surface (folder-burst re-keying, ordering) for negligible gain. Chosen
design: **re-run `validateVault` and regenerate, debounced, and skip the
write when content is unchanged.**

### Why a trailing debounce also solves the hard problems

1. **Folder rename/move/delete fires a burst** (Obsidian emits one event for
   the folder *plus one per descendant* — confirmed via Dataview source +
   Obsidian forum). A `debounce(fn, ~500ms, resetTimer:true)` coalesces the
   whole burst into one regen.
2. **Engine-ordering hazard disappears.** `assignArea`/`assignCategory` →
   folder rename → `propagateCategory` child renames each fire more rename
   events that keep resetting the debounce timer. Regen only runs once the
   vault goes quiet, so it always reads the engine's *final* names. → We do
   NOT need to expose `RenameEngine.inFlight`/`chain` (they stay private).
3. **`modify` is ignored entirely.** JDex indexes structure/paths, not note
   contents, so a note edit is irrelevant. Not subscribing to `modify`
   removes the largest self-write-loop vector outright.

### Event wiring

- Subscribe via `this.registerEvent(this.app.vault.on(...))` for
  `create`, `delete`, `rename` only (no `modify`).
- Register the `create` handler **inside `this.app.workspace.onLayoutReady(...)`**
  so the initial vault-load `create` storm is skipped; do the first JDex
  build in that same callback. `delete`/`rename` register in `onload()`.
- Every handler, first lines: ignore if `!settings.autoSyncJdex`; ignore if
  `file.path` is the resolved JDex path; ignore if
  `isExcluded(file.path, settings.exclusions)` (same gate as the engine).
  Then call the shared debounced `scheduleSync()`.

### Self-write-loop defense (layered)

1. Path-exclude the resolved JDex path (`rootFolder/jdexPath`) in every handler.
2. Content-hash short-circuit: hash the generated body (excluding the
   volatile `*Generated:* ` line); if equal to last write, skip the write —
   no `create`/`rename` echo, no churn.
3. Don't subscribe to `modify` at all.

### Write path

- Factor `generate-jdex.ts:12-94` into a shared
  `buildJdexContent(plugin): string` + `writeJdex(plugin, content)`; the
  command and the syncer both call it (no duplication).
- Use `vault.process(file, fn)` (atomic read-modify-write) when the file
  exists, `vault.create` when not.
- **Idempotence fix:** drop the per-run date stamp from the hashed region
  (or move it outside a managed block) so an unchanged structure produces
  byte-identical managed content.
- **Preserve user edits (optional, recommended):** wrap generated output in
  `<!-- JD:START -->` / `<!-- JD:END -->` markers; `vault.process` replaces
  only that region, leaving any user-authored text outside it intact. If
  the file exists without markers and has non-trivial content, abort + Notice
  rather than clobber.

### Settings

- New toggle `autoSyncJdex` (default true), mirrors `autoPrefixEnabled`.
- A change to `jdexPath`, `rootFolder`, `systems`, or `exclusions` triggers a
  resync. If `jdexPath`/`rootFolder` changed, the old JDex file is orphaned —
  Notice the user (no auto-delete; respects the no-silent-data-loss rule).

### Lifecycle / safety

- Debouncer flushed on unload: `this.register(() => this.sync.run())` so a
  pending write is not lost.
- `debounce(..., 500, true)` — 500 ms field-tested to outlast large
  folder-rename descendant trains.
- External (outside-Obsidian) renames are not caught by `vault.on('rename')`
  (they surface as delete+create) — acceptable; both are still handled.

### Build order within the phase

1. Extract `buildJdexContent` / `writeJdex` shared module; make content
   idempotent (timestamp out of hashed region); content-hash guard.
2. `autoSyncJdex` setting + toggle UI.
3. `JdexSync` class: debounced `scheduleSync`, event handlers, gates,
   `onLayoutReady` create registration, unload flush.
4. Optional managed-region (`JD:START/END`) preservation.
5. Settings-change resync + orphaned-file Notice.

### Open

- [ ] Managed-region markers in v1, or full-file ownership in v1 + markers later?
      (Lean: markers in v1 — cheap, prevents clobbering user notes in JDex.)
- [ ] Per-system JDex sectioning is currently absent (flat range-sorted);
      out of scope for sync, tracked as a separate JDex-format improvement.

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
