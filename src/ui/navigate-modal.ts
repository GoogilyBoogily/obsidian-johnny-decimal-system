import {App, SuggestModal} from 'obsidian';
import type {JDId} from '../types';
import {formatFullId} from '../core/parser';

export class NavigateModal extends SuggestModal<JDId> {
	private ids: JDId[];

	constructor(app: App, ids: JDId[]) {
		super(app);
		this.ids = ids;
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		this.setPlaceholder('Type to search IDs...');
	}

	getSuggestions(query: string): JDId[] {
		const lower = query.toLowerCase();
		return this.ids.filter(id => {
			const fullId = formatFullId(id.category, id.id, id.system);
			const searchText = `${fullId} ${id.name}`.toLowerCase();
			return searchText.includes(lower);
		});
	}

	renderSuggestion(id: JDId, el: HTMLElement) {
		const fullId = formatFullId(id.category, id.id, id.system);
		el.createEl('div', {text: `${fullId} ${id.name}`, cls: 'jd-suggest-title'});
		el.createEl('small', {
			text: id.parentCategory.parentArea.name + ' → ' + id.parentCategory.name,
			cls: 'jd-suggest-path',
		});
	}

	onChooseSuggestion(id: JDId) {
		void this.app.workspace.openLinkText(id.path, '', false);
	}
}
