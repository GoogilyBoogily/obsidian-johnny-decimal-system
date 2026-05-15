/**
 * "Un-JD" a folder: strip JD number/code prefixes from every descendant AND
 * exclude the folder so the engine stops re-numbering it. Strip without
 * exclude would just get re-prefixed by the always-on engine, so the two are
 * intentionally coupled.
 */

import {TFolder, TFile, Notice} from 'obsidian';
import type {App} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';

// Leading system code ("H01 "), area ("10-19 "), category ("11 "),
// or ID ("11.01 ") token.
const PREFIX = /^(?:[A-Z]\d{2}|\d{2}(?:-\d{2}|\.\d{2})?)\s+(.*)$/;

function plain(base: string): string {
	const m = base.match(PREFIX);
	return (m && m[1] ? m[1] : base).trim();
}

/** Recursively strip prefixes from a folder's descendants. Returns count. */
async function stripUnder(app: App, folder: TFolder): Promise<number> {
	let count = 0;
	// Snapshot — we mutate the tree while iterating.
	for (const child of [...folder.children]) {
		if (child instanceof TFolder) {
			count += await stripUnder(app, child);
			const target = plain(child.name);
			if (target && target !== child.name) {
				const dest = `${folder.path}/${target}`;
				if (!app.vault.getAbstractFileByPath(dest)) {
					await app.vault.rename(child, dest);
					count++;
				}
			}
		} else if (child instanceof TFile && child.name.endsWith('.md')) {
			const base = child.name.replace(/\.md$/, '');
			const target = plain(base);
			if (target && target !== base) {
				const dest = `${folder.path}/${target}.md`;
				if (!app.vault.getAbstractFileByPath(dest)) {
					await app.fileManager.renameFile(child, dest);
					count++;
				}
			}
		}
	}
	return count;
}

/**
 * Exclude `folder` (freezes it for the engine) then strip JD prefixes from
 * all descendants.
 */
export async function unJd(
	plugin: JohnnyDecimalPlugin,
	folder: TFolder
): Promise<void> {
	if (!plugin.settings.exclusions.includes(folder.path)) {
		plugin.settings.exclusions.push(folder.path);
		await plugin.saveSettings();
	}

	try {
		const n = await stripUnder(plugin.app, folder);
		new Notice(
			`Removed JD prefixes from ${n} item${n === 1 ? '' : 's'}; "${folder.path}" is now excluded.`
		);
	} catch (err) {
		const m = err instanceof Error ? err.message : String(err);
		new Notice(`Failed to remove prefixes: ${m}`);
	}
}
