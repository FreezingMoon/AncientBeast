import * as semver from 'semver';
import { expect, describe, test } from '@jest/globals';
import * as version from '../../utility/version';

describe('version.full', () => {
	test('is valid', () => {
		expect(version.full).toBe(semver.valid(version.full));
	});
});

describe('version.isValid', () => {
	test('version.isValid(a:string) returns true if a is valid - number.number.number', () => {
		expect(version.isValid('0.0.0')).toBe(true);
		expect(version.isValid('1.0.0')).toBe(true);
		expect(version.isValid('0.1.0')).toBe(true);
		expect(version.isValid('0.0.1')).toBe(true);
		expect(version.isValid('100.0.1')).toBe(true);
		expect(version.isValid('100.0.1')).toBe(true);
		expect(version.isValid('9999999.99999999.99999999')).toBe(true);
	});
});

describe('version.isValid', () => {
	test('version.isValid(a:string) returns false if a is invalid - !number.number.number', () => {
		expect(version.isValid('0')).toBe(false);
		expect(version.isValid('0.0')).toBe(false);
		expect(version.isValid('v.0.0')).toBe(false);
		expect(version.isValid('0.v.0')).toBe(false);
		expect(version.isValid('0.0.v')).toBe(false);
		expect(version.isValid('100-0-1')).toBe(false);
		expect(version.isValid('100.0:1')).toBe(false);
	});
});

describe('version.equals', () => {
	test('version.equals(a:string) compares a to version.full', () => {
		expect(version.equals(version.full)).toBe(true);
		expect(version.equals('0.0.0')).toBe(false);
	});
	test('version.equals(a:string, b:string) returns true if strings are valid version and equal, else false', () => {
		expect(version.equals(version.full, version.full)).toBe(true);
		expect(version.equals('1.0.0', '1.0.0')).toBe(true);
		expect(version.equals(version.full, '0.0.0')).toBe(false);
	});
	test('version.equals(a:string, b:string) returns false if either string is not a valid version string', () => {
		const invalid_version = '1.0';
		const valid_version = '1.0.0';
		expect(version.equals(invalid_version, valid_version)).toBe(false);
		expect(version.equals(valid_version, invalid_version)).toBe(false);
		expect(version.equals(invalid_version)).toBe(false);
	});
});
