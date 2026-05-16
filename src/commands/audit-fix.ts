import {Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import type {AuditKind} from '../types';
import {auditVault} from '../core/auditor';
import {autoFixLoop} from '../core/audit-apply';
import {ConfirmModal} from '../ui/confirm-modal';

export function registerAuditFixCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'audit-fix',
		name: 'Audit and fix',
		callback: () => {
			if (plugin.settings.auditFixMode === 'off') {
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				new Notice('Audit auto-fix is off — use "Audit numbering" to fix manually');
				return;
			}

			const report = auditVault(plugin.app, plugin.settings);
			const auto = report.findings.filter(f => f.autoFixable && f.fix);
			if (auto.length === 0) {
				 
				new Notice('Nothing to auto-fix');
				return;
			}

			const byKind = new Map<AuditKind, number>();
			for (const f of auto) {
				byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
			}
			const breakdown = [...byKind]
				.map(([k, n]) => `${n} ${k.toLowerCase()}`)
				.join(', ');

			new ConfirmModal(
				plugin.app,
				'Apply audit fixes?',
				`Apply ${auto.length} fix${auto.length === 1 ? '' : 'es'} (${breakdown}) in "${plugin.settings.auditFixMode}" mode. This renames files/folders; links are preserved.`,
				'Apply',
				() => {
					void (async () => {
						const {fixed, remaining} = await autoFixLoop(plugin);
						new Notice(
							`Fixed ${fixed}; ${remaining} issue${remaining === 1 ? '' : 's'} remain — run "Audit numbering" to review`
						);
					})();
				}
			).open();
		},
	});
}
