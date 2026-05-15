/**
 * Auto-prefix engine: assigns and propagates Johnny Decimal prefixes in
 * response to vault rename/move events.
 *
 * Behaviors
 * ---------
 *  - Folder moved into an Area    → assigned the next free category number
 *  - .md file moved into Category → assigned the next free ID number
 *  - Category prefix edited       → child ID files rewritten (number + system
 *                                   inherited; each child's own ID + name kept)
 *  - Area prefix edited (system)  → category children + their IDs rewritten
 *  - Item moved out of JD         → prefix stripped (if stripPrefixOnExit)
 *  - Anything excluded            → frozen (no-op)
 *
 * Scope (Phase 1): propagation covers SYSTEM-prefix cascade and CATEGORY-number
 * → child-ID rewrite. Area-range remap (e.g. 10-19 → 20-29 forcing 11→21) is a
 * renumber operation, intentionally deferred to the Phase 4 renumber command.
 *
 * Safety
 * ------
 * Plugin-issued renames fire further rename events. Each programmatic write
 * registers its destination in `inFlight`; the handler self-cancels when it
 * observes its own write, preventing infinite recursion. All work is serialized
 * through a single promise chain — Obsidian emits rename events faster than
 * subtree rewrites complete, and concurrent rewrites corrupt numbering.
 */

import {App, TAbstractFile, TFile, TFolder, Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {isExcluded} from './exclusions';
import {
	parseArea,
	parseCategory,
	parseId,
	formatCategoryName,
	formatIdName,
	extractSystemPrefix,
	isCategoryInArea,
} from './parser';
import type {ParsedArea, ParsedCategory} from '../types';

function dirOf(path: string): string {
	const i = path.lastIndexOf('/');
	return i === -1 ? '' : path.slice(0, i);
}

/** Strip a leading system prefix and JD number token, returning the plain name. */
function plainName(rawBasename: string): string {
	const noExt = rawBasename.replace(/\.md$/, '');
	const {rest} = extractSystemPrefix(noExt);
	// area "NN-NN ", category "NN ", or id "NN.NN " leading token
	const m = rest.match(/^\d{2}(?:-\d{2}|\.\d{2})?\s+(.*)$/);
	return (m && m[1] ? m[1] : rest).trim();
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

		// Our own write echoing back — consume the guard and stop.
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

	private async process(file: TAbstractFile, oldPath: string): Promise<void> {
		const parent = file.parent;
		if (!parent) return;

		const moved = dirOf(oldPath) !== parent.path;
		const area = parseArea(parent.name);
		const category = parseCategory(parent.name);

		// --- The item is ITSELF an Area (range name) ---
		// An "XX-YY Name" folder is structurally an Area wherever it sits.
		// Never demote it to a category and never strip its range. Only
		// cascade a system-prefix edit to its children when edited in place.
		if (file instanceof TFolder && parseArea(file.name)) {
			if (!moved) await this.propagateArea(file);
			return;
		}

		// --- Category slot: a non-area folder directly inside an Area ---
		if (area && file instanceof TFolder) {
			await this.assignCategory(file, area);
			return;
		}

		// --- ID slot: a .md file living directly inside a Category ---
		if (category && file instanceof TFile && file.name.endsWith('.md')) {
			const grandArea = file.parent?.parent
				? parseArea(file.parent.parent.name)
				: null;
			await this.assignId(file, category, grandArea);
			return;
		}

		// --- In-place prefix edit on a Category → propagate to ID children ---
		// (Area self-edits are handled by the area short-circuit above.)
		if (!moved && file instanceof TFolder && parseCategory(file.name)) {
			await this.propagateCategory(file);
			return;
		}

		// --- Moved out of the JD structure → strip prefix ---
		if (moved && this.plugin.settings.stripPrefixOnExit && !area && !category) {
			await this.stripPrefix(file);
		}
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
		// Already correctly numbered and in range — nothing to do.
		if (
			existing &&
			isCategoryInArea(existing.number, area) &&
			!used.has(existing.number) &&
			existing.system === area.system
		) {
			return;
		}

		let next = area.rangeStart;
		for (let n = area.rangeStart; n <= area.rangeEnd; n++) {
			if (!used.has(n)) {
				next = n;
				break;
			}
			next = n + 1;
		}
		if (next > area.rangeEnd) {
			new Notice(
				`Area ${area.rangeStart}-${area.rangeEnd} is full — no free category number.`
			);
			return;
		}

		const name = plainName(folder.name);
		const newName = formatCategoryName(next, name, area.system);
		const newPath = `${parent.path}/${newName}`;
		await this.safeRename(folder, newPath);

		// New category number → existing ID children must follow.
		const moved = this.app.vault.getAbstractFileByPath(newPath);
		if (moved instanceof TFolder) await this.propagateCategory(moved);
	}

	/** Assign the next free ID number within `category` to `file`. */
	private async assignId(
		file: TFile,
		category: ParsedCategory,
		area: ParsedArea | null
	): Promise<void> {
		const parent = file.parent;
		if (!parent) return;

		const system = area ? area.system : category.system;

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
			!used.has(existing.id) &&
			existing.system === system
		) {
			return;
		}

		let next = 1;
		while (used.has(next)) next++;
		if (next > 99) {
			new Notice(`Category ${category.number} is full (max 99 IDs).`);
			return;
		}

		const name = plainName(file.name);
		const newName = formatIdName(category.number, next, name, system);
		const newPath = `${parent.path}/${newName}.md`;
		await this.safeRename(file, newPath);
	}

	/** Cascade an Area's system prefix to its category children (and IDs). */
	private async propagateArea(areaFolder: TFolder): Promise<void> {
		const parsed = parseArea(areaFolder.name);
		if (!parsed) return;

		for (const child of [...areaFolder.children]) {
			if (!(child instanceof TFolder)) continue;
			if (isExcluded(child.path, this.exclusions)) continue;
			const cat = parseCategory(child.name);
			if (!cat) continue;

			const newName = formatCategoryName(
				cat.number,
				cat.name,
				parsed.system
			);
			if (newName !== child.name) {
				const newPath = `${areaFolder.path}/${newName}`;
				await this.safeRename(child, newPath);
				const moved = this.app.vault.getAbstractFileByPath(newPath);
				if (moved instanceof TFolder) await this.propagateCategory(moved);
			} else {
				await this.propagateCategory(child);
			}
		}
	}

	/**
	 * Rewrite a Category's ID children so each inherits the category's number
	 * and system prefix while keeping its own ID digits and name.
	 */
	private async propagateCategory(catFolder: TFolder): Promise<void> {
		const cat = parseCategory(catFolder.name);
		if (!cat) return;

		for (const child of [...catFolder.children]) {
			if (!(child instanceof TFile) || !child.name.endsWith('.md')) continue;
			if (isExcluded(child.path, this.exclusions)) continue;
			const id = parseId(child.name);
			if (!id) continue;

			const newBase = formatIdName(
				cat.number,
				id.id,
				id.name,
				cat.system
			);
			const newName = `${newBase}.md`;
			if (newName !== child.name) {
				await this.safeRename(child, `${catFolder.path}/${newName}`);
			}
		}
	}

	/** Remove the JD prefix from an item moved outside the structure. */
	private async stripPrefix(file: TAbstractFile): Promise<void> {
		const isMd = file instanceof TFile && file.name.endsWith('.md');
		const base = isMd ? file.name.replace(/\.md$/, '') : file.name;

		// Only act if it actually carries a JD prefix.
		const {rest} = extractSystemPrefix(base);
		if (!/^\d{2}(?:-\d{2}|\.\d{2})?\s+/.test(rest) && rest === base) return;

		const plain = plainName(file.name);
		if (!plain || plain === base) return;

		const parentPath = file.parent ? file.parent.path : '';
		const newName = isMd ? `${plain}.md` : plain;
		const newPath = parentPath ? `${parentPath}/${newName}` : newName;
		if (newPath === file.path) return;
		await this.safeRename(file, newPath);
	}

	/**
	 * Rename guarded against recursion. Uses fileManager.renameFile for .md
	 * (preserves wikilinks/backlinks) and vault.rename for folders.
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
	}
}
