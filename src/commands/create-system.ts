import {Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {CreateSystemModal} from '../ui/create-system-modal';
import {formatSystemName, sanitizeName} from '../core/parser';

export function registerCreateSystemCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'create-system',
		name: 'Create system',
		callback: () => {
			new CreateSystemModal(plugin.app, async (code: string, name: string) => {
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
					const message = err instanceof Error ? err.message : String(err);
					new Notice(`Failed to create system: ${message}`);
				}
			}).open();
		},
	});
}
