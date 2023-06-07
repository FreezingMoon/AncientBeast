import * as semver from 'semver';
import packageInfo from '../../package.json';
import { DEBUG } from '../debug';

// NOTE: The version string is set by /package.json.
export const full = semver.clean(packageInfo.version);
export const major = semver.major(full);
export const minor = semver.minor(full);
export const patch = semver.patch(full);
export const release = DEBUG ? 'alpha' : 'gold';
export const major_minor = [major, minor].join('.');
export const pretty = `v${major_minor}` + (release === 'alpha' ? '-α' : '');

export function isValid(a: string) {
	return semver.valid(a) !== null;
}

export function equals(a: string, b?: string) {
	b = typeof b === 'undefined' ? full : b;
	if (!semver.valid(a) || !semver.valid(b)) {
		return false;
	}
	return semver.diff(a, b) === null;
}
