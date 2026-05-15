import {Modal, Setting, Notice} from 'obsidian';
import type {App} from 'obsidian';
import type {JDCategory} from '../types';

export class CreateIdModal extends Modal {
	private categories: JDCategory[];
	private onSubmit: (category: JDCategory, name: string) => Promise<void>;

	private preselectCategoryPath: string | null;

	constructor(
		app: App,
		categories: JDCategory[],
		onSubmit: (category: JDCategory, name: string) => Promise<void>,
		preselectCategoryPath?: string
	) {
		super(app);
		this.categories = categories;
		this.onSubmit = onSubmit;
		this.preselectCategoryPath = preselectCategoryPath ?? null;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl('h2', {text: 'Create ID'});

		if (this.categories.length === 0) {
			contentEl.createEl('p', {text: 'No categories found. Create a category first.'});
			return;
		}

		let selectedCategory: JDCategory =
			this.categories.find(c => c.path === this.preselectCategoryPath)
			?? this.categories[0]!;
		let name = '';

		new Setting(contentEl)
			.setName('Category')
			.setDesc('Select the parent category')
			.addDropdown(dropdown => {
				for (const cat of this.categories) {
					const label = `${cat.number.toString().padStart(2, '0')} ${cat.name}`;
					dropdown.addOption(cat.path, label);
				}
				dropdown.setValue(selectedCategory.path);
				dropdown.onChange(value => {
					selectedCategory = this.categories.find(c => c.path === value) ?? this.categories[0]!;
				});
			});

		new Setting(contentEl)
			.setName('Name')
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('ID name (e.g. "NYC trip")')
			.addText(text =>
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text.setPlaceholder('NYC trip').onChange(value => {
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
					await this.onSubmit(selectedCategory, name.trim());
					this.close();
				})
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
