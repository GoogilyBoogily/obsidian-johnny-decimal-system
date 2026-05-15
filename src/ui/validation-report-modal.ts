import {App, Modal} from 'obsidian';
import type {ValidationErrorType, ValidationResult} from '../types';

const ERROR_LABELS: Record<ValidationErrorType, string> = {
	'INVALID_SYSTEM_NAME': 'Invalid system name',
	'UNKNOWN_SYSTEM': 'Unregistered system',
	'DUPLICATE_SYSTEM': 'Duplicate system',
	'INVALID_AREA_NAME': 'Invalid area name',
	'INVALID_AREA_RANGE': 'Invalid area range',
	'INVALID_CATEGORY_NAME': 'Invalid category name',
	'CATEGORY_OUTSIDE_AREA': 'Category outside area',
	'INVALID_ID_NAME': 'Invalid ID name',
	'ID_OUTSIDE_CATEGORY': 'ID in wrong category',
	'DUPLICATE_AREA': 'Duplicate area',
	'DUPLICATE_CATEGORY': 'Duplicate category',
	'DUPLICATE_ID': 'Duplicate ID',
	'ORPHAN_FILE': 'Misplaced file',
	'MISPLACED_FOLDER': 'Unexpected folder',
};

export class ValidationReportModal extends Modal {
	private result: ValidationResult;

	constructor(app: App, result: ValidationResult) {
		super(app);
		this.result = result;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();

		// eslint-disable-next-line obsidianmd/ui/sentence-case
		contentEl.createEl('h2', {text: 'Johnny Decimal validation report'});

		// Summary
		const summary = contentEl.createDiv({cls: 'jd-validation-summary'});
		if (this.result.valid) {
			summary.createEl('p', {
				text: 'Vault structure is valid',
				cls: 'jd-valid',
			});
		} else {
			summary.createEl('p', {
				text: `Found ${this.result.errors.length} issue(s)`,
				cls: 'jd-invalid',
			});
		}

		// Stats
		const stats = contentEl.createDiv({cls: 'jd-validation-stats'});
		stats.createEl('p', {
			text: `Areas: ${this.result.areas.length} · Categories: ${this.result.categories.length} · IDs: ${this.result.ids.length}`,
		});

		// Errors
		if (this.result.errors.length > 0) {
			contentEl.createEl('h3', {text: 'Issues'});
			const errorList = contentEl.createEl('ul', {cls: 'jd-error-list'});

			for (const error of this.result.errors) {
				const item = errorList.createEl('li', {cls: 'jd-error-item'});
				item.createEl('strong', {text: ERROR_LABELS[error.type]});
				item.createEl('br');
				item.createEl('span', {text: error.path, cls: 'jd-error-path'});
				item.createEl('br');
				item.createEl('span', {text: error.message});

				if (error.suggestion) {
					item.createEl('br');
					item.createEl('em', {
						text: error.suggestion,
						cls: 'jd-error-suggestion',
					});
				}
			}
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
