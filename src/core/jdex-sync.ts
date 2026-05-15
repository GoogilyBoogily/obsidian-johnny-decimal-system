/**
 * Keeps the JDex in sync on create / rename / move / delete.
 *
 * Design (see PLAN.md Phase 6): debounced full regen, NOT an incremental
 * delta-map. The JD tree is tiny and validateVault is in-memory; only the
 * write is costly, and writeJdex() is idempotent (skips when the structural
 * body is unchanged). A trailing resetTimer debounce also coalesces the
 * folder-rename event burst AND lets the rename engine's cascade settle
 * before regen runs (its renames keep resetting the timer), so the engine's
 * internals never need to be observed. `modify` is intentionally NOT watched
 * — JDex indexes structure/paths, not note contents — which also removes the
 * main self-write-loop vector.
 */

import {TAbstractFile, debounce, type Debouncer} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {isExcluded} from './exclusions';
import {writeJdex, jdexFullPath} from './jdex';

export class JdexSync {
	private debounced: Debouncer<[], void>;

	constructor(private plugin: JohnnyDecimalPlugin) {
		this.debounced = debounce(() => void this.run(), 500, true);
	}

	/** Public entry — also called from settings changes. */
	scheduleSync(): void {
		this.debounced();
	}

	private async run(): Promise<void> {
		if (!this.plugin.settings.autoSyncJdex) return;
		await writeJdex(this.plugin);
	}

	private excluded(path: string): boolean {
		return isExcluded(path, this.plugin.settings.exclusions);
	}

	private isOwnFile(path: string): boolean {
		return path === jdexFullPath(this.plugin);
	}

	private onChange = (file: TAbstractFile): void => {
		if (!this.plugin.settings.autoSyncJdex) return;
		if (this.isOwnFile(file.path)) return; // self-write guard
		if (this.excluded(file.path)) return;
		this.scheduleSync();
	};

	private onRename = (file: TAbstractFile, oldPath: string): void => {
		if (!this.plugin.settings.autoSyncJdex) return;
		if (this.isOwnFile(file.path) || this.isOwnFile(oldPath)) return;
		// Relevant unless BOTH sides are excluded.
		if (this.excluded(file.path) && this.excluded(oldPath)) return;
		this.scheduleSync();
	};

	register(): void {
		const p = this.plugin;
		p.registerEvent(p.app.vault.on('delete', this.onChange));
		p.registerEvent(p.app.vault.on('rename', this.onRename));
		// 'create' after layout-ready: skip the initial vault-load storm.
		p.app.workspace.onLayoutReady(() => {
			p.registerEvent(p.app.vault.on('create', this.onChange));
			if (p.settings.autoSyncJdex) this.scheduleSync(); // initial build
		});
		// Flush a pending debounced write on unload.
		p.register(() => this.debounced.run());
	}
}
