import type JohnnyDecimalPlugin from '../main';
import {auditVault} from '../core/auditor';
import {AuditReportModal} from '../ui/audit-report-modal';

export function registerAuditCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'audit-numbering',
		name: 'Audit numbering',
		callback: () => {
			const report = auditVault(plugin.app, plugin.settings);
			new AuditReportModal(plugin.app, plugin, report).open();
		},
	});
}
