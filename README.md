# Johnny Decimal System

An Obsidian plugin for building, validating, and navigating a [Johnny Decimal](https://johnnydecimal.com) organizational structure in your vault.

## What it does

The plugin manages a four-level hierarchy that maps directly onto folders and notes:

| Level    | Format           | Example             | Vault representation     |
|----------|------------------|---------------------|--------------------------|
| System   | `SYS` (optional) | `H01`               | Prefix on all names      |
| Area     | `XX-YY Name`     | `10-19 Life admin`  | Folder                   |
| Category | `XX Name`        | `11 Travel`         | Folder inside an area    |
| ID       | `XX.YY Name`     | `11.01 NYC Trip`    | `.md` file in a category |

Systems are optional. Single-system vaults omit the prefix; multi-system vaults prepend it (e.g. `H01.10-19 Life admin`).

## Features

- **Create system** — set an optional system prefix (`H01`) for multi-system vaults.
- **Create area** — pick an unused `XX-YY` range; used ranges are skipped automatically.
- **Create category** — pick an area, then an unused category number within its range.
- **Create ID** — pick a category; the next ID number is auto-assigned and a note is created from your template.
- **Quick navigate** — fuzzy-search every ID by number or name and jump straight to the note.
- **Validate vault** — recursively scans the structure and reports 11 classes of error (invalid/duplicate/misplaced names, out-of-range categories and IDs, orphan files, and more) with suggested fixes.
- **Generate JDex** — builds or updates a Markdown index of the whole system.

All actions are available from the command palette, and a ribbon icon opens Quick navigate.

## Settings

| Setting | Purpose |
|---------|---------|
| Root folder | Where the JD system starts (empty = vault root). |
| Default system prefix | System prefix for multi-system vaults (format: letter + 2 digits). |
| Ignore patterns | Folder names skipped during validation (exact match, comma-separated). |
| ID note template | Template for new ID notes. Supports `{{name}}`, `{{date}}`, `{{id}}`. |
| JDex path | Path for the generated index file, relative to the root folder. |

## Installation (manual)

1. Build the plugin: `npm install && npm run build`.
2. Copy `main.js`, `manifest.json`, and `styles.css` into `<Vault>/.obsidian/plugins/johnny-decimal/`.
3. Reload Obsidian and enable the plugin in Settings → Community plugins.

## Development

```bash
npm install     # install dependencies
npm run dev     # build with watch mode
npm run build   # production build (type-check + bundle)
npm run lint    # ESLint (eslint-plugin-obsidianmd)
```

Source layout and architecture are documented in `CLAUDE.md`. The forward-looking implementation roadmap — auto-prefixing engine, context menu, path-based exclusion system, and more — lives in `PLAN.md`.

## License

0-BSD.
