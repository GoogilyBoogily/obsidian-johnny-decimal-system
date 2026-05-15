import {Modal, Setting, Notice} from 'obsidian';
import type {App} from 'obsidian';

export class CreateSystemModal extends Modal {
	private onSubmit: (prefix: string) => Promise<void>;

	constructor(app: App, onSubmit: (prefix: string) => Promise<void>) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl('h2', {text: 'Create system'});

		let prefix = '';

		new Setting(contentEl)
			.setName('System prefix')
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Format: Letter + 2 digits (H01, W01)')
			.addText(text =>
				text.setPlaceholder('H01').onChange(value => {
					prefix = value.toUpperCase();
				})
			);

		new Setting(contentEl).addButton(btn =>
			btn
				.setButtonText('Create')
				.setCta()
				.onClick(async () => {
					if (!/^[A-Z]\d{2}$/.test(prefix)) {
						// eslint-disable-next-line obsidianmd/ui/sentence-case
						new Notice('Invalid prefix format. Use letter + 2 digits (H01)');
						return;
					}
					await this.onSubmit(prefix);
					this.close();
				})
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
