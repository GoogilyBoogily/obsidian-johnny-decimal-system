import {Modal, Setting, Notice} from 'obsidian';
import type {App} from 'obsidian';
import {isValidSystemCode} from '../core/parser';

export class CreateSystemModal extends Modal {
	private onSubmit: (code: string, name: string) => Promise<void>;

	constructor(app: App, onSubmit: (code: string, name: string) => Promise<void>) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl('h2', {text: 'Create system'});

		let code = '';
		let name = '';

		new Setting(contentEl)
			.setName('System code')
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Letter + 2 digits (e.g. H01, W01)')
			.addText(text =>
				text.setPlaceholder('H01').onChange(value => {
					code = value.toUpperCase().trim();
				})
			);

		new Setting(contentEl)
			.setName('System name')
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Display name (e.g. "Personal")')
			.addText(text =>
				text.setPlaceholder('Personal').onChange(value => {
					name = value.trim();
				})
			);

		new Setting(contentEl).addButton(btn =>
			btn
				.setButtonText('Create')
				.setCta()
				.onClick(async () => {
					if (!isValidSystemCode(code)) {
						new Notice('Invalid code. Use letter + 2 digits (e.g. H01)');
						return;
					}
					if (!name) {
						new Notice('Enter a system name');
						return;
					}
					await this.onSubmit(code, name);
					this.close();
				})
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
