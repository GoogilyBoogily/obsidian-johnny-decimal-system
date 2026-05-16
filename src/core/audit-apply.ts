/**
 * Applies selected audit FixActions. Routed through the rename engine's shared
 * RenameQueue so engine echo-guard + serialization apply (the engine will not
 * re-number audit-issued renames). Deepest paths first so a parent rename
 * never invalidates a still-queued child path; each target is re-resolved at
 * execution time because earlier renames mutate the tree.
 */

import type JohnnyDecimalPlugin from '../main';
import type {FixAction} from '../types';
import {auditVault} from './auditor';

const MAX_PASSES = 5;

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

/**
 * Re-audit → apply every autoFixable finding → repeat, until none remain or
 * a pass makes no progress (collision/cycle) or the pass cap is hit. Renames
 * change paths, so re-auditing between passes is required.
 */
export async function autoFixLoop(
	plugin: JohnnyDecimalPlugin
): Promise<{fixed: number; remaining: number}> {
	let fixed = 0;
	for (let pass = 0; pass < MAX_PASSES; pass++) {
		const report = auditVault(plugin.app, plugin.settings);
		const fixes = report.findings
			.filter(f => f.autoFixable && f.fix)
			.map(f => f.fix!);
		if (fixes.length === 0) break;

		const n = await applyFixes(plugin, fixes);
		fixed += n;
		if (n === 0) break; // zero-progress — blocked, stop looping
	}
	const final = auditVault(plugin.app, plugin.settings);
	return {fixed, remaining: final.findings.length};
}
