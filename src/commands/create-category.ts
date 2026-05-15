import {Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {CreateCategoryModal} from '../ui/create-category-modal';
import {validateVault} from '../core/validator';
import {formatCategoryName, sanitizeName} from '../core/parser';
import type {JDArea} from '../types';

export function registerCreateCategoryCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'create-category',
		name: 'Create category',
		callback: () => {
			const result = validateVault(plugin.app, plugin.settings);

			new CreateCategoryModal(
				plugin.app,
				result.areas,
				result.categories,
				async (area: JDArea, number: number, name: string) => {
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
						const message = err instanceof Error ? err.message : String(err);
						new Notice(`Failed to create category: ${message}`);
					}
				}
			).open();
		},
	});
}
