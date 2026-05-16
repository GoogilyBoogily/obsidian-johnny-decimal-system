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
- [x] **Phase 1.x** — extracted `core/rename-queue.ts` (RenameQueue: `consumeEcho`/`enqueue`/`whenIdle`/`safeRename`) from RenameEngine; engine reuses it, behavior unchanged. Prereq for Phase 7. Lint+build+17 tests green.
- [x] **Phase 1.5** — MODEL PIVOT: system-prefix-on-every-name → **system = top folder** + managed systems list. Clean unprefixed area/cat/ID names; system derived from path. Rewrote parser/validator; system-aware create-system/area + modals; settings systems manager; `defaultSystemPrefix`→`systems[]` migration; engine simplified (no system cascade — cross-system move = pure path change). Lint+build green.
- [x] **Phase 6** — JDex auto-sync: shared `core/jdex.ts` (idempotent body-hash, `JD:START/END` managed region, atomic `vault.process`, foreign-content abort); `core/jdex-sync.ts` debounced (500ms resetTimer) on create/rename/delete (no `modify`), create post-`onLayoutReady`, gates (autoSyncJdex/own-path/excluded), unload flush; `generate-jdex` command reuses it; `autoSyncJdex` toggle + settings-change resync + orphaned-file Notice. Lint+build+17 tests green.
- [x] **Phase 7 v2** — automated audit fixes: `autoFixable` tag (auditor post-pass per safety tier × `auditFixMode`); `auditFixMode` setting off/safe/aggressive (default safe) + dropdown; `autoFixLoop` (re-audit→apply, max 5 passes, zero-progress bail) in audit-apply; "Audit and fix" command w/ ConfirmModal gate + kind breakdown; "Apply all safe" button in AuditReportModal. Lint+build+17 tests green.
- [x] **Phase 7 (v1)** — vault numbering audit: `core/auditor.ts` (own traversal + validateVault for system errors → declarative findings/fixes: PADDING, MISFILED_ID, DUPLICATE w/ lowest-path tiebreak, GAP=info-no-fix, SYSTEM=error-no-fix); `audit-apply.ts` via shared engine RenameQueue (deepest-first, re-resolve, no engine re-number); `AuditReportModal` (grouped, checkboxes, apply→re-audit loop); `audit-numbering` command. v2 (gap-fill, area-range remap opt-in) deferred. Lint+build+17 tests green.
- [x] **Phase 2** — context-aware right-click menu: `file-menu` event, level-aware items (system→area→category→ID) opening preselected create modals; exclude/include toggle; shared `core/creators.ts` (commands + menu reuse, no duplication). Lint+build green.
- [x] **Phase 3** — create-time prefixing: `RenameEngine.handleCreate` + `vault.on('create')` registered inside `workspace.onLayoutReady` (skips load storm); new folder/file in a JD slot auto-numbered via shared assign logic; structural/excluded items skipped. Lint+build green.
- [x] **Phase 4** — roadmap commands: "remove prefixes from children" (file-menu + command) → strips JD numbering recursively AND excludes the folder (coupled — engine is always-on, strip-alone would be re-prefixed); generic `ConfirmModal`. Multi-file move: already works (engine serializes every rename event on one chain — no global block like pwaclawiak). "Block prefixes >level 2" DROPPED — moot in the system-folder/clean-name model. Renumber/range-remap absorbed into Phase 7. Lint+build green.
- [x] **Phase 5** — polish + tests: rename-flash (CSS `jd-flash` fade + `ui/highlight.ts`, engine calls it post-rename); test harness (`node --test` + `tsx`, `npm test`) with `parser` (10) + `exclusions` (7) suites = 17 passing; `test/**` eslint-ignored (outside tsconfig project). Revert-guard for manual dup/mismatch DROPPED — engine auto-reassigns to next-free (cleaner than pwaclawiak's revert; consistent with no-backward-compat rule). Lint+build+tests green.

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

## Phase 7 — Vault Numbering Audit (design)

Goal: a command that audits the whole vault for numbering correctness and
proposes (then, on confirm, applies) fixes — beyond the passive
naming/structure errors `validateVault` already reports.

### Relationship to existing pieces

- `validateVault` (validator.ts) already detects INVALID/DUPLICATE/OUTSIDE
  name + structure errors and powers the "Validate vault" command. The audit
  **builds on** its result and adds numbering-specific analyzers + a
  remediation (fix) path. It does not replace the validator.
- The audit's apply step IS the general renumber engine. Phase 4's
  "renumber-children" / "area-range remap" roadmap items become thin callers
  of the audit fix engine — Phase 7 absorbs them (note in Phase 4).

### Numbering rules audited (system-folder model)

| Level | Rule | Severity if violated |
|-------|------|----------------------|
| System | folder `CODE Name`; CODE = `^[A-Z]\d{2}$`; registered in settings; unique | ERROR (UNKNOWN/INVALID), ERROR (DUPLICATE) |
| Area | `XX-YY` spans exactly 10; start multiple of 10; within 00–99; unique per system | ERROR |
| Category | 2-digit; within parent area `[rangeStart,rangeEnd]`; unique within area | ERROR |
| ID | `XX.YY`; `XX` **equals** parent category number; `YY` 01–99; unique within category | ERROR (misfiled / dup) |
| Any | zero-pad correct (`1.1` → `01.01`) | WARN (cosmetic but breaks sort/parse) |
| Category / ID | numbering gaps (holes in sequence) | INFO only — JD permits gaps; never auto-closed by default (renumber breaks links) |

Reuses `validateVault` for the structural subset; new analyzers add: padding
errors, gap detection (INFO), system-code/folder mismatch, and duplicate
classification with an explicit tiebreak.

### Severity model

- **ERROR** — breaks JD addressing; fixable; checked by default in preview.
- **WARN** — ambiguous or cosmetic-but-impactful (padding; a duplicate where
  "which keeps its number?" needs a rule); checked by default, tiebreak shown.
- **INFO** — gaps / non-contiguous sequences; *unchecked* by default;
  fixing = renumber = link risk, strictly opt-in.

Duplicate tiebreak rule (shown in preview before apply): keep the entry with
the lexicographically lowest path (stable, deterministic); the loser is
renumbered via the **highest + 1** policy (consistent with the engine).

### Architecture

- `core/auditor.ts` — pure: takes `validateVault` result + raw tree, emits an
  `AuditReport { findings: AuditFinding[] }`.
  `AuditFinding { severity, kind, path, message, fix?: FixAction }`.
  `FixAction` is declarative (`{type:'rename', from, to}[]`) — computed, not
  executed.
- `applyFixes(plugin, fixes)` executes them through the **shared
  recursion-safe rename** (see prerequisite) — serialized, re-resolving each
  target by path between steps (engine pattern), deepest-first (IDs →
  categories → areas) so a parent rename doesn't invalidate queued child
  paths.
- Respects exclusions: inherited via `validateVault`, and explicitly
  `isExcluded`-gated in the extra analyzers.

### Prerequisite refactor (Phase 1.x)

Extract the recursion-safe rename + serialized chain + `inFlight` guard out of
`RenameEngine` into a shared `core/rename-queue.ts`. Then `RenameEngine`, the
auditor's `applyFixes`, and Phase 4 renumber commands all reuse one
implementation instead of three copies. Small, isolated, do before Phase 7.

### UX (two-phase, no silent data loss)

1. Command **"Audit numbering"** → runs auditor → `AuditReportModal`:
   findings grouped by severity; each fixable finding has a checkbox
   (ERROR/WARN checked, INFO unchecked); duplicate tiebreaks and exact
   `from → to` renames shown.
2. **"Apply selected"** → explicit confirm → batched renames through the
   shared queue → re-audit → show residual findings. Nothing mutates without
   the confirm step. Gap-fill and area-range remap are opt-in toggles in the
   modal, default off (link-risk warning shown).

### Scope

- **v1:** report + safe fixes — padding normalization; misfiled-ID move when
  the correct target number is free; duplicate resolution with tiebreak
  preview. Read-preservation comes free via `fileManager.renameFile`.
- **v2:** gap-fill (opt-in), area-range remap (opt-in, cascades to
  categories/IDs), bulk renumber-to-compact.
- **Out of scope:** rewriting link text beyond what `fileManager.renameFile`
  already preserves; editing note bodies.

### Build order

1. Phase 1.x prerequisite: extract shared `rename-queue.ts`; engine reuses it
   (no behavior change — verify in test vault).
2. `core/auditor.ts` analyzers + `AuditReport` types (pure, unit-testable).
3. `AuditReportModal` (grouped, checkboxes, tiebreak/from→to display).
4. `applyFixes` via shared queue (deepest-first, re-resolve by path).
5. "Audit numbering" command wiring + re-audit-after-apply loop.
6. v2 opt-in fixers (gap-fill, range remap).

### Open

- [ ] Should "Audit numbering" auto-run after big operations, or stay
      manual-only? (Lean: manual command in v1; optional post-op nudge later.)
- [ ] Gap INFO: surface always, or behind a "show gaps" toggle to reduce
      noise in large vaults? (Lean: behind toggle, default off.)

## Phase 7 v2 — Automated Fixes (design)

Goal: apply audit fixes without per-finding manual checkbox selection,
without violating the no-silent-data-loss rule.

### Safety tiers (auto-apply is gated by kind, not blanket)

| Kind | Tier | Auto? | Reason |
|------|------|-------|--------|
| PADDING | SAFE | yes | Zero-pad only; no JD address change; links preserved via `fileManager.renameFile` |
| MISFILED_ID (target free) | SAFE | yes | Moves to its correct number; target verified free; reversible |
| MISFILED_ID (target occupied) | — | no | Already no `fix` in v1 — manual |
| DUPLICATE | RISKY | only in `aggressive` mode | Silently changes a user note's JD address — needs explicit opt-in |
| GAP | INFO | never | No fix; renumber = link risk |
| SYSTEM | ERROR | never | No auto-fix; user must register/rename |

Auditor sets a new `autoFixable: boolean` per finding: PADDING → true;
MISFILED_ID → true iff target free; DUPLICATE → true only when the
`aggressive` setting is on; others → false.

### Setting

`auditFixMode: 'off' | 'safe' | 'aggressive'` (default `'safe'`).
- `off` — manual modal only (current v1 behavior).
- `safe` — PADDING + free MISFILED_ID auto-eligible.
- `aggressive` — additionally DUPLICATE (tiebreak renumber) auto-eligible.

### Command + convergence loop

New command **"Audit and fix"**:
1. `auditVault` → filter `findings.filter(f => f.autoFixable && f.fix)`.
2. If none → Notice "nothing to auto-fix". Else **ConfirmModal**:
   "Apply N safe fixes? (K padding, M misfiled, …)" — one gate, not zero.
3. On confirm → `applyFixes` (reuses v1: shared RenameQueue, deepest-first,
   re-resolve) → re-audit → repeat.
4. **Convergence guard:** max 5 passes; also bail early if a pass applies
   0 fixes (a permanently-blocked fix, e.g. collision) to avoid an infinite
   loop. Renames change paths, so re-audit between passes is required.
5. Final Notice: "Fixed N; M issues remain — open Audit to review."

### Modal addition

`AuditReportModal` gains an **"Apply all safe"** button: checks every
`autoFixable` finding then runs the same apply+re-audit loop. Keeps the
existing per-finding checkboxes for selective manual fixing.

### Deferred (documented risky)

Event-driven auto-fix (run a SAFE pass automatically after vault changes,
debounced like JDex-sync) is **not** in v2 — high blast radius, surprising
silent renames. Revisit only behind `aggressive` + a separate explicit
toggle, with the risk spelled out.

### Build order

1. `autoFixable` on `AuditFinding`; auditor sets it per tier (+ `aggressive`).
2. `auditFixMode` setting + UI (off/safe/aggressive).
3. "Audit and fix" command: ConfirmModal gate + convergence loop (max 5,
   zero-progress bail) + summary Notice.
4. "Apply all safe" button in `AuditReportModal`.

### Open

- [ ] Convergence cap 5 — enough for realistic vaults? (padding/misfiled
      converge in 1–2 passes; cap is just a cycle safety net.)
- [ ] Should `safe` be the default, or `off`? (Lean `safe`: padding/misfiled
      are low-risk and the ConfirmModal still gates execution.)

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
