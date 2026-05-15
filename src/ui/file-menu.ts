/**
 * Context-aware right-click menu. Items depend on the JD level of the clicked
 * folder and create the next item directly — the clicked folder IS the parent
 * and the number/ID is auto-assigned; only a name is asked. Plus a one-click
 * exclude/include toggle.
 */

import {Menu, TAbstractFile, TFolder, Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {validateVault} from '../core/validator';
import {isExcluded} from '../core/exclusions';
import {
	createSystem,
	createNextArea,
	createNextCategory,
	createId,
} from '../core/creators';
import {unJd} from '../core/strip';
import {CreateSystemModal} from './create-system-modal';
import {NamePromptModal} from './name-prompt-modal';
import {ConfirmModal} from './confirm-modal';

export function registerFileMenu(plugin: JohnnyDecimalPlugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
			buildMenu(plugin, menu, file);
		})
	);
}

function buildMenu(
	plugin: JohnnyDecimalPlugin,
	menu: Menu,
	file: TAbstractFile
): void {
	const settings = plugin.settings;
	const path = file.path;
	const excluded = isExcluded(path, settings.exclusions);

	menu.addItem(item =>
		item
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Johnny Decimal" is a proper noun
			.setTitle(
				excluded
					? 'Johnny Decimal: remove exclusion'
					: 'Johnny Decimal: exclude from JD'
			)
			.setIcon(excluded ? 'folder-check' : 'folder-minus')
			.onClick(async () => {
				if (excluded) {
					settings.exclusions = settings.exclusions.filter(e => e !== path);
					new Notice(`Removed JD exclusion: ${path}`);
				} else {
					settings.exclusions.push(path);
					new Notice(`Excluded from JD: ${path}`);
				}
				await plugin.saveSettings();
			})
	);

	if (!(file instanceof TFolder)) return;

	const folder = file;
	menu.addItem(item =>
		item
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Johnny Decimal" is a proper noun
			.setTitle('Johnny Decimal: remove prefixes from children')
			.setIcon('list-x')
			.onClick(() => {
				new ConfirmModal(
					plugin.app,
					'Remove JD prefixes?',
					`Strip JD numbering from everything under "${folder.path}" and exclude this folder so it is no longer auto-numbered. This renames files/folders.`,
					'Remove',
					() => void unJd(plugin, folder)
				).open();
			})
	);

	if (excluded) return;

	const result = validateVault(plugin.app, settings);
	const sys = result.systems.find(s => s.path === path);
	const area = result.areas.find(a => a.path === path);
	const cat = result.categories.find(c => c.path === path);
	const multi = settings.systems.length > 0;
	const rootFolder = settings.rootFolder;
	const isRoot = file.isRoot() || (rootFolder !== '' && path === rootFolder);
	const app = plugin.app;

	const prompt = (title: string, run: (name: string) => void) =>
		new NamePromptModal(app, title, run).open();

	if (cat) {
		menu.addItem(item =>
			item
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setTitle('New JD ID here')
				.setIcon('file-plus')
				.onClick(() =>
					prompt('New ID', n => void createId(plugin, cat, n))
				)
		);
	} else if (area) {
		menu.addItem(item =>
			item
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setTitle('New JD category here')
				.setIcon('folder-plus')
				.onClick(() =>
					prompt('New category', n =>
						void createNextCategory(plugin, area, n)
					)
				)
		);
	} else if (sys) {
		menu.addItem(item =>
			item
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setTitle('New JD area here')
				.setIcon('folder-plus')
				.onClick(() =>
					prompt('New area', n => void createNextArea(plugin, sys, n))
				)
		);
	} else if (isRoot) {
		if (multi) {
			menu.addItem(item =>
				item
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setTitle('New JD system')
					.setIcon('folder-plus')
					.onClick(() => {
						new CreateSystemModal(app, (code, n) =>
							createSystem(plugin, code, n)
						).open();
					})
			);
		} else {
			menu.addItem(item =>
				item
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setTitle('New JD area here')
					.setIcon('folder-plus')
					.onClick(() =>
						prompt('New area', n => void createNextArea(plugin, null, n))
					)
			);
		}
	}
}
