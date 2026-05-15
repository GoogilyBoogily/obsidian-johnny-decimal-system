/**
 * Context-aware right-click menu. The items offered depend on the JD level of
 * the clicked folder, and each opens the matching create modal with the
 * clicked target preselected. Also a one-click exclude/include toggle.
 */

import {Menu, TAbstractFile, TFolder, Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {validateVault} from '../core/validator';
import {isExcluded} from '../core/exclusions';
import {createSystem, createArea, createCategory, createId} from '../core/creators';
import {CreateSystemModal} from './create-system-modal';
import {CreateAreaModal} from './create-area-modal';
import {CreateCategoryModal} from './create-category-modal';
import {CreateIdModal} from './create-id-modal';

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

	// Exclude / include toggle — always available.
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

	// An excluded path is frozen — no create actions.
	if (excluded || !(file instanceof TFolder)) return;

	const result = validateVault(plugin.app, settings);
	const sys = result.systems.find(s => s.path === path);
	const area = result.areas.find(a => a.path === path);
	const cat = result.categories.find(c => c.path === path);
	const multi = settings.systems.length > 0;
	const rootFolder = settings.rootFolder;
	const isRoot = file.isRoot() || (rootFolder !== '' && path === rootFolder);

	const app = plugin.app;

	if (cat) {
		menu.addItem(item =>
			item
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setTitle('New JD ID here')
				.setIcon('file-plus')
				.onClick(() => {
					new CreateIdModal(
						app,
						result.categories,
						(c, n) => createId(plugin, c, n),
						cat.path
					).open();
				})
		);
	} else if (area) {
		menu.addItem(item =>
			item
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setTitle('New JD category here')
				.setIcon('folder-plus')
				.onClick(() => {
					new CreateCategoryModal(
						app,
						result.areas,
						result.categories,
						(a, num, n) => createCategory(plugin, a, num, n),
						area.path
					).open();
				})
		);
	} else if (sys) {
		menu.addItem(item =>
			item
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setTitle('New JD area here')
				.setIcon('folder-plus')
				.onClick(() => {
					new CreateAreaModal(
						app,
						result.systems,
						result.areas,
						(s, r, n) => createArea(plugin, s, r, n),
						sys.code
					).open();
				})
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
					.onClick(() => {
						new CreateAreaModal(
							app,
							result.systems,
							result.areas,
							(s, r, n) => createArea(plugin, s, r, n)
						).open();
					})
			);
		}
	}
}
