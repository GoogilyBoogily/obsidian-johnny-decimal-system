import {Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, JDSettings, JDSettingTab} from "./settings";
import {registerCommands} from "./commands";
import {validateVault} from "./core/validator";
import {RenameEngine} from "./core/rename-engine";
import {registerFileMenu} from "./ui/file-menu";
import {NavigateModal} from "./ui/navigate-modal";

export default class JohnnyDecimalPlugin extends Plugin {
	settings: JDSettings;
	engine: RenameEngine;

	async onload() {
		await this.loadSettings();

		registerCommands(this);

		this.addSettingTab(new JDSettingTab(this.app, this));

		this.engine = new RenameEngine(this);
		this.registerEvent(
			this.app.vault.on('rename', this.engine.handleRename)
		);

		registerFileMenu(this);

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
		const raw = (await this.loadData() ?? {}) as Partial<JDSettings> & {
			ignorePatterns?: string[];
			defaultSystemPrefix?: string;
		};

		// One-time migration: old single `defaultSystemPrefix` string → the
		// managed `systems` list (system-as-folder model). Seed name = code;
		// user can rename it in settings. Only when `systems` is absent.
		if (raw.defaultSystemPrefix && raw.systems === undefined) {
			const code = raw.defaultSystemPrefix;
			raw.systems = [{code, name: code}];
		}
		delete raw.defaultSystemPrefix;

		// One-time migration: old `ignorePatterns` (exact folder names matched
		// at any depth) → `exclusions` as `**/<name>/**` globs, the
		// path-based equivalent of "this name anywhere". Only runs when the
		// new field is absent so it never clobbers user-set exclusions.
		if (raw.ignorePatterns && raw.exclusions === undefined) {
			raw.exclusions = raw.ignorePatterns
				.filter(n => n.length > 0)
				.map(n => `**/${n}/**`);
		}
		delete raw.ignorePatterns;

		this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
