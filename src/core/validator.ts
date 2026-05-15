import {TFolder, TFile} from 'obsidian';
import type {App} from 'obsidian';
import type {JDSettings} from '../settings';
import type {
	JDArea,
	JDCategory,
	JDId,
	ValidationError,
	ValidationResult,
} from '../types';
import {
	parseArea,
	parseCategory,
	parseId,
	isValidAreaRange,
	isCategoryInArea,
	isIdInCategory,
} from './parser';
import {isExcluded} from './exclusions';

export function validateVault(app: App, settings: JDSettings): ValidationResult {
	const errors: ValidationError[] = [];
	const areas: JDArea[] = [];
	const categories: JDCategory[] = [];
	const ids: JDId[] = [];

	const rootPath = settings.rootFolder || '';
	const root = rootPath
		? app.vault.getAbstractFileByPath(rootPath)
		: app.vault.getRoot();

	if (!root || !(root instanceof TFolder)) {
		errors.push({
			type: 'INVALID_AREA_NAME',
			path: rootPath,
			message: `Root folder "${rootPath}" not found`,
		});
		return {valid: false, errors, areas, categories, ids};
	}

	// Scan first level: areas
	for (const child of root.children) {
		if (!(child instanceof TFolder)) continue;
		if (isExcluded(child.path, settings.exclusions)) continue;

		const parsed = parseArea(child.name);

		if (!parsed) {
			errors.push({
				type: 'INVALID_AREA_NAME',
				path: child.path,
				message: `Invalid area name: "${child.name}"`,
				suggestion: 'Areas should be named "XX-YY Name" (e.g., "10-19 Life admin")',
			});
			continue;
		}

		if (!isValidAreaRange(parsed.rangeStart, parsed.rangeEnd)) {
			errors.push({
				type: 'INVALID_AREA_RANGE',
				path: child.path,
				message: `Invalid area range: ${parsed.rangeStart}-${parsed.rangeEnd}`,
				suggestion: 'Areas must span exactly 10 numbers starting at 0 (e.g., 10-19, 20-29)',
			});
			continue;
		}

		// Check for duplicate areas
		const duplicate = areas.find(
			a => a.rangeStart === parsed.rangeStart && a.system === parsed.system
		);
		if (duplicate) {
			errors.push({
				type: 'DUPLICATE_AREA',
				path: child.path,
				message: `Duplicate area: ${parsed.rangeStart}-${parsed.rangeEnd} already exists at "${duplicate.path}"`,
			});
			continue;
		}

		const area: JDArea = {
			system: parsed.system,
			rangeStart: parsed.rangeStart,
			rangeEnd: parsed.rangeEnd,
			name: parsed.name,
			path: child.path,
		};
		areas.push(area);

		// Scan second level: categories
		for (const catChild of child.children) {
			if (isExcluded(catChild.path, settings.exclusions)) continue;
			if (!(catChild instanceof TFolder)) {
				// Files at area level are orphans
				if (catChild instanceof TFile && catChild.name.endsWith('.md')) {
					errors.push({
						type: 'ORPHAN_FILE',
						path: catChild.path,
						message: `File "${catChild.name}" is directly in area folder`,
						suggestion: 'ID files should be inside category folders',
					});
				}
				continue;
			}

			const catParsed = parseCategory(catChild.name);

			if (!catParsed) {
				errors.push({
					type: 'INVALID_CATEGORY_NAME',
					path: catChild.path,
					message: `Invalid category name: "${catChild.name}"`,
					suggestion: 'Categories should be named "XX Name" (e.g., "11 Travel")',
				});
				continue;
			}

			if (!isCategoryInArea(catParsed.number, parsed)) {
				errors.push({
					type: 'CATEGORY_OUTSIDE_AREA',
					path: catChild.path,
					message: `Category ${catParsed.number} is outside area range ${parsed.rangeStart}-${parsed.rangeEnd}`,
				});
				continue;
			}

			// Check for duplicate categories
			const catDuplicate = categories.find(
				c => c.number === catParsed.number && c.system === catParsed.system
			);
			if (catDuplicate) {
				errors.push({
					type: 'DUPLICATE_CATEGORY',
					path: catChild.path,
					message: `Duplicate category: ${catParsed.number} already exists at "${catDuplicate.path}"`,
				});
				continue;
			}

			const category: JDCategory = {
				system: catParsed.system,
				number: catParsed.number,
				name: catParsed.name,
				path: catChild.path,
				parentArea: area,
			};
			categories.push(category);

			// Scan third level: IDs
			for (const idChild of catChild.children) {
				if (isExcluded(idChild.path, settings.exclusions)) continue;
				if (idChild instanceof TFolder) {
					errors.push({
						type: 'MISPLACED_FOLDER',
						path: idChild.path,
						message: `Unexpected folder "${idChild.name}" inside category`,
						suggestion: 'Categories should only contain ID files, not subfolders',
					});
					continue;
				}

				if (!(idChild instanceof TFile) || !idChild.name.endsWith('.md')) continue;

				const idParsed = parseId(idChild.name);

				if (!idParsed) {
					errors.push({
						type: 'INVALID_ID_NAME',
						path: idChild.path,
						message: `Invalid ID name: "${idChild.name}"`,
						suggestion: 'IDs should be named "XX.YY Name.md" (e.g., "11.01 NYC Trip.md")',
					});
					continue;
				}

				if (!isIdInCategory(idParsed.category, catParsed.number)) {
					errors.push({
						type: 'ID_OUTSIDE_CATEGORY',
						path: idChild.path,
						message: `ID ${idParsed.category}.${idParsed.id} is in wrong category (expected ${catParsed.number})`,
					});
					continue;
				}

				// Check for duplicate IDs
				const idDuplicate = ids.find(
					i =>
						i.category === idParsed.category &&
						i.id === idParsed.id &&
						i.system === idParsed.system
				);
				if (idDuplicate) {
					errors.push({
						type: 'DUPLICATE_ID',
						path: idChild.path,
						message: `Duplicate ID: ${idParsed.category}.${idParsed.id} already exists at "${idDuplicate.path}"`,
					});
					continue;
				}

				const jdId: JDId = {
					system: idParsed.system,
					category: idParsed.category,
					id: idParsed.id,
					name: idParsed.name,
					path: idChild.path,
					parentCategory: category,
				};
				ids.push(jdId);
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		areas,
		categories,
		ids,
	};
}
