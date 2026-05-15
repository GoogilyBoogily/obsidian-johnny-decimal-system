import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import type JohnnyDecimalPlugin from "./main";

export interface JDSettings {
	rootFolder: string;
	defaultSystemPrefix: string;
	/**
	 * Excluded vault paths (and/or globs). Subtree-inclusive: excluding a
	 * folder excludes that folder and every descendant. An excluded path is
	 * frozen — no auto-prefix, no propagation, no validation errors.
	 * Replaces the old exact-name `ignorePatterns` (migrated on load).
	 */
	exclusions: string[];
	idNoteTemplate: string;
	jdexPath: string;
	/** Master switch for the rename/move auto-prefix engine. */
	autoPrefixEnabled: boolean;
	/** Strip the JD prefix when an item is moved out of the JD structure. */
	stripPrefixOnExit: boolean;
}

export const DEFAULT_SETTINGS: JDSettings = {
	rootFolder: '',
	defaultSystemPrefix: '',
	exclusions: [],
	idNoteTemplate: '# {{name}}\n\nCreated: {{date}}\n',
	jdexPath: 'JDex.md',
	autoPrefixEnabled: true,
	stripPrefixOnExit: true,
};

export class JDSettingTab extends PluginSettingTab {
	plugin: JohnnyDecimalPlugin;

	constructor(app: App, plugin: JohnnyDecimalPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Johnny Decimal" is a proper noun/brand name
			.setName('Johnny Decimal')
			.setHeading();

		new Setting(containerEl)
			.setName('Root folder')
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Folder where your JD system starts (leave empty for vault root)')
			.addText(text => text
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setPlaceholder('JD or Projects')
				.setValue(this.plugin.settings.rootFolder)
				.onChange(async (value) => {
					this.plugin.settings.rootFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default system prefix')
			.setDesc('System prefix for multi-system vaults. Format: letter + 2 digits (e.g. H01). Leave empty for single-system.')
			.addText(text => text
				.setPlaceholder('H01')
				.setValue(this.plugin.settings.defaultSystemPrefix)
				.onChange(async (value) => {
					const upper = value.toUpperCase();
					if (upper && !/^[A-Z]\d{2}$/.test(upper)) {
						new Notice('System prefix must be a letter followed by 2 digits (e.g. H01)');
						return;
					}
					this.plugin.settings.defaultSystemPrefix = upper;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-prefix on move and rename')
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Johnny Decimal" is a proper noun/brand name
			.setDesc('Automatically assign and propagate Johnny Decimal prefixes when folders/files are moved or renamed. Disable to make all prefixing manual.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoPrefixEnabled)
				.onChange(async (value) => {
					this.plugin.settings.autoPrefixEnabled = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.autoPrefixEnabled) {
			new Setting(containerEl)
				.setName('Strip prefix when moved out')
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- "JD"/"Johnny Decimal" are proper nouns
				.setDesc('Remove the JD prefix from an item moved out of the Johnny Decimal structure.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.stripPrefixOnExit)
					.onChange(async (value) => {
						this.plugin.settings.stripPrefixOnExit = value;
						await this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl)
			.setName('Exclusions')
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Johnny Decimal" is a proper noun/brand name
			.setDesc('Vault paths excluded from Johnny Decimal — one per line. Subtree-inclusive: excluding a folder excludes everything under it. Excluded paths get no auto-prefix and no validation errors.')
			.addTextArea(text => text
				.setPlaceholder('70-79 Journals & Self-Tracking/72 Daily Tracking\n30-39 Knowledge & Inspiration/35 Web Resources & Sites/35.00 Karakeep')
				.setValue(this.plugin.settings.exclusions.join('\n'))
				.onChange(async (value) => {
					this.plugin.settings.exclusions = value
						.split('\n')
						.map(p => p.trim())
						.filter(p => p.length > 0);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			 
			.setName('ID note template')
			.setDesc('Template for new ID notes. {{name}} = note name, {{date}} = YYYY-MM-DD, {{id}} = full ID (e.g. 11.01)')
			.addTextArea(text => text
				.setPlaceholder('# {{name}}\n\nCreated: {{date}}')
				.setValue(this.plugin.settings.idNoteTemplate)
				.onChange(async (value) => {
					this.plugin.settings.idNoteTemplate = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setName('JDex path')
			.setDesc('Path for the generated index file (relative to root folder)')
			.addText(text => text
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setPlaceholder('JDex.md')
				.setValue(this.plugin.settings.jdexPath)
				.onChange(async (value) => {
					this.plugin.settings.jdexPath = value;
					await this.plugin.saveSettings();
				}));
	}
}
