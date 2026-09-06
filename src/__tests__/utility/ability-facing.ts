import { expect, describe, test } from '@jest/globals';
import { shouldFaceTargetDuringCast } from '../../utility/ability-facing';

describe('shouldFaceTargetDuringCast', () => {
	test('faces the target when the ability says nothing', () => {
		// Every existing ability is in this shape, so none of them change.
		expect(shouldFaceTargetDuringCast({})).toBe(true);
	});

	test('faces the target when the ability opts in explicitly', () => {
		expect(shouldFaceTargetDuringCast({ _facesTarget: true })).toBe(true);
	});

	test('leaves the caster alone only on an explicit opt out', () => {
		expect(shouldFaceTargetDuringCast({ _facesTarget: false })).toBe(false);
	});

	test('treats an undefined flag as opting in', () => {
		expect(shouldFaceTargetDuringCast({ _facesTarget: undefined })).toBe(true);
	});
});
