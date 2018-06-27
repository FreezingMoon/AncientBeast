import { Creature } from '../creature';

/** findPos
 * Find an object in the current Array based on its pos attribute
 *
 * @param {array} arr: The array to look for obj in.
 * @param {Object} obj: Anything with pos attribute. Could be Hex of Creature.
 *
 * @returns {Object} Object found in the array. False if nothing.
 */
export function findPos(arr, obj) {
	for (let i = 0; i < arr.length; i++) {
		if (arr[i].pos == obj.pos) {
			return arr[i];
		}
	}

	return false;
}

/** removePos
 * Remove an object in arr based on its pos attribute.
 *
 * @param {array} arr: The array to look for obj in.
 * @param {Object} obj: Anything with pos attribute. Could be Hex of Creature.
 *
 * @returns {boolean} True if success. False if failed.
 */
export function removePos(arr, obj) {
	for (let i = 0; i < arr.length; i++) {
		if (arr[i].pos == obj.pos) {
			arr.splice(i, 1);
			return true;
		}
	}

	return false;
}

/** filterCreature
 * Filters in-place an array of hexes based on creatures.
 * The array typically represents a linear sequence of hexes, to produce a
 * subset/superset of hexes that contain or don't contain creatures.
 *
 * @param {array} arr ?
 * @param {boolean} includeCreature: Add creature hexes to the array
 * @param {boolean} stopOnCreature: Cut the array when finding a creature
 * @param {number} id: Creature id to remove
 *
 * @returns {array} filtered array
 */
export function filterCreature(arr, includeCreature, stopOnCreature, id) {
	let creatureHexes = [];
	for (let i = 0; i < arr.length; i++) {
		if (arr[i].creature instanceof Creature) {
			if (!includeCreature || arr[i].creature.id == id) {
				if (arr[i].creature.id == id) {
					arr.splice(i, 1);
					i--;
					continue;
				} else {
					arr.splice(i, 1);
					i--;
				}
			} else {
				creatureHexes = creatureHexes.concat(arr[i].creature.hexagons);
			}
			if (stopOnCreature) {
				arr.splice(i + 1, 99);
				break;
			}
		}
	}

	return arr.concat(creatureHexes);
}

/** extendToLeft
 *
 * @param {array} arr ?
 * @param {number} size: Size to extend
 * @param {?} grid ?
 *
 * @returns {array} The hex array with all corresponding hexes at the left
 */
export function extendToLeft(arr, size, grid) {
	let ext = [];

	for (let i = 0; i < arr.length; i++) {
		for (let j = 0; j < size; j++) {
			// NOTE : This code produce array with doubles.
			if (grid.hexExists(arr[i].y, arr[i].x - j)) {
				ext.push(grid.hexes[arr[i].y][arr[i].x - j]);
			}
		}
	}

	return ext;
}

/** extendToRight
 *
 * @param {array} arr ?
 * @param {number} size: Size to extend
 * @param {?} grid ?
 *
 * @returns {array} The hex array with all corresponding hexes at the left
 */
export function extendToRight(arr, size, grid) {
	let ext = [];

	for (let i = 0; i < arr.length; i++) {
		for (let j = 0; j < size; j++) {
			// NOTE : This code produces array with doubles.
			if (grid.hexExists(arr[i].y, arr[i].x + j)) {
				ext.push(grid.hexes[arr[i].y][arr[i].x + j]);
			}
		}
	}

	return ext;
}

/** last
 * @param {array} arr ?
 * @returns {?} return the last element of the array
 */
export function last(arr) {
	return arr[arr.length - 1];
}
