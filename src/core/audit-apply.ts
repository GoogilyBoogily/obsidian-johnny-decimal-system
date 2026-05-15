/**
 * Applies selected audit FixActions. Routed through the rename engine's shared
 * RenameQueue so engine echo-guard + serialization apply (the engine will not
 * re-number audit-issued renames). Deepest paths first so a parent rename
 * never invalidates a still-queued child path; each target is re-resolved at
 * execution time because earlier renames mutate the tree.
 */

import type JohnnyDecimalPlugin from '../main';
import type {FixAction} from '../types';

export async function applyFixes(
	plugin: JohnnyDecimalPlugin,
	fixes: FixAction[]
): Promise<number> {
	const renames = fixes.flatMap(f => f.renames);
	renames.sort(
		(a, b) => b.from.split('/').length - a.from.split('/').length
	);

	const queue = plugin.engine.queue;
	const counter = {applied: 0};

	for (const r of renames) {
		queue.enqueue(async () => {
			const file = plugin.app.vault.getAbstractFileByPath(r.from);
			if (!file) return; // moved/renamed by an earlier fix — skip
			await queue.safeRename(plugin.app, file, r.to);
			counter.applied++;
		}, 'audit fix');
	}

	await queue.whenIdle();
	return counter.applied;
}
