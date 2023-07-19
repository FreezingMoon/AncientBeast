import { unitData } from './units';

// Enables autocomplete for `key`
function getKeyValue<T extends object, K extends keyof T>(obj: T, key: K) {
	return obj[key];
}

// Generate several arrays, each containing the values corresponding to the specified key
const realms = unitData.map((unit) => getKeyValue(unit, 'realm'));
const unitNames = unitData.map((unit) => getKeyValue(unit, 'name'));
const unitLevels = unitData.map((unit) => getKeyValue(unit, 'level'));

// Create an array containing the possible `creature.type` combinations.
// In `game.ts`: creature.type = realm.toUpperCase() + level,
const creatureTypes = realms.map((realm) => {
	for (let i in unitLevels) {
		return `${realm}${unitLevels[i]}` as const;
	}
});

// Create unions from the various arrays
export type UnitName = typeof unitNames[number];
export type Realm = typeof realms[number];
export type Level = typeof unitLevels[number];
export type CreatureType = typeof creatureTypes[number];
