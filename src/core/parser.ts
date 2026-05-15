import type {ParsedArea, ParsedCategory, ParsedId} from '../types';

// Regex patterns for Johnny Decimal naming conventions
const SYSTEM_PREFIX_PATTERN = /^([A-Z]\d{2})\.?/;
const AREA_PATTERN = /^(\d{2})-(\d{2})\s+(.+)$/;
const CATEGORY_PATTERN = /^(\d{2})\s+(.+)$/;
const ID_PATTERN = /^(\d{2})\.(\d{2})\s+(.+)$/;

/**
 * Extract system prefix from a name if present
 */
export function extractSystemPrefix(name: string): {system: string | null; rest: string} {
	const match = name.match(SYSTEM_PREFIX_PATTERN);
	if (match && match[1]) {
		const system = match[1];
		// Remove system prefix and optional dot
		const rest = name.slice(match[0].length);
		return {system, rest};
	}
	return {system: null, rest: name};
}

/**
 * Parse an area folder name
 * Format: "XX-YY Name" or "SYS.XX-YY Name"
 */
export function parseArea(folderName: string): ParsedArea | null {
	const {system, rest} = extractSystemPrefix(folderName);
	const match = rest.match(AREA_PATTERN);

	if (!match || !match[1] || !match[2] || !match[3]) return null;

	const rangeStart = parseInt(match[1], 10);
	const rangeEnd = parseInt(match[2], 10);
	const name = match[3];

	return {system, rangeStart, rangeEnd, name};
}

/**
 * Parse a category folder name
 * Format: "XX Name" or "SYS.XX Name"
 */
export function parseCategory(folderName: string): ParsedCategory | null {
	const {system, rest} = extractSystemPrefix(folderName);
	const match = rest.match(CATEGORY_PATTERN);

	if (!match || !match[1] || !match[2]) return null;

	const number = parseInt(match[1], 10);
	const name = match[2];

	return {system, number, name};
}

/**
 * Parse an ID file name
 * Format: "XX.YY Name.md" or "SYS.XX.YY Name.md"
 */
export function parseId(fileName: string): ParsedId | null {
	// Remove .md extension
	const nameWithoutExt = fileName.replace(/\.md$/, '');

	const {system, rest} = extractSystemPrefix(nameWithoutExt);
	const match = rest.match(ID_PATTERN);

	if (!match || !match[1] || !match[2] || !match[3]) return null;

	const category = parseInt(match[1], 10);
	const id = parseInt(match[2], 10);
	const name = match[3];

	return {system, category, id, name};
}

/**
 * Check if an area range is valid (spans exactly 10, starts at 0)
 */
export function isValidAreaRange(rangeStart: number, rangeEnd: number): boolean {
	// Must span exactly 10 numbers (e.g., 10-19, 20-29)
	if (rangeEnd - rangeStart !== 9) return false;

	// Must start at a multiple of 10
	if (rangeStart % 10 !== 0) return false;

	// Valid range is 00-99
	if (rangeStart < 0 || rangeEnd > 99) return false;

	return true;
}

/**
 * Check if a category number falls within an area range
 */
export function isCategoryInArea(categoryNumber: number, area: ParsedArea): boolean {
	return categoryNumber >= area.rangeStart && categoryNumber <= area.rangeEnd;
}

/**
 * Check if an ID belongs to a category
 */
export function isIdInCategory(idCategory: number, categoryNumber: number): boolean {
	return idCategory === categoryNumber;
}

/**
 * Sanitize a name for use in file/folder paths
 */
export function sanitizeName(name: string): string {
	return name.replace(/[/\\:*?"<>|]/g, '-').trim();
}

/**
 * Format an area name
 */
export function formatAreaName(rangeStart: number, name: string, system?: string | null): string {
	const rangeEnd = rangeStart + 9;
	const start = rangeStart.toString().padStart(2, '0');
	const end = rangeEnd.toString().padStart(2, '0');

	if (system) {
		return `${system}.${start}-${end} ${name}`;
	}
	return `${start}-${end} ${name}`;
}

/**
 * Format a category name
 */
export function formatCategoryName(number: number, name: string, system?: string | null): string {
	const num = number.toString().padStart(2, '0');

	if (system) {
		return `${system}.${num} ${name}`;
	}
	return `${num} ${name}`;
}

/**
 * Format an ID name (without .md extension)
 */
export function formatIdName(category: number, id: number, name: string, system?: string | null): string {
	const cat = category.toString().padStart(2, '0');
	const idStr = id.toString().padStart(2, '0');

	if (system) {
		return `${system}.${cat}.${idStr} ${name}`;
	}
	return `${cat}.${idStr} ${name}`;
}

/**
 * Format a full ID (e.g., "11.01" or "H01.11.01")
 */
export function formatFullId(category: number, id: number, system?: string | null): string {
	const cat = category.toString().padStart(2, '0');
	const idStr = id.toString().padStart(2, '0');

	if (system) {
		return `${system}.${cat}.${idStr}`;
	}
	return `${cat}.${idStr}`;
}
