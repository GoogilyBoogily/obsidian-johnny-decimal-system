import {Notice} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {writeJdex, jdexFullPath} from '../core/jdex';

export function registerGenerateJdexCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'generate-jdex',
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		name: 'Generate JDex',
		callback: async () => {
			const result = await writeJdex(plugin);

			switch (result) {
				case 'no-structure':
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					new Notice('No JD structure found in vault');
					return;
				case 'aborted-foreign':
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					new Notice('JDex file has non-generated content and no JD markers — not overwriting');
					return;
				case 'skipped':
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					new Notice('JDex already up to date');
					break;
				case 'created':
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					new Notice('JDex created');
					break;
				case 'updated':
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					new Notice('JDex updated');
					break;
			}

			await plugin.app.workspace.openLinkText(jdexFullPath(plugin), '', false);
		},
	});
}
