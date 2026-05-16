import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

// Mirrors the official eslint-plugin-obsidianmd 0.3.0 recommended setup:
// the TS parser/project is scoped to **/*.ts so type-aware Obsidian rules
// (no-unsupported-api, no-plugin-as-component, …) get type information.
// JSON is intentionally not linted — the 0.3.0 preset bleeds JS-core rules
// onto the JSON AST; manifest.json structure is verified out of band.
export default defineConfig([
	{
		ignores: [
			"node_modules",
			".remember/**",
			"dist",
			"esbuild.config.mjs",
			"eslint.config.js",
			"eslint.config.mts",
			"version-bump.mjs",
			"versions.json",
			"main.js",
			"test/**",
			"**/*.json",
		],
	},

	...obsidianmd.configs.recommended,

	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
			globals: {
				...globals.browser,
			},
		},
	},
]);
