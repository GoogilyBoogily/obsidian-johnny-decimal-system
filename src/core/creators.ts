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
	formatFullId,
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

	const fullId = formatFullId(category.number, nextId, category.system);
	const today = new Date().toISOString().split('T')[0] ?? '';
	const content = plugin.settings.idNoteTemplate
		.replace(/\{\{name\}\}/g, safeName)
		.replace(/\{\{date\}\}/g, today)
		.replace(/\{\{id\}\}/g, fullId);

	try {
		await plugin.app.vault.create(fullPath, content);
		new Notice(`Created: ${fileName}`);
		await plugin.app.workspace.openLinkText(fullPath, '', false);
	} catch (err) {
		new Notice(`Failed to create: ${msg(err)}`);
	}
}

function msg(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
