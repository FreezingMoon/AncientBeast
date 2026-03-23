/**
 * Pad left size of a number, if its length is less than a minimum size.
 * Like Python's zfill()
 *
 * @example zfill(1234, 3) -> '1234'
 * @example zfill(1234, 10) -> '0000001234'
 * @example zfill(-1234, 10) -> '-000001234'
 *
 */
export function zfill(num: number, size: number): string {
	if (num < 0) {
		const s = Math.abs(num) + '';
		return '-' + s.padStart(size - 1, '0');
	} else {
		const s = num + '';
		return s.padStart(size, '0');
	}
}

/**
 * Capitalize the first letter of a string.
 *
 * @example capitalize('hello world') -> 'Hello world'
 *
 * @param {string} str To capitalize.
 * @returns {string} Capitalized string.
 */
export function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a string to a boolean.
 *
 * @example toBool("true") -> true
 * @example toBool(" TRUE ") -> true
 * @example toBool("yes") -> true
 * @example toBool("1") -> true
 * @example toBool(true) -> true
 * @example toBool("anything else") -> false
 * @example toBool("false") -> false
 * @example toBool([1, 2, 3]) -> false
 * @example toBool({"a": 1}) -> false
 *
 * @param {string} str To convert to boolean.
 * @returns {boolean} true if the trimmed, lowercase string is in ["true", "yes", "1"], else false
 */
export function toBool(str: string | boolean): boolean {
	// NOTE: Guard against repeatedly calling `toBool`.
	if (str === true) {
		return str;
	}

	if (typeof str === 'string') {
		switch (str.toLowerCase().trim()) {
			case 'true':
			case 'yes':
			case '1':
				return true;

			default:
				return false;
		}
	}

	return false;
}
