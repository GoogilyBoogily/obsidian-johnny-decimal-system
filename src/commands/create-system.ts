import type JohnnyDecimalPlugin from '../main';
import {CreateSystemModal} from '../ui/create-system-modal';
import {createSystem} from '../core/creators';

export function registerCreateSystemCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'create-system',
		name: 'Create system',
		callback: () => {
			new CreateSystemModal(plugin.app, (code, name) =>
				createSystem(plugin, code, name)
			).open();
		},
	});
}
