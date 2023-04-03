/** Zfill like in python
 * @param {number} num ?
 * @param {number} size ?
 * @returns {string} ?
 */
export function zfill(num, size) {
	let s = '000000000' + num;
	return s.substr(s.length - size);
}

/**
 * Capitalize the first letter of a string.
 *
 * @example capitalize('hello world') -> 'Hello world'
 *
 * @param {string} string To capitalize.
 * @returns {string} Capitalized string.
 */
export const capitalize = (string) => string.charAt(0).toUpperCase() + string.slice(1);

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
 * @param {string} string To convert to boolean.
 * @returns {boolean} true if the trimmed, lowercase string is in ["true", "yes", "1"], else false
 */
export const toBool = (string) => {
	// NOTE: Guard against repeatedly calling `toBool`.
	if (string === true) {
		return string;
	}

	if (typeof string === 'string') {
		switch (string.toLowerCase().trim()) {
			case 'true':
			case 'yes':
			case '1':
				return true;

			default:
				return false;
		}
	}

	return false;
};
