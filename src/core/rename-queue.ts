/**
 * Recursion-safe, serialized rename primitive shared by the rename engine,
 * the JDex/strip flows, and (Phase 7) the audit fix engine.
 *
 * Plugin-issued renames echo back as vault events. Each programmatic write
 * registers its destination in `inFlight`; an event handler calls
 * `consumeEcho(path)` first and bails on its own write. All mutating work is
 * funneled through one promise `chain` so concurrent bursts (and the rename
 * engine's own cascades) are applied strictly in order.
 */

import {App, TAbstractFile, TFolder, Notice} from 'obsidian';
import {flashPath} from '../ui/highlight';

export class RenameQueue {
	private inFlight = new Set<string>();
	private chain: Promise<void> = Promise.resolve();

	/**
	 * If `path` is a write this queue just issued, consume the marker and
	 * return true so the caller's event handler self-cancels.
	 */
	consumeEcho(path: string): boolean {
		if (this.inFlight.has(path)) {
			this.inFlight.delete(path);
			return true;
		}
		return false;
	}

	/** Append work to the serialized chain. Errors are logged, not thrown. */
	enqueue(task: () => Promise<void>, errorLabel: string): void {
		this.chain = this.chain.then(task).catch(err => {
			console.error(`[Johnny Decimal] ${errorLabel} error:`, err);
		});
	}

	/** Resolves when the current chain has drained (tests / unload / audit). */
	whenIdle(): Promise<void> {
		return this.chain;
	}

	/**
	 * Rename guarded against recursion. fileManager.renameFile for .md
	 * (preserves wikilinks/backlinks), vault.rename for folders. A pre-existing
	 * destination is reported and skipped rather than clobbered.
	 */
	async safeRename(
		app: App,
		file: TAbstractFile,
		newPath: string
	): Promise<void> {
		if (file.path === newPath) return;
		if (app.vault.getAbstractFileByPath(newPath)) {
			new Notice(`Cannot rename: "${newPath}" already exists.`);
			return;
		}

		this.inFlight.add(newPath);
		try {
			if (file instanceof TFolder) {
				await app.vault.rename(file, newPath);
			} else {
				await app.fileManager.renameFile(file, newPath);
			}
		} catch (err) {
			this.inFlight.delete(newPath);
			throw err;
		}
		flashPath(newPath);
	}
}
