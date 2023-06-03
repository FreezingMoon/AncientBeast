import * as semver from 'semver';
import packageInfo from '../../package.json';

// NOTE: The version string is set by /package.json.

export const full = packageInfo.version;
export const major = semver.major(full);
export const minor = semver.minor(full);
export const patch = semver.patch(full);

export const htmlPageTitle = [major, minor].join('.');
export const log = [major, minor].join('.');
