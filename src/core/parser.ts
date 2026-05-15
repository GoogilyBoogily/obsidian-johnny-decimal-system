import type {ParsedSystem, ParsedArea, ParsedCategory, ParsedId} from '../types';

// Johnny Decimal naming. Systems are a top-level folder layer; area/category/
// ID names are CLEAN (no system prefix) — the system is derived from the path.
const SYSTEM_CODE = /^[A-Z]\d{2}$/;
const SYSTEM_PATTERN = /^([A-Z]\d{2})\s+(.+)$/;
const AREA_PATTERN = /^(\d{2})-(\d{2})\s+(.+)$/;
const CATEGORY_PATTERN = /^(\d{2})\s+(.+)$/;
const ID_PATTERN = /^(\d{2})\.(\d{2})\s+(.+)$/;

/** True if `code` is a syntactically valid system code (e.g. "H01"). */
export function isValidSystemCode(code: string): boolean {
	return SYSTEM_CODE.test(code);
}

/**
 * Parse a system folder name.
 * Format: "CODE Name" where CODE is a letter + 2 digits (e.g. "H01 Personal").
 */
export function parseSystem(folderName: string): ParsedSystem | null {
	const match = folderName.match(SYSTEM_PATTERN);
	if (!match || !match[1] || !match[2]) return null;
	return {code: match[1], name: match[2]};
}

/**
 * Parse an area folder name. Format: "XX-YY Name" (clean, no system prefix).
 */
export function parseArea(folderName: string): ParsedArea | null {
	const match = folderName.match(AREA_PATTERN);
	if (!match || !match[1] || !match[2] || !match[3]) return null;

	return {
		system: null,
		rangeStart: parseInt(match[1], 10),
		rangeEnd: parseInt(match[2], 10),
		name: match[3],
	};
}

/**
 * Parse a category folder name. Format: "XX Name" (clean, no system prefix).
 */
export function parseCategory(folderName: string): ParsedCategory | null {
	const match = folderName.match(CATEGORY_PATTERN);
	if (!match || !match[1] || !match[2]) return null;

	return {system: null, number: parseInt(match[1], 10), name: match[2]};
}

/**
 * Parse an ID file name. Format: "XX.YY Name.md" (clean, no system prefix).
 */
export function parseId(fileName: string): ParsedId | null {
	const nameWithoutExt = fileName.replace(/\.md$/, '');
	const match = nameWithoutExt.match(ID_PATTERN);
	if (!match || !match[1] || !match[2] || !match[3]) return null;

	return {
		system: null,
		category: parseInt(match[1], 10),
		id: parseInt(match[2], 10),
		name: match[3],
	};
}

/**
 * Check if an area range is valid (spans exactly 10, starts at a multiple of 10)
 */
export function isValidAreaRange(rangeStart: number, rangeEnd: number): boolean {
	if (rangeEnd - rangeStart !== 9) return false;
	if (rangeStart % 10 !== 0) return false;
	if (rangeStart < 0 || rangeEnd > 99) return false;
	return true;
}

/** Check if a category number falls within an area range */
export function isCategoryInArea(categoryNumber: number, area: ParsedArea): boolean {
	return categoryNumber >= area.rangeStart && categoryNumber <= area.rangeEnd;
}

/** Check if an ID belongs to a category */
export function isIdInCategory(idCategory: number, categoryNumber: number): boolean {
	return idCategory === categoryNumber;
}

/** Sanitize a name for use in file/folder paths */
export function sanitizeName(name: string): string {
	return name.replace(/[/\\:*?"<>|]/g, '-').trim();
}

/** Format a system folder name: "CODE Name" */
export function formatSystemName(code: string, name: string): string {
	return `${code} ${name}`;
}

/** Format an area folder name (clean): "XX-YY Name" */
export function formatAreaName(rangeStart: number, name: string): string {
	const start = rangeStart.toString().padStart(2, '0');
	const end = (rangeStart + 9).toString().padStart(2, '0');
	return `${start}-${end} ${name}`;
}

/** Format a category folder name (clean): "XX Name" */
export function formatCategoryName(num: number, name: string): string {
	return `${num.toString().padStart(2, '0')} ${name}`;
}

/** Format an ID file name without extension (clean): "XX.YY Name" */
export function formatIdName(category: number, id: number, name: string): string {
	const cat = category.toString().padStart(2, '0');
	const idStr = id.toString().padStart(2, '0');
	return `${cat}.${idStr} ${name}`;
}

/**
 * Format a full ID for display/linking, e.g. "11.01" or "H01.11.01".
 * The system code (when present) is derived from the path, not the name.
 */
export function formatFullId(
	category: number,
	id: number,
	system?: string | null
): string {
	const cat = category.toString().padStart(2, '0');
	const idStr = id.toString().padStart(2, '0');
	const base = `${cat}.${idStr}`;
	return system ? `${system}.${base}` : base;
}
