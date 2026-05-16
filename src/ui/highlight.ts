/**
 * Briefly flash a file/folder in the file explorer after the engine renames
 * it, so an auto-prefix is visible. Best-effort + DOM-based: the file
 * explorer renders `[data-path]` on nav titles; if it is not mounted or the
 * row is not rendered, this is a silent no-op (purely cosmetic).
 */

const FLASH_MS = 1300;

export function flashPath(path: string): void {
	// Defer one frame so the explorer has re-rendered the new path.
	window.setTimeout(() => {
		const safe =
			typeof CSS !== 'undefined' && CSS.escape
				? CSS.escape(path)
				: path.replace(/"/g, '\\"');
		const el = activeDocument.querySelector<HTMLElement>(
			`.nav-file-title[data-path="${safe}"], .nav-folder-title[data-path="${safe}"]`
		);
		if (!el) return;
		el.classList.add('jd-flash');
		window.setTimeout(() => el.classList.remove('jd-flash'), FLASH_MS);
	}, 50);
}
