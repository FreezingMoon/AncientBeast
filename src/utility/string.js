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
