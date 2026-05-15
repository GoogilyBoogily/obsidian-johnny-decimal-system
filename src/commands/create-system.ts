import {Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {CreateSystemModal} from '../ui/create-system-modal';

export function registerCreateSystemCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'create-system',
		name: 'Create system',
		callback: () => {
			new CreateSystemModal(plugin.app, async (prefix: string) => {
				plugin.settings.defaultSystemPrefix = prefix;
				await plugin.saveSettings();
				new Notice(`System prefix set to ${prefix}`);
			}).open();
		},
	});
}
