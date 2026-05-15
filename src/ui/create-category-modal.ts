import {Modal, Setting, Notice} from 'obsidian';
import type {App} from 'obsidian';
import type {JDArea, JDCategory} from '../types';

export class CreateCategoryModal extends Modal {
	private areas: JDArea[];
	private categories: JDCategory[];
	private onSubmit: (area: JDArea, number: number, name: string) => Promise<void>;

	constructor(
		app: App,
		areas: JDArea[],
		categories: JDCategory[],
		onSubmit: (area: JDArea, number: number, name: string) => Promise<void>
	) {
		super(app);
		this.areas = areas;
		this.categories = categories;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl('h2', {text: 'Create category'});

		if (this.areas.length === 0) {
			contentEl.createEl('p', {text: 'No areas found. Create an area first.'});
			return;
		}

		let selectedArea: JDArea = this.areas[0]!;
		let categoryNumber = selectedArea.rangeStart;
		let name = '';

		const getUsedInArea = (area: JDArea) =>
			new Set(
				this.categories
					.filter(c => c.parentArea.path === area.path)
					.map(c => c.number)
			);

		let usedCategories = getUsedInArea(selectedArea);

		const areaSetting = new Setting(contentEl)
			.setName('Area')
			.setDesc('Select the parent area');

		// Container for the category dropdown - we'll rebuild it when area changes
		const categoryContainer = contentEl.createDiv();

		const buildCategoryDropdown = () => {
			categoryContainer.empty();

			// Check if all numbers in this area are used
			let hasAvailable = false;
			for (let i = selectedArea.rangeStart; i <= selectedArea.rangeEnd; i++) {
				if (!usedCategories.has(i)) {
					hasAvailable = true;
					categoryNumber = i;
					break;
				}
			}

			if (!hasAvailable) {
				categoryContainer.createEl('p', {
					text: 'All category numbers in this area are in use.',
				});
				return;
			}

			new Setting(categoryContainer)
				.setName('Category number')
				.setDesc('Select the category number')
				.addDropdown(dropdown => {
					for (let i = selectedArea.rangeStart; i <= selectedArea.rangeEnd; i++) {
						if (usedCategories.has(i)) continue;
						const label = i.toString().padStart(2, '0');
						dropdown.addOption(i.toString(), label);
					}
					dropdown.setValue(categoryNumber.toString());
					dropdown.onChange(value => {
						categoryNumber = parseInt(value, 10);
					});
				});
		};

		areaSetting.addDropdown(dropdown => {
			for (const area of this.areas) {
				const label = `${area.rangeStart}-${area.rangeEnd} ${area.name}`;
				dropdown.addOption(area.path, label);
			}
			dropdown.setValue(selectedArea.path);
			dropdown.onChange(value => {
				selectedArea = this.areas.find(a => a.path === value) ?? this.areas[0]!;
				usedCategories = getUsedInArea(selectedArea);
				buildCategoryDropdown();
			});
		});

		buildCategoryDropdown();

		new Setting(contentEl)
			.setName('Name')
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Category name (e.g. "Travel")')
			.addText(text =>
				text.setPlaceholder('Travel').onChange(value => {
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
					if (usedCategories.has(categoryNumber)) {
						new Notice('This category number is already in use');
						return;
					}
					await this.onSubmit(selectedArea, categoryNumber, name.trim());
					this.close();
				})
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
