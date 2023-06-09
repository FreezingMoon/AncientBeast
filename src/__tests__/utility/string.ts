import { zfill, toBool } from '../../utility/string';
import { expect, describe, test } from '@jest/globals';

describe('zfill', () => {
	test('zfill(num:number, size:number) pads zeros on the left if length of num < size', () => {
		expect(zfill(1, 2)).toBe('01');
		expect(zfill(1, 3)).toBe('001');
		expect(zfill(30, 3)).toBe('030');
		expect(zfill(30, 5)).toBe('00030');
	});
	test('zfill(num:number, size:number) does not fill if length of num >= size', () => {
		expect(zfill(1, 1)).toBe('1');
		expect(zfill(1001, 3)).toBe('1001');
		expect(zfill(30, -3)).toBe('30');
		expect(zfill(12345, 5)).toBe('12345');
	});
	test('zfill(num:number, size:number) places "-" on the left for negative numbers', () => {
		expect(zfill(-1, 3)).toBe('-01');
		expect(zfill(-1001, 7)).toBe('-001001');
		expect(zfill(-30, -3)).toBe('-30');
		expect(zfill(-12345, 7)).toBe('-012345');
	});
});

describe('toBool', () => {
	describe('"true" "yes" "1" are true', () => {
		test('toBool("true") === true', () => {
			expect(toBool('true')).toBe(true);
		});
		test('toBool("yes") === true', () => {
			expect(toBool('yes')).toBe(true);
		});
		test('toBool("1") === true', () => {
			expect(toBool('1')).toBe(true);
		});
	});
	describe('truthy strings surrounded by whitespace are true', () => {
		test('toBool(" yes ") === true', () => {
			expect(toBool(' yes ')).toBe(true);
		});
		test('toBool(" yes \t") === true', () => {
			expect(toBool(' yes \t')).toBe(true);
		});
		test('toBool("yes \t") === true', () => {
			expect(toBool('yes \t')).toBe(true);
		});
		const other_truthy_whitespace = ['\ntrue', ' true', ' true ', '\t1\t\t', '  yes \n   \n'];
		test('toBool(other_truthy_whitespace) === true', () => {
			expect(other_truthy_whitespace.map(toBool).every((b) => b === true)).toBe(true);
		});
	});
	describe('mixed uppercase/lowercase truthy strings are true', () => {
		test('toBool("TRUE") === true', () => {
			expect(toBool('TRUE')).toBe(true);
		});
		test('toBool("Yes") === true', () => {
			expect(toBool('Yes')).toBe(true);
		});
		test('toBool("yeS") === true', () => {
			expect(toBool('yeS')).toBe(true);
		});
		const other_truthy_capitalized = ['tRuE', ' TruE', ' tRUE ', '  YEs \n   \n', 'yEs'];
		test('toBool(other_truthy_capitalized) === true', () => {
			expect(other_truthy_capitalized.map(toBool).every((b) => b === true)).toBe(true);
		});
	});
	describe('other strings are false', () => {
		test('toBool("") === false', () => {
			expect(toBool('')).toBe(false);
		});
		test('toBool("t") === false', () => {
			expect(toBool('t')).toBe(false);
		});
		test('toBool("y") === false', () => {
			expect(toBool('y')).toBe(false);
		});
		test('toBool("2") === false', () => {
			expect(toBool('2')).toBe(false);
		});
		const other_falsey_values = [
			'false',
			'treu',
			'truth',
			'tru',
			'f',
			't',
			'no',
			'ye',
			'ja',
			'2',
			'1.1',
			'+',
		];
		test('toBool(other_falsey_values) === false', () => {
			expect(other_falsey_values.map(toBool).every((b) => b === false)).toBe(true);
		});
	});
});
