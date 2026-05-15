/**
 * Shared JDex build + idempotent atomic write. Used by both the
 * "Generate JDex" command and the auto-sync module so the two cannot drift.
 *
 * The generated structure lives inside a managed region delimited by
 * JD_START / JD_END. Text outside the region (user notes) is preserved.
 * Only the structural body is hashed, so an unchanged structure produces an
 * identical hash and the write is skipped entirely (no echo event, no churn).
 */

import {TFile} from 'obsidian';
import type JohnnyDecimalPlugin from '../main';
import {validateVault} from './validator';
import {formatFullId} from './parser';

export const JD_START = '<!-- JD:START -->';
export const JD_END = '<!-- JD:END -->';

export type JdexWriteResult =
	| 'no-structure'
	| 'skipped'
	| 'created'
	| 'updated'
	| 'aborted-foreign';

/** Resolve the JDex file path from settings. */
export function jdexFullPath(plugin: JohnnyDecimalPlugin): string {
	const {jdexPath, rootFolder} = plugin.settings;
	return rootFolder ? `${rootFolder}/${jdexPath}` : jdexPath;
}

/** Structural markdown only (no header, no timestamp) — this is what's hashed. */
function buildBody(plugin: JohnnyDecimalPlugin): string | null {
	const result = validateVault(plugin.app, plugin.settings);
	if (result.areas.length === 0) return null;

	const lines: string[] = [];
	const areas = [...result.areas].sort((a, b) => a.rangeStart - b.rangeStart);

	for (const area of areas) {
		const ap = area.system ? `${area.system}.` : '';
		lines.push(
			`## ${ap}${pad(area.rangeStart)}-${pad(area.rangeEnd)} ${area.name}`
		);

		const cats = result.categories
			.filter(c => c.parentArea.path === area.path)
			.sort((a, b) => a.number - b.number);

		for (const category of cats) {
			const cp = category.system ? `${category.system}.` : '';
			lines.push(`### ${cp}${pad(category.number)} ${category.name}`);

			const ids = result.ids
				.filter(id => id.parentCategory.path === category.path)
				.sort((a, b) => a.id - b.id);

			if (ids.length === 0) {
				lines.push('*No IDs yet*');
			} else {
				for (const id of ids) {
					const fullId = formatFullId(id.category, id.id, id.system);
					lines.push(`- [[${id.path}|${fullId} ${id.name}]]`);
				}
			}
			lines.push('');
		}

		if (cats.length === 0) {
			lines.push('*No categories yet*');
			lines.push('');
		}
	}

	return lines.join('\n').trimEnd();
}

function pad(n: number): string {
	return n.toString().padStart(2, '0');
}

/** Deterministic non-crypto string hash (djb2). */
function hash(s: string): string {
	let h = 5381;
	for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
	return (h >>> 0).toString(36);
}

/** Wrap the body in the managed region with a header + date stamp. */
function managedBlock(body: string): string {
	const date = new Date().toISOString().split('T')[0] ?? '';
	return `${JD_START}\n# JDex\n*Generated: ${date}*\n\n${body}\n${JD_END}`;
}

/** Extract the body between markers (for hash comparison), or null. */
function existingBody(content: string): string | null {
	const s = content.indexOf(JD_START);
	const e = content.indexOf(JD_END);
	if (s === -1 || e === -1 || e < s) return null;
	const inner = content.slice(s + JD_START.length, e);
	// Drop the "# JDex" + "*Generated:*" + blank lines we add in managedBlock.
	const nl = inner.indexOf('\n\n');
	const afterHeader = nl === -1 ? inner : inner.slice(nl + 2);
	return afterHeader.trim();
}

/** Replace (or splice in) the managed region, preserving outside text. */
function spliceManaged(content: string, block: string): string {
	const s = content.indexOf(JD_START);
	const e = content.indexOf(JD_END);
	if (s === -1 || e === -1 || e < s) return block;
	return content.slice(0, s) + block + content.slice(e + JD_END.length);
}

/**
 * Build + write the JDex idempotently.
 *  - new file            → create with managed block
 *  - has managed markers  → replace region only (atomic), preserve the rest
 *  - markers absent, file looks like old generated JDex / empty → overwrite
 *  - markers absent, foreign non-trivial content → abort (never clobber)
 *  - body unchanged       → skip (no write, no echo event)
 */
export async function writeJdex(
	plugin: JohnnyDecimalPlugin
): Promise<JdexWriteResult> {
	const body = buildBody(plugin);
	if (body === null) return 'no-structure';

	const path = jdexFullPath(plugin);
	const existing = plugin.app.vault.getAbstractFileByPath(path);

	if (!(existing instanceof TFile)) {
		await plugin.app.vault.create(path, managedBlock(body));
		return 'created';
	}

	const current = await plugin.app.vault.cachedRead(existing);
	const prevBody = existingBody(current);

	if (prevBody !== null) {
		if (prevBody === body) return 'skipped'; // idempotent — nothing to do
		await plugin.app.vault.process(existing, data =>
			spliceManaged(data, managedBlock(body))
		);
		return 'updated';
	}

	// No markers. Safe to take over only if it's empty or the legacy format.
	const trimmed = current.trim();
	const legacy = trimmed === '' || trimmed.startsWith('# JDex');
	if (!legacy) return 'aborted-foreign';

	await plugin.app.vault.process(existing, () => managedBlock(body));
	return 'updated';
}

/** Cheap structural-hash, exposed if a caller wants to pre-check changes. */
export function jdexBodyHash(plugin: JohnnyDecimalPlugin): string | null {
	const body = buildBody(plugin);
	return body === null ? null : hash(body);
}
