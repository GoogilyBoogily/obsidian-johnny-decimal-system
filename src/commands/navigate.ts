import type JohnnyDecimalPlugin from '../main';

export function registerNavigateCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'navigate',
		name: 'Quick navigate',
		callback: () => {
			plugin.openNavigateModal();
		},
	});
}
