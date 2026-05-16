import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import type JohnnyDecimalPlugin from "./main";
import {isValidSystemCode} from "./core/parser";
import {jdexFullPath} from "./core/jdex";

/** A registered system: code + display name. Folder path is derived. */
export interface SettingsSystem {
	code: string;
	name: string;
}

export interface JDSettings {
	rootFolder: string;
	/**
	 * Registered systems (managed list). Empty = single-system vault: areas
	 * live at the root with no system folder layer. Non-empty = multi-system:
	 * each system is a "<CODE> <Name>" folder under the root.
	 */
	systems: SettingsSystem[];
	/**
	 * Excluded vault paths (and/or globs). Subtree-inclusive: excluding a
	 * folder excludes that folder and every descendant. An excluded path is
	 * frozen — no auto-prefix, no propagation, no validation errors.
	 * Replaces the old exact-name `ignorePatterns` (migrated on load).
	 */
	exclusions: string[];
	jdexPath: string;
	/** Master switch for the rename/move auto-prefix engine. */
	autoPrefixEnabled: boolean;
	/** Strip the JD prefix when an item is moved out of the JD structure. */
	stripPrefixOnExit: boolean;
	/** Keep the JDex file in sync automatically on create/rename/delete. */
	autoSyncJdex: boolean;
	/**
	 * Which audit fixes "Audit and fix" / "Apply all safe" may apply
	 * unattended. off = manual modal only; safe = padding + free misfiled-ID;
	 * aggressive = also duplicate renumber (changes a note's JD address).
	 */
	auditFixMode: 'off' | 'safe' | 'aggressive';
}

export const DEFAULT_SETTINGS: JDSettings = {
	rootFolder: '',
	systems: [],
	exclusions: [],
	jdexPath: 'JDex.md',
	autoPrefixEnabled: true,
	stripPrefixOnExit: true,
	autoSyncJdex: true,
	auditFixMode: 'safe',
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
			.setName('Systems')
			.setHeading();

		new Setting(containerEl)
			.setName('Multiple systems')
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- "CODE Name" is a literal format example
			.setDesc('Each registered system is a top-level "CODE Name" folder containing its own areas. Leave empty for a single-system vault (areas at the root, no system folder).');

		for (const sys of this.plugin.settings.systems) {
			new Setting(containerEl)
				.setName(`${sys.code} ${sys.name}`)
				.addButton(btn => btn
					.setButtonText('Remove')
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.systems =
							this.plugin.settings.systems.filter(s => s.code !== sys.code);
						await this.plugin.saveSettings();
						this.display();
					}));
		}

		let newCode = '';
		let newName = '';
		new Setting(containerEl)
			.setName('Add system')
			.setDesc('Code (letter + 2 digits, e.g. H01) and a display name.')
			.addText(text => text
				.setPlaceholder('H01')
				.onChange(value => {
					newCode = value.toUpperCase().trim();
				}))
			.addText(text => text
				.setPlaceholder('Personal')
				.onChange(value => {
					newName = value.trim();
				}))
			.addButton(btn => btn
				.setButtonText('Add')
				.setCta()
				.onClick(async () => {
					if (!isValidSystemCode(newCode)) {
						new Notice('System code must be a letter followed by 2 digits (e.g. H01)');
						return;
					}
					if (!newName) {
						new Notice('Enter a system name');
						return;
					}
					if (this.plugin.settings.systems.some(s => s.code === newCode)) {
						new Notice(`System ${newCode} already exists`);
						return;
					}
					this.plugin.settings.systems.push({code: newCode, name: newName});
					await this.plugin.saveSettings();
					this.display();
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
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setName('JDex path')
			.setDesc('Path for the generated index file (relative to root folder)')
			.addText(text => text
				.setPlaceholder('JDex.md')
				.setValue(this.plugin.settings.jdexPath)
				.onChange(async (value) => {
					const oldPath = jdexFullPath(this.plugin);
					this.plugin.settings.jdexPath = value;
					await this.plugin.saveSettings();
					const newPath = jdexFullPath(this.plugin);
					if (
						oldPath !== newPath &&
						this.plugin.app.vault.getAbstractFileByPath(oldPath)
					) {
						new Notice(`Old JDex left at "${oldPath}" — delete it manually if unwanted`);
					}
					this.plugin.jdexSync?.scheduleSync();
				}));

		new Setting(containerEl)
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setName('Auto-sync JDex')
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Regenerate the JDex automatically when items are created, renamed, moved, or deleted.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSyncJdex)
				.onChange(async (value) => {
					this.plugin.settings.autoSyncJdex = value;
					await this.plugin.saveSettings();
					if (value) this.plugin.jdexSync?.scheduleSync();
				}));

		new Setting(containerEl)
			.setName('Audit auto-fix mode')
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Which numbering fixes "Audit and fix" applies without per-item selection. Off: manual only. Safe: padding + misfiled IDs with a free slot. Aggressive: also renumber duplicates (changes a note’s ID).')
			.addDropdown(dd => dd
				.addOption('off', 'Off (manual only)')
				.addOption('safe', 'Safe')
				.addOption('aggressive', 'Aggressive')
				.setValue(this.plugin.settings.auditFixMode)
				.onChange(async (value) => {
					this.plugin.settings.auditFixMode =
						value as 'off' | 'safe' | 'aggressive';
					await this.plugin.saveSettings();
				}));
	}
}
