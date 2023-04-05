import { capitalize } from '../string';

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
