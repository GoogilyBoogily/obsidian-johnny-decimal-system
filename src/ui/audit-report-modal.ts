import {App, Modal, Setting, Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import type {AuditReport, AuditFinding, AuditSeverity} from '../types';
import {auditVault} from '../core/auditor';
import {applyFixes, autoFixLoop} from '../core/audit-apply';

const ORDER: AuditSeverity[] = ['error', 'warn', 'info'];
const LABEL: Record<AuditSeverity, string> = {
	error: 'Errors',
	warn: 'Warnings',
	info: 'Info',
};

export class AuditReportModal extends Modal {
	private plugin: JohnnyDecimalPlugin;
	private report: AuditReport;
	private selected = new Set<AuditFinding>();

	constructor(app: App, plugin: JohnnyDecimalPlugin, report: AuditReport) {
		super(app);
		this.plugin = plugin;
		this.report = report;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl('h2', {text: 'Vault numbering audit'});

		const f = this.report.findings;
		if (f.length === 0) {
			contentEl.createEl('p', {
				text: 'No numbering issues found. ✅',
				cls: 'jd-valid',
			});
			return;
		}

		const counts = ORDER.map(
			s => `${f.filter(x => x.severity === s).length} ${LABEL[s].toLowerCase()}`
		).join(' · ');
		contentEl.createEl('div', {text: counts, cls: 'jd-validation-stats'});

		for (const sev of ORDER) {
			const group = f.filter(x => x.severity === sev);
			if (group.length === 0) continue;

			new Setting(contentEl).setName(LABEL[sev]).setHeading();
			const ul = contentEl.createEl('ul', {cls: 'jd-error-list'});

			for (const finding of group) {
				const li = ul.createEl('li', {cls: 'jd-error-item'});
				if (finding.fix) {
					const cb = li.createEl('input', {type: 'checkbox'});
					cb.checked = sev !== 'info';
					if (cb.checked) this.selected.add(finding);
					cb.addEventListener('change', () => {
						if (cb.checked) this.selected.add(finding);
						else this.selected.delete(finding);
					});
					li.createEl('span', {text: ` ${finding.message}`});
				} else {
					li.createEl('span', {text: finding.message});
				}
				li.createEl('div', {text: finding.path, cls: 'jd-error-path'});
			}
		}

		const hasFixable = f.some(x => x.fix);
		const autoCount = f.filter(x => x.autoFixable && x.fix).length;
		const bar = new Setting(contentEl);
		bar.addButton(b => b.setButtonText('Close').onClick(() => this.close()));
		if (autoCount > 0) {
			bar.addButton(b =>
				b
					.setButtonText(`Apply all safe (${autoCount})`)
					.onClick(() => void this.applyAllSafe())
			);
		}
		if (hasFixable) {
			bar.addButton(b =>
				b
					.setButtonText('Apply selected')
					.setCta()
					.onClick(() => void this.apply())
			);
		}
	}

	private async applyAllSafe() {
		this.close();
		const {fixed, remaining} = await autoFixLoop(this.plugin);
		new Notice(
			`Fixed ${fixed}; ${remaining} issue${remaining === 1 ? '' : 's'} remain`
		);
		const next = auditVault(this.plugin.app, this.plugin.settings);
		new AuditReportModal(this.app, this.plugin, next).open();
	}

	private async apply() {
		const fixes = [...this.selected]
			.map(x => x.fix)
			.filter((x): x is NonNullable<typeof x> => !!x);
		if (fixes.length === 0) {
			new Notice('Nothing selected');
			return;
		}

		this.close();
		const n = await applyFixes(this.plugin, fixes);
		new Notice(`Applied ${n} fix${n === 1 ? '' : 'es'}`);

		// Re-audit and show residual (or a clean result).
		const next = auditVault(this.plugin.app, this.plugin.settings);
		new AuditReportModal(this.app, this.plugin, next).open();
	}

	onClose() {
		this.contentEl.empty();
	}
}
