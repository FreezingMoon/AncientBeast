/** Zfill like in python
 * @param {number} num ?
 * @param {number} size ?
 * @returns {string} ?
 */
export function zfill(num, size) {
	let s = '000000000' + num;
	return s.substr(s.length - size);
}
