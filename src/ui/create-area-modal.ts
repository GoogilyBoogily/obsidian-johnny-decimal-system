import {Modal, Setting, Notice} from 'obsidian';
import type {App} from 'obsidian';
import type {JDSystem, JDArea} from '../types';

export class CreateAreaModal extends Modal {
	private systems: JDSystem[];
	private areas: JDArea[];
	private onSubmit: (
		system: JDSystem | null,
		rangeStart: number,
		name: string
	) => Promise<void>;

	constructor(
		app: App,
		systems: JDSystem[],
		areas: JDArea[],
		onSubmit: (
			system: JDSystem | null,
			rangeStart: number,
			name: string
		) => Promise<void>
	) {
		super(app);
		this.systems = systems;
		this.areas = areas;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl('h2', {text: 'Create area'});

		const multi = this.systems.length > 0;
		let selectedSystem: JDSystem | null = multi ? this.systems[0]! : null;
		let name = '';

		const rangeContainer = contentEl.createDiv();
		let rangeStart = 0;

		const buildRangeDropdown = () => {
			rangeContainer.empty();
			const code = selectedSystem ? selectedSystem.code : null;
			const usedRanges = new Set(
				this.areas.filter(a => a.system === code).map(a => a.rangeStart)
			);

			if (usedRanges.size >= 10) {
				rangeContainer.createEl('p', {text: 'All area ranges are in use.'});
				return;
			}

			rangeStart = 0;
			for (let i = 0; i <= 90; i += 10) {
				if (!usedRanges.has(i)) {
					rangeStart = i;
					break;
				}
			}

			new Setting(rangeContainer)
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
		};

		if (multi) {
			new Setting(contentEl)
				.setName('System')
				.setDesc('Parent system for this area')
				.addDropdown(dropdown => {
					for (const sys of this.systems) {
						dropdown.addOption(sys.code, `${sys.code} ${sys.name}`);
					}
					dropdown.setValue(selectedSystem!.code);
					dropdown.onChange(value => {
						selectedSystem =
							this.systems.find(s => s.code === value) ?? this.systems[0]!;
						buildRangeDropdown();
					});
				});
		}

		buildRangeDropdown();

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
					await this.onSubmit(selectedSystem, rangeStart, name.trim());
					this.close();
				})
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
