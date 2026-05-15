/**
 * Auto-prefix engine: assigns and propagates Johnny Decimal numbers in
 * response to vault rename/move events.
 *
 * Model: systems are a top-level folder layer ("CODE Name"); area/category/ID
 * names are CLEAN (no system prefix). The system is derived from the path, so
 * moving an item between systems is a pure path change — NO rename needed and
 * no subtree cascade. The only propagation left is a category-number edit
 * rewriting its child ID files (their names embed "XX.YY").
 *
 * Behaviors
 * ---------
 *  - Folder moved into an Area    → next free category number
 *  - .md file moved into Category → next free ID number
 *  - Category number edited       → child ID files rewritten (id + name kept)
 *  - Item moved out of JD         → number prefix stripped (stripPrefixOnExit)
 *  - System / Area folders        → never recategorized or stripped
 *  - Anything excluded            → frozen (no-op)
 *
 * Out of scope (Phase 4): area-range remap forcing category renumber.
 *
 * Safety: plugin-issued renames echo back as rename events; each programmatic
 * write registers its destination in `inFlight` and the handler self-cancels
 * on its own write. All work serialized through one promise chain.
 */

import {App, TAbstractFile, TFile, TFolder, Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {isExcluded} from './exclusions';
import {flashPath} from '../ui/highlight';
import {
	parseSystem,
	parseArea,
	parseCategory,
	parseId,
	formatAreaName,
	formatCategoryName,
	formatIdName,
	isCategoryInArea,
} from './parser';
import type {ParsedArea, ParsedCategory} from '../types';

function dirOf(path: string): string {
	const i = path.lastIndexOf('/');
	return i === -1 ? '' : path.slice(0, i);
}

/** Strip a leading JD number token (area/category/id), returning the plain name. */
function plainName(rawBasename: string): string {
	const noExt = rawBasename.replace(/\.md$/, '');
	const m = noExt.match(/^\d{2}(?:-\d{2}|\.\d{2})?\s+(.*)$/);
	return (m && m[1] ? m[1] : noExt).trim();
}

export class RenameEngine {
	private inFlight = new Set<string>();
	private chain: Promise<void> = Promise.resolve();

	constructor(private plugin: JohnnyDecimalPlugin) {}

	private get app(): App {
		return this.plugin.app;
	}

	private get exclusions(): string[] {
		return this.plugin.settings.exclusions;
	}

	/** Registered via plugin.registerEvent(vault.on('rename', ...)). */
	handleRename = (file: TAbstractFile, oldPath: string): void => {
		if (!this.plugin.settings.autoPrefixEnabled) return;

		if (this.inFlight.has(file.path)) {
			this.inFlight.delete(file.path);
			return;
		}

		if (
			isExcluded(file.path, this.exclusions) ||
			isExcluded(oldPath, this.exclusions)
		) {
			return;
		}

		this.chain = this.chain
			.then(() => this.process(file, oldPath))
			.catch((err) => {
				console.error('[Johnny Decimal] rename engine error:', err);
			});
	};

	/**
	 * Registered via plugin.registerEvent(vault.on('create', ...)) INSIDE
	 * workspace.onLayoutReady so the initial vault-load create storm is
	 * skipped. Assigns a prefix to a newly-created item in a JD slot.
	 */
	handleCreate = (file: TAbstractFile): void => {
		if (!this.plugin.settings.autoPrefixEnabled) return;
		if (this.inFlight.has(file.path)) {
			this.inFlight.delete(file.path);
			return;
		}
		if (isExcluded(file.path, this.exclusions)) return;

		this.chain = this.chain
			.then(() => this.processCreate(file))
			.catch((err) => {
				console.error('[Johnny Decimal] create engine error:', err);
			});
	};

	private async processCreate(file: TAbstractFile): Promise<void> {
		const parent = file.parent;
		if (!parent) return;

		if (file instanceof TFolder) {
			// Already a System or Area folder → structural, leave it.
			if (parseSystem(file.name) || parseArea(file.name)) return;

			if (this.isAreaContainer(parent)) {
				await this.assignArea(file, parent);
				return;
			}
			const area = parseArea(parent.name);
			if (area) await this.assignCategory(file, area);
			return;
		}

		if (file instanceof TFile && file.name.endsWith('.md')) {
			const category = parseCategory(parent.name);
			if (category) await this.assignId(file, category);
		}
	}

	private async process(file: TAbstractFile, oldPath: string): Promise<void> {
		const parent = file.parent;
		if (!parent) return;

		const moved = dirOf(oldPath) !== parent.path;

		// A System folder ("CODE Name") or an Area folder ("XX-YY Name") is
		// structural — never demote or strip it.
		if (file instanceof TFolder) {
			if (parseSystem(file.name)) return;
			if (parseArea(file.name)) return;
		}

		const area = parseArea(parent.name);
		const category = parseCategory(parent.name);

		// Area slot: a non-area folder directly inside a System folder
		// (multi-system) or the JD root (single-system).
		if (file instanceof TFolder && this.isAreaContainer(parent)) {
			await this.assignArea(file, parent);
			return;
		}

		// Category slot: a non-area folder directly inside an Area.
		if (area && file instanceof TFolder) {
			await this.assignCategory(file, area);
			return;
		}

		// ID slot: a .md file directly inside a Category.
		if (category && file instanceof TFile && file.name.endsWith('.md')) {
			await this.assignId(file, category);
			return;
		}

		// In-place category-number edit → rewrite child ID files.
		if (!moved && file instanceof TFolder && parseCategory(file.name)) {
			await this.propagateCategory(file);
			return;
		}

		// Moved out of the JD structure → strip the number prefix.
		if (
			moved &&
			this.plugin.settings.stripPrefixOnExit &&
			!area &&
			!category
		) {
			await this.stripPrefix(file);
		}
	}

	/**
	 * True if `parent` is where Areas live: a System folder when multi-system,
	 * or the configured JD root (or vault root) when single-system.
	 */
	private isAreaContainer(parent: TFolder): boolean {
		if (this.plugin.settings.systems.length > 0) {
			return parseSystem(parent.name) !== null;
		}
		const rootFolder = this.plugin.settings.rootFolder;
		if (rootFolder) return parent.path === rootFolder;
		return parent.isRoot();
	}

	/** Assign the next free area range (decade) to `folder`. */
	private async assignArea(
		folder: TFolder,
		parent: TFolder
	): Promise<void> {
		const used = new Set<number>();
		for (const sib of parent.children) {
			if (sib === folder || !(sib instanceof TFolder)) continue;
			const a = parseArea(sib.name);
			if (a) used.add(a.rangeStart);
		}

		let start = 0;
		while (start <= 90 && used.has(start)) start += 10;
		if (start > 90) {
			new Notice('No free area range (00-09 … 90-99 all used).');
			return;
		}

		const newName = formatAreaName(start, plainName(folder.name));
		const base = parent.isRoot() ? '' : parent.path;
		const newPath = base ? `${base}/${newName}` : newName;
		await this.safeRename(folder, newPath);
	}

	/** Assign the next free category number within `area` to `folder`. */
	private async assignCategory(
		folder: TFolder,
		area: ParsedArea
	): Promise<void> {
		const parent = folder.parent;
		if (!parent) return;

		const used = new Set<number>();
		for (const sib of parent.children) {
			if (sib === folder || !(sib instanceof TFolder)) continue;
			const c = parseCategory(sib.name);
			if (c) used.add(c.number);
		}

		const existing = parseCategory(folder.name);
		if (
			existing &&
			isCategoryInArea(existing.number, area) &&
			!used.has(existing.number)
		) {
			return;
		}

		let next = area.rangeStart;
		while (next <= area.rangeEnd && used.has(next)) next++;
		if (next > area.rangeEnd) {
			new Notice(
				`Area ${area.rangeStart}-${area.rangeEnd} is full — no free category number.`
			);
			return;
		}

		const newName = formatCategoryName(next, plainName(folder.name));
		const newPath = `${parent.path}/${newName}`;
		await this.safeRename(folder, newPath);

		const moved = this.app.vault.getAbstractFileByPath(newPath);
		if (moved instanceof TFolder) await this.propagateCategory(moved);
	}

	/** Assign the next free ID number within `category` to `file`. */
	private async assignId(
		file: TFile,
		category: ParsedCategory
	): Promise<void> {
		const parent = file.parent;
		if (!parent) return;

		const used = new Set<number>();
		for (const sib of parent.children) {
			if (sib === file || !(sib instanceof TFile)) continue;
			const id = parseId(sib.name);
			if (id) used.add(id.id);
		}

		const existing = parseId(file.name);
		if (
			existing &&
			existing.category === category.number &&
			!used.has(existing.id)
		) {
			return;
		}

		let next = 1;
		while (used.has(next)) next++;
		if (next > 99) {
			new Notice(`Category ${category.number} is full (max 99 IDs).`);
			return;
		}

		const newName = formatIdName(category.number, next, plainName(file.name));
		const newPath = `${parent.path}/${newName}.md`;
		await this.safeRename(file, newPath);
	}

	/**
	 * Rewrite a Category's ID children so each inherits the category's number
	 * while keeping its own ID digits and name.
	 */
	private async propagateCategory(catFolder: TFolder): Promise<void> {
		const cat = parseCategory(catFolder.name);
		if (!cat) return;

		for (const child of [...catFolder.children]) {
			if (!(child instanceof TFile) || !child.name.endsWith('.md')) continue;
			if (isExcluded(child.path, this.exclusions)) continue;
			const id = parseId(child.name);
			if (!id) continue;

			const newName = `${formatIdName(cat.number, id.id, id.name)}.md`;
			if (newName !== child.name) {
				await this.safeRename(child, `${catFolder.path}/${newName}`);
			}
		}
	}

	/** Remove the JD number prefix from an item moved outside the structure. */
	private async stripPrefix(file: TAbstractFile): Promise<void> {
		const isMd = file instanceof TFile && file.name.endsWith('.md');
		const base = isMd ? file.name.replace(/\.md$/, '') : file.name;

		if (!/^\d{2}(?:-\d{2}|\.\d{2})?\s+/.test(base)) return;

		const plain = plainName(file.name);
		if (!plain || plain === base) return;

		const parentPath = file.parent ? file.parent.path : '';
		const newName = isMd ? `${plain}.md` : plain;
		const newPath = parentPath ? `${parentPath}/${newName}` : newName;
		if (newPath === file.path) return;
		await this.safeRename(file, newPath);
	}

	/**
	 * Rename guarded against recursion. fileManager.renameFile for .md
	 * (preserves wikilinks/backlinks), vault.rename for folders.
	 */
	private async safeRename(
		file: TAbstractFile,
		newPath: string
	): Promise<void> {
		if (file.path === newPath) return;
		if (this.app.vault.getAbstractFileByPath(newPath)) {
			new Notice(`Cannot rename: "${newPath}" already exists.`);
			return;
		}

		this.inFlight.add(newPath);
		try {
			if (file instanceof TFolder) {
				await this.app.vault.rename(file, newPath);
			} else {
				await this.app.fileManager.renameFile(file, newPath);
			}
		} catch (err) {
			this.inFlight.delete(newPath);
			throw err;
		}
		flashPath(newPath);
	}
}
