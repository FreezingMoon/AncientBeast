import { zfill } from './string';

export const getTimer = (number) => zfill(Math.floor(number / 60), 2) + ':' + zfill(number % 60, 2);

/**
 * Async delay that resolves after x ms.
 *
 * @example await sleep(TimeDuration.OneSecond);
 * @param {number} ms Number of milliseconds to sleep.
 * @returns
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enum of common time durations in human readable format.
 */
export const TimeDuration = {
	OneSecond: 1000,
	TwoSeconds: 2000,
};
