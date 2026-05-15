import {Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {CreateAreaModal} from '../ui/create-area-modal';
import {validateVault} from '../core/validator';
import {formatAreaName, sanitizeName} from '../core/parser';

export function registerCreateAreaCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'create-area',
		name: 'Create area',
		callback: () => {
			const result = validateVault(plugin.app, plugin.settings);

			new CreateAreaModal(
				plugin.app,
				result.areas,
				plugin.settings.defaultSystemPrefix,
				async (rangeStart: number, name: string, system?: string) => {
					const safeName = sanitizeName(name);
					if (!safeName) {
						new Notice('Invalid name');
						return;
					}

					const folderName = formatAreaName(rangeStart, safeName, system);
					const rootPath = plugin.settings.rootFolder;
					const fullPath = rootPath ? `${rootPath}/${folderName}` : folderName;

					try {
						await plugin.app.vault.createFolder(fullPath);
						new Notice(`Created area: ${folderName}`);
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						new Notice(`Failed to create area: ${message}`);
					}
				}
			).open();
		},
	});
}
