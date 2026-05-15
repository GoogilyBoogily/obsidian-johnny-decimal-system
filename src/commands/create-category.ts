import type JohnnyDecimalPlugin from '../main';
import {CreateCategoryModal} from '../ui/create-category-modal';
import {validateVault} from '../core/validator';
import {createCategory} from '../core/creators';

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
				(area, number, name) =>
					createCategory(plugin, area, number, name)
			).open();
		},
	});
}
