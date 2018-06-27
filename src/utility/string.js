/** Zfill like in python
 * @param {?} num ?
 * @param {?} size ?
 * @returns {?} ?
 */
export function zfill(num, size) {
	let s = '000000000' + num;
	return s.substr(s.length - size);
}
