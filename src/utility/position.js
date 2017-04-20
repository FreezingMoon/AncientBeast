var pos = pos || {};


/**
 * Return a direction number given a delta x/y
 * Deltas in [-1, 1] should be used, but due to creature size, x can be greater
 * - delta x will be clamped for the calculation.
 * Due to the hex grid, the starting y coordinate matters.
 * @param {number} y - y coordinate to calculate from
 * @param {number} dx - delta x
 * @param {number} dy - delta y, in range [-1, 1]
 * @return {number} the direction number
 */
pos.getDirectionFromDelta = function(y, dx, dy) {
	// Due to target size, this could be off; limit dx
	if (dx > 1) dx = 1;
	if (dx < -1) dx = -1;
	var dir;
	if (dy === 0) {
		if (dx === 1) {
			dir = 1; // forward
		} else { // dx === -1
			dir = 4; // backward
		}
	} else {
		// Hex grid corrections
		if (y % 2 === 0 && dx < 1) {
			dx++;
		}
		if (dx === 1) {
			if (dy === -1) {
				dir = 0; // upright
			} else { // dy === 1
				dir = 2; // downright
			}
		} else { // dx === 0
			if (dy === 1) {
				dir = 3; // downleft
			} else { // dy === -1
				dir = 5; // upleft
			}
		}
	}
	return dir;
}