import { zfill } from './string';

export const getTimer = (num:number) => zfill(Math.floor(num / 60), 2) + ':' + zfill(num % 60, 2);

/**
 * Async delay that resolves after x ms.
 *
 * @example await sleep(TimeDuration.OneSecond);
 * @param {number} ms Number of milliseconds to sleep.
 * @returns
 */
export const sleep = (ms:number) => new Promise((resolve) => setTimeout(resolve, ms));
