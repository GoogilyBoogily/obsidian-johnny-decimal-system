/**
 * Vault numbering audit. Builds on validateVault for system-level structural
 * errors, then does its own focused traversal to find numbering issues that
 * carry an actionable fix: padding, misfiled IDs, duplicates (with a
 * deterministic tiebreak), and gaps (info only — JD permits gaps, never
 * auto-closed; renumbering breaks links).
 *
 * Fixes are declarative ({from,to} renames). Applying them is audit-apply.ts.
 */

import {TFolder, TFile} from 'obsidian';
import type {App} from 'obsidian';
import type {JDSettings} from '../settings';
import type {AuditFinding, AuditReport} from '../types';
import {validateVault} from './validator';
import {parseSystem, parseArea, parseCategory, parseId} from './parser';
import {isExcluded} from './exclusions';

function isExcludedScope(path: string, settings: JDSettings): boolean {
	return isExcluded(path, settings.exclusions);
}

export function auditVault(app: App, settings: JDSettings): AuditReport {
	const findings: AuditFinding[] = [];

	// 1. System-level structural errors from the validator (no auto-fix —
	//    requires the user to register a system or rename the folder).
	const v = validateVault(app, settings);
	for (const e of v.errors) {
		if (
			e.type === 'INVALID_SYSTEM_NAME' ||
			e.type === 'UNKNOWN_SYSTEM' ||
			e.type === 'DUPLICATE_SYSTEM'
		) {
			findings.push({
				severity: 'error',
				kind: 'SYSTEM',
				path: e.path,
				message: e.message,
			});
		}
	}

	// 2. Numbering traversal.
	const rootPath = settings.rootFolder || '';
	const root = rootPath
		? app.vault.getAbstractFileByPath(rootPath)
		: app.vault.getRoot();
	if (!(root instanceof TFolder)) return {findings};

	const areaParents: TFolder[] =
		settings.systems.length > 0
			? root.children.filter(
					(c): c is TFolder =>
						c instanceof TFolder && parseSystem(c.name) !== null
				)
			: [root];

	for (const sysFolder of areaParents) {
		for (const areaFolder of folders(sysFolder, settings)) {
			const area = parseArea(areaFolder.name);
			if (!area) continue;
			auditCategories(areaFolder, area, settings, findings);
		}
	}

	// One post-pass: tag auto-fix eligibility per kind-based safety tier.
	const mode = settings.auditFixMode;
	for (const f of findings) {
		f.autoFixable =
			!!f.fix &&
			mode !== 'off' &&
			(f.kind === 'PADDING' ||
				f.kind === 'MISFILED_ID' || // fix only present when target free
				(f.kind === 'DUPLICATE' && mode === 'aggressive'));
	}

	return {findings};
}

function folders(parent: TFolder, settings: JDSettings): TFolder[] {
	return parent.children.filter(
		(c): c is TFolder =>
			c instanceof TFolder && !isExcludedScope(c.path, settings)
	);
}

function pad(n: number): string {
	return n.toString().padStart(2, '0');
}

function auditCategories(
	areaFolder: TFolder,
	area: {rangeStart: number; rangeEnd: number},
	settings: JDSettings,
	out: AuditFinding[]
): void {
	const byNumber = new Map<number, TFolder[]>();

	for (const folder of folders(areaFolder, settings)) {
		const strict = parseCategory(folder.name);
		const loose = folder.name.match(/^(\d{1,2})\s+(.+)$/);

		// Padding: parses loosely as 1 digit but not strictly as 2.
		if (!strict && loose && loose[1] && loose[2]) {
			const num = parseInt(loose[1], 10);
			const fixed = `${pad(num)} ${loose[2]}`;
			if (parseCategory(fixed)) {
				out.push({
					severity: 'warn',
					kind: 'PADDING',
					path: folder.path,
					message: `Category "${folder.name}" is not zero-padded → "${fixed}"`,
					fix: {
						renames: [
							{from: folder.path, to: `${areaFolder.path}/${fixed}`},
						],
					},
				});
			}
			continue;
		}
		if (!strict) continue;

		if (
			strict.number < area.rangeStart ||
			strict.number > area.rangeEnd
		) {
			out.push({
				severity: 'error',
				kind: 'MISFILED_ID',
				path: folder.path,
				message: `Category ${strict.number} is outside area range ${area.rangeStart}-${area.rangeEnd} (move or renumber manually)`,
			});
		}

		const list = byNumber.get(strict.number) ?? [];
		list.push(folder);
		byNumber.set(strict.number, list);

		auditIds(folder, strict.number, settings, out);
	}

	dedupe(
		byNumber,
		areaFolder,
		area,
		(n, nm) => `${pad(n)} ${nm}`,
		'category',
		out
	);
	gaps([...byNumber.keys()], 'category', areaFolder.path, out);
}

function auditIds(
	catFolder: TFolder,
	catNumber: number,
	settings: JDSettings,
	out: AuditFinding[]
): void {
	const byId = new Map<number, TFile[]>();

	for (const child of catFolder.children) {
		if (!(child instanceof TFile) || !child.name.endsWith('.md')) continue;
		if (isExcludedScope(child.path, settings)) continue;

		const base = child.name.replace(/\.md$/, '');
		const strict = parseId(base);
		const loose = base.match(/^(\d{1,2})\.(\d{1,2})\s+(.+)$/);

		if (!strict && loose && loose[1] && loose[2] && loose[3]) {
			const c = parseInt(loose[1], 10);
			const i = parseInt(loose[2], 10);
			const fixed = `${pad(c)}.${pad(i)} ${loose[3]}`;
			if (parseId(fixed)) {
				out.push({
					severity: 'warn',
					kind: 'PADDING',
					path: child.path,
					message: `ID "${child.name}" is not zero-padded → "${fixed}.md"`,
					fix: {
						renames: [
							{
								from: child.path,
								to: `${catFolder.path}/${fixed}.md`,
							},
						],
					},
				});
			}
			continue;
		}
		if (!strict) continue;

		if (strict.category !== catNumber) {
			const target = `${pad(catNumber)}.${pad(strict.id)} ${strict.name}`;
			const targetPath = `${catFolder.path}/${target}.md`;
			const free = !catFolder.children.some(c => c.path === targetPath);
			out.push({
				severity: 'error',
				kind: 'MISFILED_ID',
				path: child.path,
				message: `ID ${strict.category}.${strict.id} is in category ${catNumber} → "${target}.md"${free ? '' : ' (target occupied — resolve manually)'}`,
				...(free
					? {fix: {renames: [{from: child.path, to: targetPath}]}}
					: {}),
			});
		}

		const list = byId.get(strict.id) ?? [];
		list.push(child);
		byId.set(strict.id, list);
	}

	dedupeIds(byId, catFolder, catNumber, out);
	gaps([...byId.keys()], 'ID', catFolder.path, out);
}

/** Keep the lexicographically-lowest path; renumber the rest to next free. */
function dedupe(
	byNumber: Map<number, TFolder[]>,
	areaFolder: TFolder,
	area: {rangeStart: number; rangeEnd: number},
	fmt: (n: number, name: string) => string,
	label: string,
	out: AuditFinding[]
): void {
	const used = new Set(byNumber.keys());
	for (const [num, group] of byNumber) {
		if (group.length < 2) continue;
		const sorted = [...group].sort((a, b) => a.path.localeCompare(b.path));
		for (let k = 1; k < sorted.length; k++) {
			const loser = sorted[k]!;
			let next = area.rangeStart;
			while (next <= area.rangeEnd && used.has(next)) next++;
			const nm = parseCategory(loser.name)?.name ?? loser.name;
			if (next > area.rangeEnd) {
				out.push({
					severity: 'error',
					kind: 'DUPLICATE',
					path: loser.path,
					message: `Duplicate ${label} ${num}; area full, resolve manually`,
				});
				continue;
			}
			used.add(next);
			const to = `${areaFolder.path}/${fmt(next, nm)}`;
			out.push({
				severity: 'warn',
				kind: 'DUPLICATE',
				path: loser.path,
				message: `Duplicate ${label} ${num} → renumber to ${pad(next)} (kept: "${sorted[0]!.path}")`,
				fix: {renames: [{from: loser.path, to}]},
			});
		}
	}
}

function dedupeIds(
	byId: Map<number, TFile[]>,
	catFolder: TFolder,
	catNumber: number,
	out: AuditFinding[]
): void {
	const used = new Set(byId.keys());
	for (const [id, group] of byId) {
		if (group.length < 2) continue;
		const sorted = [...group].sort((a, b) => a.path.localeCompare(b.path));
		for (let k = 1; k < sorted.length; k++) {
			const loser = sorted[k]!;
			let next = 1;
			while (next <= 99 && used.has(next)) next++;
			const nm = parseId(loser.name.replace(/\.md$/, ''))?.name ?? 'note';
			if (next > 99) {
				out.push({
					severity: 'error',
					kind: 'DUPLICATE',
					path: loser.path,
					message: `Duplicate ID ${catNumber}.${id}; category full, resolve manually`,
				});
				continue;
			}
			used.add(next);
			const to = `${catFolder.path}/${pad(catNumber)}.${pad(next)} ${nm}.md`;
			out.push({
				severity: 'warn',
				kind: 'DUPLICATE',
				path: loser.path,
				message: `Duplicate ID ${catNumber}.${id} → renumber to ${pad(catNumber)}.${pad(next)} (kept: "${sorted[0]!.path}")`,
				fix: {renames: [{from: loser.path, to}]},
			});
		}
	}
}

/** Non-contiguous sequence → INFO only (never auto-fixed). */
function gaps(
	nums: number[],
	label: string,
	containerPath: string,
	out: AuditFinding[]
): void {
	if (nums.length < 2) return;
	const sorted = [...new Set(nums)].sort((a, b) => a - b);
	const missing: number[] = [];
	for (let n = sorted[0]!; n < sorted[sorted.length - 1]!; n++) {
		if (!sorted.includes(n)) missing.push(n);
	}
	if (missing.length === 0) return;
	out.push({
		severity: 'info',
		kind: 'GAP',
		path: containerPath,
		message: `${label} sequence has gaps: missing ${missing.map(pad).join(', ')} (informational — JD allows gaps)`,
	});
}
