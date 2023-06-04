import * as semver from 'semver';
import { expect, describe, test } from '@jest/globals';
import * as version from '../../utility/version';

describe('version.full', () => {
	test('is valid', () => {
		expect(version.full).toBe(semver.valid(version.full));
	});
});
