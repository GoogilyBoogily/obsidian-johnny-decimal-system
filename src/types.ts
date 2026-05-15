// Johnny Decimal System Types

// A "system" is a top-level folder named "<CODE> <Name>" (CODE = [A-Z]\d{2},
// e.g. "H01 Personal"). Areas/categories/IDs inside it carry NO prefix in
// their names — the system is derived from the folder path. Single-system
// vaults define no systems and place areas at the root directly.
export interface JDSystem {
	code: string;           // e.g., "H01"
	name: string;           // e.g., "Personal"
	path: string;           // Vault-relative folder path
}

export interface JDArea {
	system: string | null;  // System CODE derived from path, null if none
	rangeStart: number;     // e.g., 10 for "10-19"
	rangeEnd: number;       // e.g., 19 for "10-19"
	name: string;           // e.g., "Life admin"
	path: string;           // Vault-relative folder path
}

export interface JDCategory {
	system: string | null;
	number: number;         // e.g., 11 for "11 Travel"
	name: string;
	path: string;
	parentArea: JDArea;
}

export interface JDId {
	system: string | null;
	category: number;       // e.g., 11 for "11.01"
	id: number;             // e.g., 01 for "11.01"
	name: string;           // e.g., "NYC Trip"
	path: string;           // Full path including .md
	parentCategory: JDCategory;
}

export type ValidationErrorType =
	| 'INVALID_SYSTEM_NAME'
	| 'UNKNOWN_SYSTEM'
	| 'DUPLICATE_SYSTEM'
	| 'INVALID_AREA_NAME'
	| 'INVALID_AREA_RANGE'
	| 'INVALID_CATEGORY_NAME'
	| 'CATEGORY_OUTSIDE_AREA'
	| 'INVALID_ID_NAME'
	| 'ID_OUTSIDE_CATEGORY'
	| 'DUPLICATE_AREA'
	| 'DUPLICATE_CATEGORY'
	| 'DUPLICATE_ID'
	| 'ORPHAN_FILE'
	| 'MISPLACED_FOLDER';

export interface ValidationError {
	type: ValidationErrorType;
	path: string;
	message: string;
	suggestion?: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	systems: JDSystem[];
	areas: JDArea[];
	categories: JDCategory[];
	ids: JDId[];
}

// Parsed result types (nullable for invalid names)
export interface ParsedSystem {
	code: string;
	name: string;
}

export interface ParsedArea {
	system: string | null;
	rangeStart: number;
	rangeEnd: number;
	name: string;
}

export interface ParsedCategory {
	system: string | null;
	number: number;
	name: string;
}

export interface ParsedId {
	system: string | null;
	category: number;
	id: number;
	name: string;
}
