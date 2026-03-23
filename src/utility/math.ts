/**
 * Utility functions for mathematical operations.
 */

/**
 * Constrains a value between a minimum and maximum value.
 *
 * @param value - The number to constrain
 * @param min - The minimum boundary (defaults to negative infinity if NaN)
 * @param max - The maximum boundary (defaults to positive infinity if NaN)
 * @returns The constrained value within the min and max range
 *
 * @example
 * // Returns 5
 * clamp(10, 0, 5);
 *
 * @example
 * // Returns 0
 * clamp(-5, 0, 5);
 *
 * @example
 * // If min > max, they will be swapped automatically
 * // Returns 7
 * clamp(7, 10, 5);
 */
export function clamp(value: number, min: number, max: number) {
	min = isNaN(min) ? Number.NEGATIVE_INFINITY : min;
	max = isNaN(max) ? Number.POSITIVE_INFINITY : max;
	if (min > max) {
		[min, max] = [max, min];
	}
	return Math.max(Math.min(value, max), min);
}
