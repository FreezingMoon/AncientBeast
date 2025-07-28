import { Creature } from '../creature';
import { Direction, Hex } from './hex';
import { HexGrid } from './hexgrid';
import { Team, isTeam } from './team';
import { PierceThroughBehavior } from '../ability';

/**
 * Find an object in the current Array based on its pos attribute.
 *
 * @param arr The array to look for obj in.
 * @param obj Anything with pos attribute. Could be Hex of Creature.
 * @returns Object found in the array. False if nothing.
 */
export function findPos(arr: (Hex | Creature)[], obj: Hex | Creature) {
	for (let i = 0; i < arr.length; i++) {
		if (arr[i].pos == obj.pos) {
			return arr[i];
		}
	}

	return false;
}

/**
 * Remove an object from a list based on its `pos` property.
 *
 * @param arr The array to look for obj in.
 * @param obj Anything with pos attribute. Could be Hex of Creature.
 * @returns
 */
export function removePos(arr: (Hex | Creature)[], obj: Hex | Creature) {
	for (let i = 0; i < arr.length; i++) {
		if (arr[i].pos == obj.pos) {
			arr.splice(i, 1);
			return true;
		}
	}

	return false;
}

/**
 * Filters in-place an array of hexes based on creatures.
 * The array typically represents a linear sequence of hexes, to produce a subset/superset
 * of hexes that contain or don't contain creatures.
 *
 * @param hexes Starting hexes.
 * @param includeCreature Add creature hexes to the array.
 * @param stopOnCreature Cut the array when finding a creature.
 * @param id Creature id to remove.
 * @param sourceCreature Creature that all filtered creatures are compared against.
 * @param pierceNumber Integer/number, when stopOnCreature is true, this is the number of creatures that must be found before cutting the array.
 * @param pierceThroughBehavior When stopOnCreature is true, decides if array should spilt on first creature found, rely on pierceNumber, or stop on first non-target creature
 * @param targetTeam The team targeted by the attack
 * @returns Filtered hexes.
 */
export function filterCreature(
	hexes: Hex[],
	includeCreature: boolean,
	stopOnCreature: boolean,
	id?: number,
	sourceCreature?: Creature,
	pierceNumber = 1,
	pierceThroughBehavior: PierceThroughBehavior = 'stop',
	targetTeam = Team.Enemy,
) {
	let piercedCreatures = 0;
	let creatureHexes = [];
	for (let i = 0; i < hexes.length; i++) {
		if (hexes[i].creature instanceof Creature) {
			if (!includeCreature || hexes[i].creature.id == id) {
				if (hexes[i].creature.id == id) {
					hexes.splice(i, 1);
					i--;
					continue;
				} else {
					hexes.splice(i, 1);
					i--;
				}
			} else {
				creatureHexes = creatureHexes.concat(hexes[i].creature.hexagons);
			}
			if (stopOnCreature) {
				if (pierceThroughBehavior == 'pierce') {
					if (isTeam(sourceCreature, hexes[i].creature, targetTeam)) {
						piercedCreatures += 1;
						if (piercedCreatures == pierceNumber) {
							hexes.splice(i + 1, 99);
							break;
						}
					}
				}
				if (pierceThroughBehavior == 'stop') {
					hexes.splice(i + 1, 99);
					break;
				}
				if (pierceThroughBehavior == 'targetOnly') {
					if (isTeam(sourceCreature, hexes[i].creature, targetTeam)) {
						piercedCreatures += 1;
						if (piercedCreatures == pierceNumber) {
							hexes.splice(i + 1, 99);
							break;
						}
					} else {
						hexes.splice(i, 99);
						break;
					}
				}
			}
		}
	}

	return hexes.concat(creatureHexes);
}

/**
 * Sort a line of hexes by their x value, based on a direction.
 *
 * @param hexes Line of hexes to sort.
 * @param direction Direction to sort hexes. Only Left and Right are currently supported.
 * @returns Array of sorted hexes.
 */
export const sortByDirection = (hexes: Hex[], direction: Direction.Left | Direction.Right) => {
	return hexes.sort((a, b) => (direction === Direction.Right ? a.x - b.x : b.x - a.x));
};

/**
 *
 * @param hexes
 * @param size Size to extend
 * @param grid
 * @returns The hex array with all corresponding hexes at the left.
 */
export function extendToLeft(hexes: Hex[], size: number, grid: HexGrid) {
	const ext: Hex[] = [];
	size -= 1;

	// Sort top to bottom, and then left to right
	hexes.sort((a: Hex, b: Hex): number => {
		return a.y - b.y == 0 ? a.x - b.x : a.y - b.y;
	});
	let curRow = -1;
	for (let i = 0; i < hexes.length; i++) {
		// For every hex
		if (hexes[i].y != curRow) {
			// Start of new row
			curRow = hexes[i].y;
			for (let j = 1; j <= size; j++) {
				if (grid.hexExists({ y: hexes[i].y, x: hexes[i].x - j })) {
					ext.push(grid.hexes[hexes[i].y][hexes[i].x - j]);
				}
			}
		} else {
			// There is another hex already extended in this row
			const diff = hexes[i].x - hexes[i - 1].x;
			if (diff > 1) {
				for (let j = 1; j < diff && j <= size; j++) {
					if (grid.hexExists({ y: hexes[i].y, x: hexes[i].x - j })) {
						ext.push(grid.hexes[hexes[i].y][hexes[i].x - j]);
					}
				}
			}
		}
		ext.push(hexes[i]);
	}
	return ext;
}

/**
 *
 * @param hexes
 * @param size Size to extend
 * @param grid
 * @returns The hex array with all corresponding hexes at the right.
 */
export function extendToRight(hexes: Hex[], size: number, grid: HexGrid) {
	const ext: Hex[] = [];
	size -= 1;

	// Sort top to bottom, and then left to right
	hexes.sort((a: Hex, b: Hex): number => {
		return a.y - b.y == 0 ? b.x - a.x : a.y - b.y;
	});
	let curRow = -1;
	for (let i = 0; i < hexes.length; i++) {
		// For every hex
		if (hexes[i].y != curRow) {
			// Start of new row
			curRow = hexes[i].y;
			for (let j = 1; j <= size; j++) {
				if (grid.hexExists({ y: hexes[i].y, x: hexes[i].x + j })) {
					ext.push(grid.hexes[hexes[i].y][hexes[i].x + j]);
				}
			}
		} else {
			// there is another hex already extended in this row
			const diff = hexes[i - 1].x - hexes[i].x;
			if (diff > 1) {
				for (let j = 1; j < diff && j <= size; j++) {
					if (grid.hexExists({ y: hexes[i].y, x: hexes[i].x + j })) {
						ext.push(grid.hexes[hexes[i].y][hexes[i].x + j]);
					}
				}
			}
		}
		ext.push(hexes[i]);
	}
	return ext;
}

/**
 * Return the last element of an array.
 *
 * @param arr
 * @returns Last element of the array.
 */
export function last<T extends any[]>(arr: T): T[number] {
	return arr[arr.length - 1];
}
