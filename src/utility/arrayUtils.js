import { Creature } from "../creature";

/* findPos(arr, obj)
 * Find an object in the current Array based on its pos attribute
 *
 * arr: Array: The array to look for obj in.
 * obj: Object: Anything with pos attribute. Could be Hex of Creature.
 *
 * return: Object: Object found in the array. False if nothing.
 */
export function findPos(arr, obj) {
	for (var i = 0; i < arr.length; i++) {
		if (arr[i].pos == obj.pos) {
			return arr[i];
		}
	}

	return false;
};

/* removePos(arr, obj)
 * Remove an object in arr based on its pos attribute.
 *
 * arr: Array: The array to look for obj in.
 * obj: Object: Anything with pos attribute. Could be Hex of Creature.
 *
 * return: Boolean: True if success. False if failed.
 */
export function removePos(arr, obj) {
	for (var i = 0; i < arr.length; i++) {
		if (arr[i].pos == obj.pos) {
			arr.splice(i, 1);
			return true;
		}
	}

	return false;
};

/* filterCreature(arr, includeCreature, stopOnCreature, id)
 * Filters in-place an array of hexes based on creatures.
 * The array typically represents a linear sequence of hexes, to produce a
 * subset/superset of hexes that contain or don't contain creatures.
 *
 * includeCreature: Boolean: Add creature hexes to the array
 * stopOnCreature: Boolean: Cut the array when finding a creature
 * id: Integer: Creature id to remove
 *
 * return: Array: filtered array
 */
export function filterCreature(arr, includeCreature, stopOnCreature, id) {
	var creatureHexes = [];
	for (var i = 0; i < arr.length; i++) {
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
};

/* extendToLeft(arr, size)
 *
 * size: Integer: Size to extend
 *
 * return: Array: The hex array with all corresponding hexes at the left
 */
export function extendToLeft(arr, size, grid) {
	var ext = [];

	for (var i = 0; i < arr.length; i++) {
		for (var j = 0; j < size; j++) {
			// NOTE : This code produce array with doubles.
			if (grid.hexExists(arr[i].y, arr[i].x - j))
				ext.push(grid.hexes[arr[i].y][arr[i].x - j]);
		}
	}

	return ext;
};

/* extendToRight(arr, size)
 *
 * size: Integer: Size to extend
 *
 * return: Array: The hex array with all corresponding hexes at the left
 */
export function extendToRight(arr, size, grid) {
	var ext = [];

	for (var i = 0; i < arr.length; i++) {
		for (var j = 0; j < size; j++) {
			// NOTE : This code produces array with doubles.
			if (grid.hexExists(arr[i].y, arr[i].x + j))
				ext.push(grid.hexes[arr[i].y][arr[i].x + j]);
		}
	}

	return ext;
};

/*	last(arr)
 *
 * Return the last element of the array
 *
 */
export function last(arr) {
	return arr[arr.length - 1];
};
