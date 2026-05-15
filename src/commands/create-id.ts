import {Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {CreateIdModal} from '../ui/create-id-modal';
import {validateVault} from '../core/validator';
import {formatIdName, formatFullId, sanitizeName} from '../core/parser';
import type {JDCategory} from '../types';

export function registerCreateIdCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'create-id',
		name: 'Create ID',
		callback: () => {
			const result = validateVault(plugin.app, plugin.settings);

			new CreateIdModal(
				plugin.app,
				result.categories,
				async (category: JDCategory, name: string) => {
					const safeName = sanitizeName(name);
					if (!safeName) {
						new Notice('Invalid name');
						return;
					}

					// Re-validate vault state at creation time to prevent race conditions
					const freshResult = validateVault(plugin.app, plugin.settings);
					const existingIds = freshResult.ids
						.filter(id => id.parentCategory.path === category.path)
						.map(id => id.id);

					let nextId = 1;
					if (existingIds.length > 0) {
						nextId = Math.max(...existingIds) + 1;
					}

					if (nextId > 99) {
						// eslint-disable-next-line obsidianmd/ui/sentence-case
						new Notice('Category is full (max 99 IDs)');
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
						const message = err instanceof Error ? err.message : String(err);
						new Notice(`Failed to create: ${message}`);
					}
				}
			).open();
		},
	});
}
