# Johnny Decimal System

An Obsidian plugin for building, maintaining, validating, and navigating a
[Johnny Decimal](https://johnnydecimal.com) structure in your vault — with an
always-on engine that auto-numbers things as you create, move, and rename them.

## The model

Four levels, mapped onto real folders/notes. **Names are clean** — the system
is a folder layer, not a prefix smeared onto every name.

| Level    | Format            | Example              | Vault representation              |
|----------|-------------------|----------------------|-----------------------------------|
| System   | `CODE Name` (opt) | `H01 Personal`       | Top-level folder                  |
| Area     | `XX-YY Name`      | `10-19 Life admin`   | Folder (in a system, or at root)  |
| Category | `XX Name`         | `11 Travel`          | Folder inside an area             |
| ID       | `XX.YY Name`      | `11.01 NYC Trip`     | `.md` file inside a category      |

- **Single-system vault:** register no systems — areas live at the root.
- **Multi-system vault:** register systems in settings; each becomes a
  `CODE Name` folder containing its own areas. The full ID (`H01.11.01`) is
  derived from the path, never stored in the filename.

## Features

### Auto-prefix engine (always on, toggleable)
- Move a folder into a system → next free **area** range (`X0-X9`).
- Move a folder into an area → next free **category** number.
- Move a `.md` into a category → next free **ID** (`XX.YY`).
- Edit a category's number → its child ID files are rewritten to match.
- Move an item out of the JD structure → its prefix is stripped.
- Create things manually (new folder/note) → numbered the same way.
- System/Area folders are never demoted or stripped; numbering policy is
  highest-existing + 1; wiki-links are preserved on every rename.

### Right-click menu (context-aware)
Right-click a folder → the offered action depends on its level (system → "New
area", area → "New category", category → "New ID"). One name prompt, number
auto-assigned. Plus a one-click **exclude / include** toggle.

### Exclusions
Path-based, **subtree-inclusive** (excluding a folder freezes everything under
it). Supports exact paths and globs (`**`, `*`, `?`). Excluded paths get no
auto-numbering and no validation errors.

### JDex auto-sync
A generated index (`JDex.md`) kept current automatically on
create/rename/move/delete, debounced and idempotent. Generated content lives
in a managed `<!-- JD:START -->`…`<!-- JD:END -->` region — your own text
outside it is preserved.

### Validate & audit
- **Validate vault** — structural error report (invalid/duplicate/misplaced
  names, out-of-range, orphans, unknown systems).
- **Audit numbering** — deeper numbering analysis with applicable fixes:
  padding, misfiled IDs, duplicate renumber (lowest path keeps its number),
  gap detection (info only). Preview modal with per-finding checkboxes.
- **Audit and fix** — applies safe fixes unattended behind one confirm gate,
  re-auditing until stable (`auditFixMode`: off / safe / aggressive).

### Navigate
Fuzzy-search every ID by number or name; ribbon icon or command.

All actions are in the command palette.

## Settings

| Setting | Purpose |
|---------|---------|
| Root folder | Where the JD structure starts (empty = vault root). |
| Systems | Managed list (`code` + `name`); empty = single-system. |
| Auto-prefix on move and rename | Master switch for the engine. |
| Strip prefix when moved out | Drop the prefix when leaving the structure. |
| Exclusions | Vault paths/globs to freeze (one per line, subtree-inclusive). |
| Auto-sync JDex | Keep `JDex.md` current automatically. |
| JDex path | Index file path (relative to root). |
| Audit auto-fix mode | `off` / `safe` / `aggressive` — what "Audit and fix" applies. |

## Installation (manual)

1. `npm install && npm run build`
2. Copy `main.js`, `manifest.json`, `styles.css` into
   `<Vault>/.obsidian/plugins/johnny-decimal/`
3. Reload Obsidian → enable in Settings → Community plugins.

## Development

```bash
npm install     # dependencies
npm run dev     # watch build
npm run build   # type-check + production bundle
npm run lint    # ESLint (eslint-plugin-obsidianmd)
npm test        # node --test (parser + exclusions unit tests)
```

Architecture is in `CLAUDE.md`; phased roadmap and design decisions in
`PLAN.md`.

## License

0-BSD.
