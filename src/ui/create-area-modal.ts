import {Modal, Setting, Notice} from 'obsidian';
import type {App} from 'obsidian';
import type {JDArea} from '../types';

export class CreateAreaModal extends Modal {
	private areas: JDArea[];
	private defaultSystem: string;
	private onSubmit: (rangeStart: number, name: string, system?: string) => Promise<void>;

	constructor(
		app: App,
		areas: JDArea[],
		defaultSystem: string,
		onSubmit: (rangeStart: number, name: string, system?: string) => Promise<void>
	) {
		super(app);
		this.areas = areas;
		this.defaultSystem = defaultSystem;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl('h2', {text: 'Create area'});

		const usedRanges = new Set(this.areas.map(a => a.rangeStart));

		// Check if all 10 ranges (00-09 through 90-99) are taken
		const allRangesUsed = usedRanges.size >= 10;
		if (allRangesUsed) {
			contentEl.createEl('p', {text: 'All area ranges are in use.'});
			return;
		}

		// Find first unused range
		let rangeStart = 0;
		for (let i = 0; i <= 90; i += 10) {
			if (!usedRanges.has(i)) {
				rangeStart = i;
				break;
			}
		}

		let name = '';

		new Setting(contentEl)
			.setName('Range start')
			.setDesc('Select the decade for this area')
			.addDropdown(dropdown => {
				for (let i = 0; i <= 90; i += 10) {
					if (usedRanges.has(i)) continue;
					const label = `${i.toString().padStart(2, '0')}-${(i + 9).toString().padStart(2, '0')}`;
					dropdown.addOption(i.toString(), label);
				}
				dropdown.setValue(rangeStart.toString());
				dropdown.onChange(value => {
					rangeStart = parseInt(value, 10);
				});
			});

		new Setting(contentEl)
			.setName('Name')
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Area name (e.g. "Life admin")')
			.addText(text =>
				text.setPlaceholder('Life admin').onChange(value => {
					name = value;
				})
			);

		new Setting(contentEl).addButton(btn =>
			btn
				.setButtonText('Create')
				.setCta()
				.onClick(async () => {
					if (!name.trim()) {
						new Notice('Please enter a name');
						return;
					}
					const system = this.defaultSystem || undefined;
					await this.onSubmit(rangeStart, name.trim(), system);
					this.close();
				})
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
