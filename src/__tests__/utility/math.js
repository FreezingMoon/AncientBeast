import { clamp } from '../../utility/math';
import { expect, describe, test } from '@jest/globals';

describe('clamp', () => {
	describe('clamp(value, min, max)', () => {
		test('min < value < max, @return := value', () => {
			expect(clamp(1, 0, 100)).toBe(1);
			expect(clamp(0, -1, 1)).toBe(0);
			expect(clamp(0.3, -1, 1)).toBe(0.3);
			expect(clamp(-999999, Number.MIN_SAFE_INTEGER, 1)).toBe(-999999);
			expect(clamp(999999, 100, Number.MAX_SAFE_INTEGER)).toBe(999999);
			expect(clamp(0.0001, 0.00001, 0.001)).toBe(0.0001);
		});
		test('min === value < max, @return := value', () => {
			expect(clamp(1, 1, 100)).toBe(1);
			expect(clamp(-1, -1, 1)).toBe(-1);
			expect(clamp(0.3, 0.3, 1)).toBe(0.3);
			expect(clamp(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 1)).toBe(
				Number.MIN_SAFE_INTEGER,
			);
			expect(clamp(999999, 999999, Number.MAX_SAFE_INTEGER)).toBe(999999);
			expect(clamp(0.0001, 0.0001, 0.001)).toBe(0.0001);
		});
		test('min < value === max, @return := value', () => {
			expect(clamp(100, 0, 100)).toBe(100);
			expect(clamp(1, -1, 1)).toBe(1);
			expect(clamp(1, -1, 1)).toBe(1);
			expect(clamp(1, Number.MIN_SAFE_INTEGER, 1)).toBe(1);
			expect(clamp(Number.MAX_SAFE_INTEGER, 100, Number.MAX_SAFE_INTEGER)).toBe(
				Number.MAX_SAFE_INTEGER,
			);
			expect(clamp(0.001, 0.00001, 0.001)).toBe(0.001);
		});
		test('value < min < max, @return := min', () => {
			expect(clamp(0, 1, 100)).toBe(1);
			expect(clamp(-1, 0, 1)).toBe(0);
			expect(clamp(-1, 0.3, 1)).toBe(0.3);
			expect(clamp(Number.MIN_SAFE_INTEGER, -999999, 1)).toBe(-999999);
			expect(clamp(100, 999999, Number.MAX_SAFE_INTEGER)).toBe(999999);
			expect(clamp(0.00001, 0.0001, 0.001)).toBe(0.0001);
			expect(clamp(-1, -0.0001, 0.001)).toBe(-0.0001);
		});
		test('min < max < value, @return := max', () => {
			expect(clamp(101, 1, 100)).toBe(100);
			expect(clamp(1.00001, 0, 1)).toBe(1);
			expect(clamp(2, 0.3, 1)).toBe(1);
			expect(clamp(Number.MAX_SAFE_INTEGER, -999999, 1)).toBe(1);
			expect(clamp(Number.POSITIVE_INFINITY, 999999, Number.MAX_SAFE_INTEGER)).toBe(
				Number.MAX_SAFE_INTEGER,
			);
			expect(clamp(0.01, 0.0001, 0.001)).toBe(0.001);
			expect(clamp(1, -0.0001, 0.001)).toBe(0.001);
			expect(clamp(1, -2, -1)).toBe(-1);
		});
		test('min === max, @return := min', () => {
			expect(clamp(100, 100, 100)).toBe(100);
			expect(clamp(1, -1, -1)).toBe(-1);
			expect(clamp(-1, 1, 1)).toBe(1);
			expect(clamp(1, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)).toBe(
				Number.MIN_SAFE_INTEGER,
			);
			expect(clamp(0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(
				Number.MAX_SAFE_INTEGER,
			);
			expect(clamp(0.0000001, 0.001, 0.001)).toBe(0.001);
		});
		test('min > max, min/max swap', () => {
			expect(clamp(1, 100, 0)).toBe(1);
			expect(clamp(0, 1, -1)).toBe(0);
			expect(clamp(0.3, 1, -1)).toBe(0.3);
			expect(clamp(-999999, 1, Number.MIN_SAFE_INTEGER)).toBe(-999999);
			expect(clamp(999999, Number.MAX_SAFE_INTEGER, 100)).toBe(999999);
			expect(clamp(0.0001, 0.001, 0.00001)).toBe(0.0001);
		});
		test('value === Number.POSITIVE_INFINITY', () => {
			expect(clamp(Number.POSITIVE_INFINITY, 0, 100)).toBe(100);
			expect(clamp(Number.POSITIVE_INFINITY, 1, -1)).toBe(1);
			expect(clamp(Number.POSITIVE_INFINITY, 1, Number.POSITIVE_INFINITY)).toBe(
				Number.POSITIVE_INFINITY,
			);
			expect(clamp(Number.POSITIVE_INFINITY, 1, Number.MAX_SAFE_INTEGER)).toBe(
				Number.MAX_SAFE_INTEGER,
			);
		});
		test('value === Number.NEGATIVE_INFINITY', () => {
			expect(clamp(Number.NEGATIVE_INFINITY, 0, 100)).toBe(0);
			expect(clamp(Number.NEGATIVE_INFINITY, 1, -1)).toBe(-1);
			expect(
				clamp(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY),
			).toBe(Number.NEGATIVE_INFINITY);
			expect(
				clamp(Number.NEGATIVE_INFINITY, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
			).toBe(Number.MIN_SAFE_INTEGER);
		});
		test('isNaN(value) === true, isNaN(@result) === true', () => {
			expect(clamp(NaN, 100, 0)).toBeNaN();
			expect(clamp(NaN, 1, -1)).toBeNaN();
			expect(clamp(NaN, 1, Number.MIN_SAFE_INTEGER)).toBe(NaN);
		});
		test('isNaN(min) === true, @result unaffected by min', () => {
			expect(clamp(1, NaN, 0)).toBe(0);
			expect(clamp(0, NaN, 1)).toBe(0);
			expect(clamp(0.3, NaN, -1)).toBe(-1);
			expect(clamp(-999999, NaN, Number.MIN_SAFE_INTEGER)).toBe(Number.MIN_SAFE_INTEGER);
			expect(clamp(999999, NaN, 100)).toBe(100);
			expect(clamp(0.0001, NaN, 0.00001)).toBe(0.00001);
		});
		test('isNaN(max) === true, @result unaffected by max', () => {
			expect(clamp(1, 0, NaN)).toBe(1);
			expect(clamp(0, 1, NaN)).toBe(1);
			expect(clamp(0.3, -1, NaN)).toBe(0.3);
			expect(clamp(-999999, Number.MIN_SAFE_INTEGER, NaN)).toBe(-999999);
			expect(clamp(999999, 100, NaN)).toBe(999999);
			expect(clamp(0.0001, 0.00001, NaN)).toBe(0.0001);
			expect(clamp(0.00001, 0.0001, NaN)).toBe(0.0001);
			expect(clamp(Number.MAX_SAFE_INTEGER, 0.0001, NaN)).toBe(Number.MAX_SAFE_INTEGER);
		});
	});
});
