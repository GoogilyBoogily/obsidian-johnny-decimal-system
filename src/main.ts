import {Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, JDSettings, JDSettingTab} from "./settings";
import {registerCommands} from "./commands";
import {validateVault} from "./core/validator";
import {NavigateModal} from "./ui/navigate-modal";

export default class JohnnyDecimalPlugin extends Plugin {
	settings: JDSettings;

	async onload() {
		await this.loadSettings();

		registerCommands(this);

		this.addSettingTab(new JDSettingTab(this.app, this));

		// eslint-disable-next-line obsidianmd/ui/sentence-case
		this.addRibbonIcon('folder-tree', 'Johnny Decimal navigation', () => {
			this.openNavigateModal();
		});
	}

	onunload() {}

	openNavigateModal() {
		const result = validateVault(this.app, this.settings);

		if (result.ids.length === 0) {
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Notice('No JD IDs found in vault');
			return;
		}

		new NavigateModal(this.app, result.ids).open();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<JDSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
