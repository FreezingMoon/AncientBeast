import { unitData } from './units';

export type UnitData = typeof unitData;

// Enables autocomplete for `key`
function getKeyValue<T extends object, K extends keyof T>(obj: T, key: K) {
	return obj[key];
}

// Generate several arrays, each containing the values corresponding to the specified key
const realms = unitData.map((unit) => getKeyValue(unit, 'realm'));
const unitNames = unitData.map((unit) => getKeyValue(unit, 'name'));
const unitLevels = unitData.map((unit) => getKeyValue(unit, 'level'));

/*
 * A creature's `type` is defined as `creature.realm` + `creature.level`
 * Example: Dark Priest has `type` '--'
 *
 * This type helper makes it possible to exclude creature `type` combinations that don't actually exist on a creature
 * For example: The combinations '-1' and 'A-' currently are not in use by any creature
 */
type ExtractValidCreatureTypes<T extends UnitData> = {
	[key in keyof T]: `${T[key]['realm']}${T[key]['level']}`;
}[number];

// Create unions from the various arrays
export type UnitName = (typeof unitNames)[number];
export type Realm = (typeof realms)[number];
export type Level = (typeof unitLevels)[number];

// Create a union of valid creature `type`s
export type CreatureType = ExtractValidCreatureTypes<UnitData>;

// Extract each literal unit from `units.ts`
export type Unit = UnitData[number];
