import * as semver from 'semver';
import packageInfo from '../../package.json';
import { DEBUG } from '../debug';

// NOTE: The version string is set by /package.json.

export const full = packageInfo.version;
export const major = semver.major(full);
export const minor = semver.minor(full);
export const patch = semver.patch(full);
export const release = DEBUG ? 'alpha' : 'gold';
export const major_minor = [major, minor].join('.');
export const formatted = `v${major_minor}` + (release === 'alpha' ? '-α' : '');
