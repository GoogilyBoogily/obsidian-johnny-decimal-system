import type JohnnyDecimalPlugin from '../main';
import {CreateAreaModal} from '../ui/create-area-modal';
import {validateVault} from '../core/validator';
import {createArea} from '../core/creators';

export function registerCreateAreaCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'create-area',
		name: 'Create area',
		callback: () => {
			const result = validateVault(plugin.app, plugin.settings);
			new CreateAreaModal(
				plugin.app,
				result.systems,
				result.areas,
				(system, rangeStart, name) =>
					createArea(plugin, system, rangeStart, name)
			).open();
		},
	});
}
