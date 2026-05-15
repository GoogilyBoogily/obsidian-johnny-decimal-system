# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian plugin for implementing the Johnny Decimal organizational system. Built with TypeScript and esbuild, targeting the Obsidian Plugin API.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Build with watch mode (development)
npm run build        # Production build (type-check + minified bundle)
npm run lint         # Run ESLint
```

## Johnny Decimal Structure

The plugin manages a 4-level hierarchy, each level mapping to folders/files in the vault:

| Level    | Format           | Example               | Vault representation |
|----------|------------------|-----------------------|----------------------|
| System   | `SYS` (optional) | `H01`                | Prefix on all names  |
| Area     | `XX-YY Name`     | `10-19 Life admin`   | Folder               |
| Category | `XX Name`        | `11 Travel`          | Folder inside area   |
| ID       | `XX.YY Name`     | `11.01 NYC Trip`     | `.md` file in category |

Systems are optional — single-system vaults omit the prefix. Multi-system vaults prepend it: `H01.10-19 Life admin`.

## Architecture

**Entry point:** `src/main.ts` → bundled to `main.js`

```
src/
  main.ts              # Plugin lifecycle, ribbon icon, openNavigateModal()
  settings.ts          # JDSettings interface, defaults, settings tab
  types.ts             # JDArea, JDCategory, JDId, validation types
  commands/
    index.ts           # registerCommands() — wires all commands to plugin
    create-system.ts   # Create system prefix folder
    create-area.ts     # Create area (XX-YY range folder)
    create-category.ts # Create category (XX folder inside area)
    create-id.ts       # Create ID (XX.YY note inside category)
    navigate.ts        # Open navigate modal
    validate.ts        # Run vault validation
    generate-jdex.ts   # Generate JDex index file
  core/
    parser.ts          # Regex parsing, formatting, sanitization (shared logic)
    validator.ts       # Vault scanning, structure validation
  ui/
    create-system-modal.ts
    create-area-modal.ts
    create-category-modal.ts
    create-id-modal.ts
    navigate-modal.ts
    validation-report-modal.ts
```

**Data flow:** `main.ts` → `commands/` (register + handle) → `ui/` (modal interaction) → `core/` (parsing, validation, formatting)

**Build output:** `main.js`, `manifest.json`, `styles.css` are required for Obsidian to load the plugin.

## Key Patterns

- **Focused modals:** Each creation step has its own modal class (not polymorphic). Modals receive parsed JD data and an `onSubmit` callback.
- **parser.ts as shared logic:** All regex patterns, name formatting (`formatAreaName`, `formatCategoryName`, `formatIdName`), and `sanitizeName()` live here. Use it for any name parsing or generation.
- **System prefix as `string | null`:** All types and parser functions use `string | null` — null means single-system vault.
- **Dropdown rebuilds:** Category/range dropdowns are rebuilt by clearing a DOM container div, not via `Setting.clear()` (which is unreliable).
- **Used items skipped:** Dropdowns for area ranges and category numbers omit already-used values entirely.

## ESLint

Uses `eslint-plugin-obsidianmd`. The `obsidianmd/ui/sentence-case` rule flags proper nouns like "Johnny Decimal", "JD", and "JDex". Disable per-line:

```ts
// eslint-disable-next-line obsidianmd/ui/sentence-case
.setName('Johnny Decimal')
```

## Testing

Copy build artifacts to vault for manual testing:
```bash
cp main.js manifest.json styles.css <Vault>/.obsidian/plugins/sample-plugin/
```
Then reload Obsidian and enable the plugin.

## References

- See `AGENTS.md` for detailed Obsidian plugin development conventions
- API docs: https://docs.obsidian.md
