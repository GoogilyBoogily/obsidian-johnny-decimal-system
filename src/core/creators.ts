/**
 * Shared creation actions. Used by both the command palette commands and the
 * right-click file-menu so the two paths cannot drift apart.
 */

import {Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import type {JDSystem, JDArea, JDCategory} from '../types';
import {validateVault} from './validator';
import {
	formatSystemName,
	formatAreaName,
	formatCategoryName,
	formatIdName,
	sanitizeName,
} from './parser';

export async function createSystem(
	plugin: JohnnyDecimalPlugin,
	code: string,
	name: string
): Promise<void> {
	if (plugin.settings.systems.some(s => s.code === code)) {
		new Notice(`System ${code} already exists`);
		return;
	}
	const safeName = sanitizeName(name);
	if (!safeName) {
		new Notice('Invalid name');
		return;
	}

	const folderName = formatSystemName(code, safeName);
	const rootPath = plugin.settings.rootFolder;
	const fullPath = rootPath ? `${rootPath}/${folderName}` : folderName;

	try {
		await plugin.app.vault.createFolder(fullPath);
		plugin.settings.systems.push({code, name: safeName});
		await plugin.saveSettings();
		new Notice(`Created system: ${folderName}`);
	} catch (err) {
		new Notice(`Failed to create system: ${msg(err)}`);
	}
}

export async function createArea(
	plugin: JohnnyDecimalPlugin,
	system: JDSystem | null,
	rangeStart: number,
	name: string
): Promise<void> {
	const safeName = sanitizeName(name);
	if (!safeName) {
		new Notice('Invalid name');
		return;
	}

	const folderName = formatAreaName(rangeStart, safeName);
	const base = system ? system.path : plugin.settings.rootFolder;
	const fullPath = base ? `${base}/${folderName}` : folderName;

	try {
		await plugin.app.vault.createFolder(fullPath);
		new Notice(`Created area: ${folderName}`);
	} catch (err) {
		new Notice(`Failed to create area: ${msg(err)}`);
	}
}

export async function createCategory(
	plugin: JohnnyDecimalPlugin,
	area: JDArea,
	number: number,
	name: string
): Promise<void> {
	const safeName = sanitizeName(name);
	if (!safeName) {
		new Notice('Invalid name');
		return;
	}

	const folderName = formatCategoryName(number, safeName);
	const fullPath = `${area.path}/${folderName}`;

	try {
		await plugin.app.vault.createFolder(fullPath);
		new Notice(`Created category: ${folderName}`);
	} catch (err) {
		new Notice(`Failed to create category: ${msg(err)}`);
	}
}

export async function createId(
	plugin: JohnnyDecimalPlugin,
	category: JDCategory,
	name: string
): Promise<void> {
	const safeName = sanitizeName(name);
	if (!safeName) {
		new Notice('Invalid name');
		return;
	}

	// Re-validate at creation time to avoid racing concurrent creates.
	const fresh = validateVault(plugin.app, plugin.settings);
	const existing = fresh.ids
		.filter(id => id.parentCategory.path === category.path)
		.map(id => id.id);

	let nextId = 1;
	if (existing.length > 0) nextId = Math.max(...existing) + 1;
	if (nextId > 99) {
		new Notice(`Category ${category.number} is full (max 99 IDs)`);
		return;
	}

	const fileName = formatIdName(category.number, nextId, safeName);
	const fullPath = `${category.path}/${fileName}.md`;

	try {
		await plugin.app.vault.create(fullPath, '');
		new Notice(`Created: ${fileName}`);
		await plugin.app.workspace.openLinkText(fullPath, '', false);
	} catch (err) {
		new Notice(`Failed to create: ${msg(err)}`);
	}
}

/**
 * Create the next area under `system` (or the root, single-system),
 * auto-picking the first free decade — mirrors the rename engine's policy.
 */
export async function createNextArea(
	plugin: JohnnyDecimalPlugin,
	system: JDSystem | null,
	name: string
): Promise<void> {
	const result = validateVault(plugin.app, plugin.settings);
	const code = system ? system.code : null;
	const used = new Set(
		result.areas.filter(a => a.system === code).map(a => a.rangeStart)
	);

	let start = 0;
	while (start <= 90 && used.has(start)) start += 10;
	if (start > 90) {
		new Notice('No free area range (00-09 … 90-99 all used)');
		return;
	}
	await createArea(plugin, system, start, name);
}

/**
 * Create the next category in `area`, auto-picking the first free number
 * within the area range.
 */
export async function createNextCategory(
	plugin: JohnnyDecimalPlugin,
	area: JDArea,
	name: string
): Promise<void> {
	const result = validateVault(plugin.app, plugin.settings);
	const used = new Set(
		result.categories
			.filter(c => c.parentArea.path === area.path)
			.map(c => c.number)
	);

	let n = area.rangeStart;
	while (n <= area.rangeEnd && used.has(n)) n++;
	if (n > area.rangeEnd) {
		new Notice(`Area ${area.rangeStart}-${area.rangeEnd} is full`);
		return;
	}
	await createCategory(plugin, area, n, name);
}

function msg(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
