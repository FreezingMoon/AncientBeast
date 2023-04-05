import { capitalize, toBool } from '../string';

describe('capitalize(s:string) function', () => {
	test('capitalizes multichar string', () => {
		expect(capitalize('abc')).toBe('Abc');
	});

	test('capitalizes only first character of first word', () => {
		expect(capitalize('abc abc abc')).toBe('Abc abc abc');
	});

	test('capitalizes single letter', () => {
		const strs = ['String', 'A', 'Because', 'Été', 'Über'];
		expect(capitalize('s')).toBe('S');
	});

	test('does nothing to already capitalized strings', () => {
		const strs = ['String', 'A', 'Because', 'Été', 'Über', 'Me, myself'];
		strs.forEach((s) => expect(capitalize(s)).toBe(s));
	});

	test('does nothing to non-capitalizable strings', () => {
		const strs = ['0abc', '你好', '123, abc'];
		strs.forEach((s) => expect(capitalize(s)).toBe(s));
	});

	test('does nothing to empty strings', () => {
		expect(capitalize('')).toBe('');
	});

	test('does nothing to spaces', () => {
		expect(capitalize('  ')).toBe('  ');
		expect(capitalize('\t')).toBe('\t');
		expect(
			capitalize(`
        `),
		).toBe(`
        `);
	});
});

describe('toBool(s:string) function', () => {
	const vals_true = [true, 'true', 'yes', '1'];
	const vals_true_whitespace_caps = [
			'TRUE',
			' true ',
			'TrUe ',
			'1 ',
			' \t1',
			' yes',
			'YES',
			'yES',
			' yES\n',
			`
			yEs
			`
		];
	const vals_false = ['false', '0', '2', 'no', 0, 1, undefined, ''];

	test('"true", "1", "yes", true are true', () => {
		// @ts-ignore
		vals_true.forEach((v) => expect(toBool(v)).toBe(true));
	});

	test('whitespace and/or capitalization does not matter', () => {
		vals_true_whitespace_caps.forEach((v) => expect(toBool(v)).toBe(true));
	});

	test('other values are false', () => {
		// @ts-ignore
		vals_false.forEach((v) => expect(toBool(v)).toBe(false));
	});

	test('toBool is consistent if called multiple times', () => {
		// @ts-ignore
		vals_true.forEach((v) => expect(toBool(toBool(v))).toBe(true));
		// @ts-ignore
		vals_true_whitespace_caps.forEach((v) => expect(toBool(toBool(v))).toBe(true));
		// @ts-ignore
		vals_false.forEach((v) => expect(toBool(toBool(v))).toBe(false));
	});
});
