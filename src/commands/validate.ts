import type JohnnyDecimalPlugin from '../main';
import {validateVault} from '../core/validator';
import {ValidationReportModal} from '../ui/validation-report-modal';

export function registerValidateCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'validate',
		name: 'Validate vault',
		callback: () => {
			const result = validateVault(plugin.app, plugin.settings);
			new ValidationReportModal(plugin.app, result).open();
		},
	});
}
