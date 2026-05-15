import type JohnnyDecimalPlugin from '../main';
import {CreateIdModal} from '../ui/create-id-modal';
import {validateVault} from '../core/validator';
import {createId} from '../core/creators';

export function registerCreateIdCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'create-id',
		name: 'Create ID',
		callback: () => {
			const result = validateVault(plugin.app, plugin.settings);
			new CreateIdModal(
				plugin.app,
				result.categories,
				(category, name) => createId(plugin, category, name)
			).open();
		},
	});
}
