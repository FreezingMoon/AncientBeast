import { zfill } from './string';

export const getTimer = (seconds: number) =>
	zfill(Math.floor(seconds / 60), 2) + ':' + zfill(seconds % 60, 2);

/**
 * Async delay that resolves after x ms.
 *
 * @example await sleep(TimeDuration.OneSecond);
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
