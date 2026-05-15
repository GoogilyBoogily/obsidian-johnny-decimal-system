/**
 * Path-based exclusion matching for the Johnny Decimal engine.
 *
 * An excluded path is "frozen": the auto-prefix engine assigns no prefix to it
 * on move/create, prefix propagation does not cascade into it, no revert/guard
 * fires on manual renames within it, and the validator emits no errors for it.
 *
 * DECIDED SEMANTICS: exclusion is SUBTREE-INCLUSIVE. Excluding a folder excludes
 * that folder AND every descendant.
 *
 * Pure module — no Obsidian imports. Heavily unit-tested: this function gates
 * destructive rename operations, so a false negative can corrupt user data.
 */

/**
 * Normalize a vault path for comparison.
 * - Strips leading/trailing slashes
 * - Collapses repeated slashes
 * Vault paths are already POSIX-style and case-sensitive, so no case folding.
 */
export function normalizePath(path: string): string {
	return path.replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
}

/**
 * True if `path` is excluded by `exclusions` (subtree-inclusive).
 *
 * Match order:
 *   1. Exact path match            — path === exclusion
 *   2. Subtree match               — path starts with `exclusion + "/"`
 *   3. Glob match (optional)       — see matchesGlob() below
 *
 * @param path        Vault-relative path of the folder/file under test.
 * @param exclusions  Raw exclusion entries from settings (paths and/or globs).
 */
export function isExcluded(path: string, exclusions: string[]): boolean {
	const p = normalizePath(path);

	for (const raw of exclusions) {
		const ex = normalizePath(raw);
		if (ex.length === 0) continue;

		// 1. exact   2. subtree (decided: subtree-inclusive)
		if (p === ex || p.startsWith(ex + '/')) return true;

		// 3. glob
		if (isGlobPattern(raw) && matchesGlob(p, ex)) return true;
	}

	return false;
}

/** Heuristic: does this entry look like a glob rather than a literal path? */
function isGlobPattern(raw: string): boolean {
	return /[*?[\]]/.test(raw);
}

/**
 * Minimal glob matcher (hand-rolled, zero dependency).
 *
 * Supported syntax, on already-normalized slash-delimited paths:
 *   **  matches any number of path segments, including across `/` (and an
 *       immediately following `/` is optional, so `** /a` also matches `a`)
 *   *   matches within a single segment (does not cross `/`)
 *   ?   matches one character within a single segment
 *
 * All other characters are matched literally (regex specials are escaped, so
 * no injection from `.`, `(`, etc. in real folder names like `35.00 Karakeep`).
 *
 * Known limitation: a pattern ending in `/**` matches the subtree contents but
 * not the bare folder path itself (no trailing slash). Literal exclusions use
 * the subtree rule in isExcluded() and do not have this caveat.
 */
function matchesGlob(path: string, pattern: string): boolean {
	let re = '';
	for (let i = 0; i < pattern.length; i++) {
		const c = pattern[i] as string; // bounded by loop: i < pattern.length
		if (c === '*') {
			if (pattern[i + 1] === '*') {
				re += '.*';
				i++;
				if (pattern[i + 1] === '/') i++; // optional separator after **
			} else {
				re += '[^/]*';
			}
		} else if (c === '?') {
			re += '[^/]';
		} else {
			re += c.replace(/[.+^${}()|[\]\\]/, '\\$&');
		}
	}
	return new RegExp('^' + re + '$').test(path);
}
