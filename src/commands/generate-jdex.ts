import {Notice, TFile} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {validateVault} from '../core/validator';
import {formatFullId} from '../core/parser';

export function registerGenerateJdexCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'generate-jdex',
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		name: 'Generate JDex',
		callback: async () => {
			const result = validateVault(plugin.app, plugin.settings);

			if (result.areas.length === 0) {
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				new Notice('No JD structure found in vault');
				return;
			}

			const lines: string[] = [];
			 
			lines.push('# JDex');
			lines.push(`*Generated: ${new Date().toISOString().split('T')[0] ?? ''}*`);
			lines.push('');

			// Sort areas by range
			const sortedAreas = [...result.areas].sort((a, b) => a.rangeStart - b.rangeStart);

			for (const area of sortedAreas) {
				const areaPrefix = area.system ? `${area.system}.` : '';
				lines.push(
					`## ${areaPrefix}${area.rangeStart.toString().padStart(2, '0')}-${area.rangeEnd.toString().padStart(2, '0')} ${area.name}`
				);

				// Get categories for this area, sorted by number
				const areaCategories = result.categories
					.filter(c => c.parentArea.path === area.path)
					.sort((a, b) => a.number - b.number);

				for (const category of areaCategories) {
					const catPrefix = category.system ? `${category.system}.` : '';
					lines.push(
						`### ${catPrefix}${category.number.toString().padStart(2, '0')} ${category.name}`
					);

					// Get IDs for this category, sorted by id number
					const categoryIds = result.ids
						.filter(id => id.parentCategory.path === category.path)
						.sort((a, b) => a.id - b.id);

					if (categoryIds.length === 0) {
						 
						lines.push('*No IDs yet*');
					} else {
						for (const id of categoryIds) {
							const fullId = formatFullId(id.category, id.id, id.system);
							// Use wikilink format: [[path|display]]
							lines.push(`- [[${id.path}|${fullId} ${id.name}]]`);
						}
					}

					lines.push('');
				}

				if (areaCategories.length === 0) {
					lines.push('*No categories yet*');
					lines.push('');
				}
			}

			const content = lines.join('\n');
			const jdexPath = plugin.settings.jdexPath;
			const rootPath = plugin.settings.rootFolder;
			const fullPath = rootPath ? `${rootPath}/${jdexPath}` : jdexPath;

			try {
				const existing = plugin.app.vault.getAbstractFileByPath(fullPath);
				if (existing instanceof TFile) {
					await plugin.app.vault.modify(existing, content);
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					new Notice('JDex updated');
				} else {
					await plugin.app.vault.create(fullPath, content);
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					new Notice('JDex created');
				}

				// Open the JDex file
				await plugin.app.workspace.openLinkText(fullPath, '', false);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				 
				new Notice(`Failed to create JDex: ${message}`);
			}
		},
	});
}
