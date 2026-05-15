import {TFolder, TFile} from 'obsidian';
import type {App} from 'obsidian';
import type {JDSettings} from '../settings';
import type {
	JDSystem,
	JDArea,
	JDCategory,
	JDId,
	ValidationError,
	ValidationResult,
} from '../types';
import {
	parseSystem,
	parseArea,
	parseCategory,
	parseId,
	isValidAreaRange,
	isCategoryInArea,
	isIdInCategory,
} from './parser';
import {isExcluded} from './exclusions';

interface Acc {
	errors: ValidationError[];
	areas: JDArea[];
	categories: JDCategory[];
	ids: JDId[];
}

export function validateVault(app: App, settings: JDSettings): ValidationResult {
	const acc: Acc = {errors: [], areas: [], categories: [], ids: []};
	const systems: JDSystem[] = [];

	const rootPath = settings.rootFolder || '';
	const root = rootPath
		? app.vault.getAbstractFileByPath(rootPath)
		: app.vault.getRoot();

	if (!root || !(root instanceof TFolder)) {
		acc.errors.push({
			type: 'INVALID_AREA_NAME',
			path: rootPath,
			message: `Root folder "${rootPath}" not found`,
		});
		return {valid: false, errors: acc.errors, systems, ...rest(acc)};
	}

	const multiSystem = settings.systems.length > 0;
	const knownCodes = new Set(settings.systems.map(s => s.code));

	if (multiSystem) {
		for (const child of root.children) {
			if (!(child instanceof TFolder)) continue;
			if (isExcluded(child.path, settings.exclusions)) continue;

			const parsed = parseSystem(child.name);
			if (!parsed) {
				acc.errors.push({
					type: 'INVALID_SYSTEM_NAME',
					path: child.path,
					message: `Invalid system folder: "${child.name}"`,
					suggestion: 'Systems should be named "CODE Name" (e.g., "H01 Personal")',
				});
				continue;
			}
			if (!knownCodes.has(parsed.code)) {
				acc.errors.push({
					type: 'UNKNOWN_SYSTEM',
					path: child.path,
					message: `System "${parsed.code}" is not registered in settings`,
					suggestion: 'Add it under Settings → Systems, or rename the folder',
				});
				continue;
			}
			if (systems.find(s => s.code === parsed.code)) {
				acc.errors.push({
					type: 'DUPLICATE_SYSTEM',
					path: child.path,
					message: `Duplicate system "${parsed.code}"`,
				});
				continue;
			}

			systems.push({code: parsed.code, name: parsed.name, path: child.path});
			scanAreas(child, parsed.code, settings, acc);
		}
	} else {
		scanAreas(root, null, settings, acc);
	}

	return {
		valid: acc.errors.length === 0,
		errors: acc.errors,
		systems,
		...rest(acc),
	};
}

function rest(acc: Acc) {
	return {areas: acc.areas, categories: acc.categories, ids: acc.ids};
}

/** Scan the area level inside a system folder (or the root for single-system). */
function scanAreas(
	parent: TFolder,
	system: string | null,
	settings: JDSettings,
	acc: Acc
): void {
	for (const child of parent.children) {
		if (!(child instanceof TFolder)) continue;
		if (isExcluded(child.path, settings.exclusions)) continue;

		const parsed = parseArea(child.name);
		if (!parsed) {
			acc.errors.push({
				type: 'INVALID_AREA_NAME',
				path: child.path,
				message: `Invalid area name: "${child.name}"`,
				suggestion: 'Areas should be named "XX-YY Name" (e.g., "10-19 Life admin")',
			});
			continue;
		}
		if (!isValidAreaRange(parsed.rangeStart, parsed.rangeEnd)) {
			acc.errors.push({
				type: 'INVALID_AREA_RANGE',
				path: child.path,
				message: `Invalid area range: ${parsed.rangeStart}-${parsed.rangeEnd}`,
				suggestion: 'Areas must span exactly 10 numbers starting at a multiple of 10',
			});
			continue;
		}
		const duplicate = acc.areas.find(
			a => a.rangeStart === parsed.rangeStart && a.system === system
		);
		if (duplicate) {
			acc.errors.push({
				type: 'DUPLICATE_AREA',
				path: child.path,
				message: `Duplicate area ${parsed.rangeStart}-${parsed.rangeEnd} (also at "${duplicate.path}")`,
			});
			continue;
		}

		const area: JDArea = {
			system,
			rangeStart: parsed.rangeStart,
			rangeEnd: parsed.rangeEnd,
			name: parsed.name,
			path: child.path,
		};
		acc.areas.push(area);
		scanCategories(child, area, system, settings, acc);
	}
}

function scanCategories(
	areaFolder: TFolder,
	area: JDArea,
	system: string | null,
	settings: JDSettings,
	acc: Acc
): void {
	for (const catChild of areaFolder.children) {
		if (isExcluded(catChild.path, settings.exclusions)) continue;
		if (!(catChild instanceof TFolder)) {
			if (catChild instanceof TFile && catChild.name.endsWith('.md')) {
				acc.errors.push({
					type: 'ORPHAN_FILE',
					path: catChild.path,
					message: `File "${catChild.name}" is directly in an area folder`,
					suggestion: 'ID files should be inside category folders',
				});
			}
			continue;
		}

		const catParsed = parseCategory(catChild.name);
		if (!catParsed) {
			acc.errors.push({
				type: 'INVALID_CATEGORY_NAME',
				path: catChild.path,
				message: `Invalid category name: "${catChild.name}"`,
				suggestion: 'Categories should be named "XX Name" (e.g., "11 Travel")',
			});
			continue;
		}
		if (!isCategoryInArea(catParsed.number, {
			system,
			rangeStart: area.rangeStart,
			rangeEnd: area.rangeEnd,
			name: area.name,
		})) {
			acc.errors.push({
				type: 'CATEGORY_OUTSIDE_AREA',
				path: catChild.path,
				message: `Category ${catParsed.number} is outside area range ${area.rangeStart}-${area.rangeEnd}`,
			});
			continue;
		}
		const catDuplicate = acc.categories.find(
			c => c.number === catParsed.number && c.system === system
		);
		if (catDuplicate) {
			acc.errors.push({
				type: 'DUPLICATE_CATEGORY',
				path: catChild.path,
				message: `Duplicate category ${catParsed.number} (also at "${catDuplicate.path}")`,
			});
			continue;
		}

		const category: JDCategory = {
			system,
			number: catParsed.number,
			name: catParsed.name,
			path: catChild.path,
			parentArea: area,
		};
		acc.categories.push(category);
		scanIds(catChild, category, catParsed.number, system, settings, acc);
	}
}

function scanIds(
	catFolder: TFolder,
	category: JDCategory,
	catNumber: number,
	system: string | null,
	settings: JDSettings,
	acc: Acc
): void {
	for (const idChild of catFolder.children) {
		if (isExcluded(idChild.path, settings.exclusions)) continue;
		if (idChild instanceof TFolder) {
			acc.errors.push({
				type: 'MISPLACED_FOLDER',
				path: idChild.path,
				message: `Unexpected folder "${idChild.name}" inside category`,
				suggestion: 'Categories should only contain ID files',
			});
			continue;
		}
		if (!(idChild instanceof TFile) || !idChild.name.endsWith('.md')) continue;

		const idParsed = parseId(idChild.name);
		if (!idParsed) {
			acc.errors.push({
				type: 'INVALID_ID_NAME',
				path: idChild.path,
				message: `Invalid ID name: "${idChild.name}"`,
				suggestion: 'IDs should be named "XX.YY Name.md" (e.g., "11.01 NYC Trip.md")',
			});
			continue;
		}
		if (!isIdInCategory(idParsed.category, catNumber)) {
			acc.errors.push({
				type: 'ID_OUTSIDE_CATEGORY',
				path: idChild.path,
				message: `ID ${idParsed.category}.${idParsed.id} is in wrong category (expected ${catNumber})`,
			});
			continue;
		}
		const idDuplicate = acc.ids.find(
			i => i.category === idParsed.category && i.id === idParsed.id && i.system === system
		);
		if (idDuplicate) {
			acc.errors.push({
				type: 'DUPLICATE_ID',
				path: idChild.path,
				message: `Duplicate ID ${idParsed.category}.${idParsed.id} (also at "${idDuplicate.path}")`,
			});
			continue;
		}

		acc.ids.push({
			system,
			category: idParsed.category,
			id: idParsed.id,
			name: idParsed.name,
			path: idChild.path,
			parentCategory: category,
		});
	}
}
