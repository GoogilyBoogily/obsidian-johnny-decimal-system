import {Modal, Setting} from 'obsidian';
import type {App} from 'obsidian';

/** Minimal single-field name prompt. The number/ID is computed elsewhere. */
export class NamePromptModal extends Modal {
	private title: string;
	private onSubmit: (name: string) => void;

	constructor(app: App, title: string, onSubmit: (name: string) => void) {
		super(app);
		this.title = title;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl('h2', {text: this.title});

		let name = '';
		const submit = () => {
			const trimmed = name.trim();
			if (!trimmed) return;
			this.close();
			this.onSubmit(trimmed);
		};

		new Setting(contentEl)
			.setName('Name')
			.addText(text => {
				text.setPlaceholder('Name').onChange(v => {
					name = v;
				});
				text.inputEl.addEventListener('keydown', e => {
					if (e.key === 'Enter') submit();
				});
				window.setTimeout(() => text.inputEl.focus(), 0);
			});

		new Setting(contentEl).addButton(btn =>
			btn.setButtonText('Create').setCta().onClick(submit)
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
