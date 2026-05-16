# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project Overview

Obsidian plugin implementing the Johnny Decimal system. TypeScript + esbuild,
Obsidian Plugin API. An always-on engine auto-numbers items on
create/move/rename; supporting commands validate, audit, navigate, and index.

## Commands

```bash
npm install      # deps
npm run dev      # watch build
npm run build    # tsc -noEmit -skipLibCheck && esbuild production
npm run lint     # eslint . (eslint-plugin-obsidianmd)
npm test         # node --test + tsx (parser + exclusions suites)
```

## Johnny Decimal Structure (system-as-folder model)

| Level    | Format            | Vault representation             |
|----------|-------------------|----------------------------------|
| System   | `CODE Name` (opt) | Top-level folder (`H01 Personal`)|
| Area     | `XX-YY Name`      | Folder inside a system / at root  |
| Category | `XX Name`         | Folder inside an area             |
| ID       | `XX.YY Name`      | `.md` inside a category           |

**Names are CLEAN — no system prefix in any name.** The system is derived from
the folder path. Single-system = no registered systems, areas at root.
Multi-system = registered `systems` list, each a `CODE Name` folder. Full ID
(`H01.11.01`) is composed for display/links only (`formatFullId`).

## Architecture

**Entry point:** `src/main.ts` → bundled to `main.js`.

```
src/
  main.ts              # lifecycle: settings load+migrate, register commands,
                        # RenameEngine (rename + create-after-onLayoutReady),
                        # file-menu, JdexSync, ribbon
  settings.ts          # JDSettings, defaults, migrations, settings tab
  types.ts             # JD*, Parsed*, Validation*, Audit* types
  commands/            # one file per command, registered via index.ts
    create-{system,area,category,id}.ts  navigate.ts  validate.ts
    generate-jdex.ts  remove-prefixes.ts  audit.ts  audit-fix.ts
  core/
    parser.ts          # regex parse/format/sanitize (pure, no obsidian dep)
    validator.ts       # system-aware structural scan → ValidationResult
    exclusions.ts      # isExcluded(): exact + subtree + minimal glob (pure)
    rename-queue.ts    # RenameQueue: echo-guard + serialized chain + safeRename
    rename-engine.ts   # RenameEngine: auto-prefix on rename/create/move
    creators.ts        # shared create{System,Area,Category,Id}/createNext*
    strip.ts           # unJd(): exclude folder + strip descendant prefixes
    jdex.ts            # buildBody + idempotent writeJdex (managed region)
    jdex-sync.ts       # JdexSync: debounced auto-regen on vault events
    auditor.ts         # auditVault(): numbering findings + declarative fixes
    audit-apply.ts     # applyFixes / autoFixLoop via shared RenameQueue
  ui/
    *-modal.ts  file-menu.ts  highlight.ts  name-prompt-modal.ts
test/
  parser.test.ts  exclusions.test.ts   # node --test, eslint-ignored
```

**Data flow:** vault events → `RenameEngine`/`JdexSync` (via `RenameQueue`);
commands → `ui/` modals → `core/creators`/`auditor` → `RenameQueue`.

**Build output:** `main.js` + `manifest.json` + `styles.css`.

## Key Patterns

- **Clean names, path-derived system.** Never put a system code in an
  area/category/ID name. `parser.ts` is the only place for regex/format.
- **RenameQueue is the single rename primitive.** Engine, audit-apply, and
  strip all route renames through `plugin.engine.queue` so the echo-guard
  (`consumeEcho`) + serialized `chain` are shared — nothing re-numbers
  another subsystem's writes. `whenIdle()` to await drain.
- **Exclusion is subtree-inclusive** and gates every subsystem
  (`isExcluded(path, settings.exclusions)`).
- **Idempotent JDex.** Hash only the structural body; skip the write when
  unchanged. `modify` is intentionally NOT watched (kills self-write loop);
  `create` is registered inside `workspace.onLayoutReady` (skips load storm).
- **Audit fixes are declarative** (`FixAction.renames`), applied deepest-path
  first, targets re-resolved at exec time. `autoFixable` set by one auditor
  post-pass per safety tier × `auditFixMode`.
- **No backward-compat shims** (user rule). Old settings keys are dropped via
  one-time migrations in `main.ts loadSettings`.
- **Engine numbering policy:** highest-existing + 1; never reuse a deleted
  number; never auto-close gaps (link safety).

## ESLint

`eslint-plugin-obsidianmd`. `obsidianmd/ui/sentence-case` flags proper nouns
("Johnny Decimal", "JD", "JDex"). Disable on the line *immediately preceding
the flagged string literal* (not the `new Setting(...)` line):

```ts
// eslint-disable-next-line obsidianmd/ui/sentence-case
.setDesc('… JDex …')
```

Template literals are not flagged (only plain string literals).

## Testing

```bash
npm test   # parser + exclusions unit suites (pure modules)
# manual: cp main.js manifest.json styles.css \
#   <Vault>/.obsidian/plugins/johnny-decimal/   (folder = plugin id)
```

## References

- `PLAN.md` — phased roadmap + locked design decisions (Phases 0–7).
- `AGENTS.md` — Obsidian plugin dev conventions.
- API docs: https://docs.obsidian.md
