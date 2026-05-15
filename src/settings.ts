import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import type JohnnyDecimalPlugin from "./main";

export interface JDSettings {
	rootFolder: string;
	defaultSystemPrefix: string;
	ignorePatterns: string[];
	idNoteTemplate: string;
	jdexPath: string;
}

export const DEFAULT_SETTINGS: JDSettings = {
	rootFolder: '',
	defaultSystemPrefix: '',
	ignorePatterns: [],
	idNoteTemplate: '# {{name}}\n\nCreated: {{date}}\n',
	jdexPath: 'JDex.md',
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
			 
			.setName('Ignore patterns')
			.setDesc('Folder names to ignore during validation (comma-separated, exact matching)')
			.addText(text => text
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setPlaceholder('templates, archive')
				.setValue(this.plugin.settings.ignorePatterns.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.ignorePatterns = value
						.split(',')
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
