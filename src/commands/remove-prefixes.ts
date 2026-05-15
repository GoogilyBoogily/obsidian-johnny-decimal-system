import {Notice, TFolder} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {ConfirmModal} from '../ui/confirm-modal';
import {unJd} from '../core/strip';

export function registerRemovePrefixesCommand(plugin: JohnnyDecimalPlugin) {
	plugin.addCommand({
		id: 'remove-prefixes',
		name: 'Remove prefixes from current folder',
		callback: () => {
			const active = plugin.app.workspace.getActiveFile();
			const folder = active?.parent;
			if (!folder || !(folder instanceof TFolder)) {
				new Notice('Open a note inside the folder you want to un-prefix');
				return;
			}

			new ConfirmModal(
				plugin.app,
				'Remove JD prefixes?',
				`Strip JD numbering from everything under "${folder.path}" and exclude this folder so it is no longer auto-numbered. This renames files/folders.`,
				'Remove',
				() => void unJd(plugin, folder)
			).open();
		},
	});
}
