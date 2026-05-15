import {Modal, Setting} from 'obsidian';
import type {App} from 'obsidian';

/** Generic yes/no confirm. onConfirm runs only on the affirmative button. */
export class ConfirmModal extends Modal {
	private titleText: string;
	private body: string;
	private confirmLabel: string;
	private onConfirm: () => void;

	constructor(
		app: App,
		titleText: string,
		body: string,
		confirmLabel: string,
		onConfirm: () => void
	) {
		super(app);
		this.titleText = titleText;
		this.body = body;
		this.confirmLabel = confirmLabel;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl('h2', {text: this.titleText});
		contentEl.createEl('p', {text: this.body});

		new Setting(contentEl)
			.addButton(btn =>
				btn.setButtonText('Cancel').onClick(() => this.close())
			)
			.addButton(btn =>
				btn
					.setButtonText(this.confirmLabel)
					.setWarning()
					.onClick(() => {
						this.close();
						this.onConfirm();
					})
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}
