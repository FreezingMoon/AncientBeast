import { describe, expect, test } from '@jest/globals';
import { capitalize, toBool } from '../string';

describe('capitalize(s:string) function', () => {
	test('capitalizes multichar string', () => {
		expect(capitalize('abc')).toBe('Abc');
	});

	test('capitalizes only first character of first word', () => {
		expect(capitalize('abc abc abc')).toBe('Abc abc abc');
	});

	test('capitalizes single letter', () => {
		expect(capitalize('s')).toBe('S');
		expect(capitalize('é')).toBe('É');
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
	const vals_true = ['true', 'yes', '1'];
	const vals_true_whitespace_caps = [
		'TRUE',
		' true ',
		'TrUe ',
		'1 ',
		' \t1               \t\t  \t',
		' yes',
		'YES',
		'yES',
		' yES\n',
		`
			yEs
			`,
	];
	const vals_false = ['false', 'tru', 'yas', 'y', 't', '0', '2', 'no', ''];

	test('"true", "1", "yes", true are true', () => {
		vals_true.forEach((v) => expect(toBool(v)).toBe(true));
	});

	test('whitespace and/or capitalization does not matter', () => {
		vals_true_whitespace_caps.forEach((v) => expect(toBool(v)).toBe(true));
	});

	test('other values are false', () => {
		vals_false.forEach((v) => expect(toBool(v)).toBe(false));
	});
});
