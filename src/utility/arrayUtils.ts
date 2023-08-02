import { Creature } from '../creature';
import { Direction, Hex } from './hex';
import { HexGrid } from './hexgrid';

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
 * @returns Filtered hexes.
 */
export function filterCreature(
	hexes: Hex[],
	includeCreature: boolean,
	stopOnCreature: boolean,
	id?: number,
) {
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
				hexes.splice(i + 1, 99);
				break;
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

	for (let i = 0; i < hexes.length; i++) {
		for (let j = 0; j < size; j++) {
			// NOTE : This code produce array with doubles.
			if (grid.hexExists({ y: hexes[i].y, x: hexes[i].x - j })) {
				ext.push(grid.hexes[hexes[i].y][hexes[i].x - j]);
			}
		}
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

	for (let i = 0; i < hexes.length; i++) {
		for (let j = 0; j < size; j++) {
			// NOTE : This code produces array with doubles.
			if (grid.hexExists({ y: hexes[i].y, x: hexes[i].x + j })) {
				ext.push(grid.hexes[hexes[i].y][hexes[i].x + j]);
			}
		}
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
