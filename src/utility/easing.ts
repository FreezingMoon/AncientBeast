/**
 * Easing functions used by Ancient Beast tweens.
 *
 * Phaser 4 removed the `Phaser.Easing` namespace that Phaser 2 CE exposed.
 * Phaser 4 tweens accept either an ease string (`'Quad.easeInOut'`) or a raw
 * function, so Ancient Beast ships its own named easing table and passes the
 * functions straight through to the tween engine.
 *
 * These are plain module exports on purpose: no global `Phaser` mutation and
 * no `window` dependency, so the values are identical in the browser build,
 * in headless simulations and under Jest.
 */

export type EaseFunction = (k: number) => number;

const linear: EaseFunction = (k) => k;

const easeIn =
	(power: number): EaseFunction =>
	(k) =>
		Math.pow(k, power);

const easeOut =
	(power: number): EaseFunction =>
	(k) =>
		1 - Math.pow(1 - k, power);

const easeInOut =
	(power: number): EaseFunction =>
	(k) =>
		k < 0.5 ? 0.5 * Math.pow(2 * k, power) : 1 - 0.5 * Math.pow(2 - 2 * k, power);

const sinusoidalIn: EaseFunction = (k) => 1 - Math.cos((k * Math.PI) / 2);
const sinusoidalOut: EaseFunction = (k) => Math.sin((k * Math.PI) / 2);
const sinusoidalInOut: EaseFunction = (k) => 0.5 * (1 - Math.cos(Math.PI * k));

const exponentialIn: EaseFunction = (k) => (k === 0 ? 0 : Math.pow(2, 10 * (k - 1)));
const exponentialOut: EaseFunction = (k) => (k === 1 ? 1 : 1 - Math.pow(2, -10 * k));
const exponentialInOut: EaseFunction = (k) => {
	if (k === 0) return 0;
	if (k === 1) return 1;
	if ((k *= 2) < 1) return 0.5 * Math.pow(2, 10 * (k - 1));
	return 0.5 * (2 - Math.pow(2, -10 * (k - 1)));
};

const circularIn: EaseFunction = (k) => 1 - Math.sqrt(1 - k * k);
const circularOut: EaseFunction = (k) => Math.sqrt(1 - (k - 1) * (k - 1));
const circularInOut: EaseFunction = (k) => {
	if ((k *= 2) < 1) return -0.5 * (Math.sqrt(1 - k * k) - 1);
	return 0.5 * (Math.sqrt(1 - (k - 2) * (k - 2)) + 1);
};

const elasticIn: EaseFunction = (k) => {
	if (k === 0) return 0;
	if (k === 1) return 1;
	return -Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);
};
const elasticOut: EaseFunction = (k) => {
	if (k === 0) return 0;
	if (k === 1) return 1;
	return Math.pow(2, -10 * k) * Math.sin((k - 0.1) * 5 * Math.PI) + 1;
};
const elasticInOut: EaseFunction = (k) => {
	if (k === 0) return 0;
	if (k === 1) return 1;
	if ((k *= 2) < 1) return -0.5 * Math.pow(2, -10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);
	return 0.5 * Math.pow(2, -10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI) + 1;
};

const backIn: EaseFunction = (k) => k * k * (2.70158 * k - 1.70158);
const backOut: EaseFunction = (k) => (k - 1) * (k - 1) * (2.70158 * (k - 1) + 1.70158) + 1;
const backInOut: EaseFunction = (k) => {
	const s = 1.70158 * 1.525;
	if ((k *= 2) < 1) return 0.5 * (k * k * ((s + 1) * k - s));
	return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
};

const bounceOut: EaseFunction = (k) => {
	if (k < 1 / 2.75) return 7.5625 * k * k;
	if (k < 2 / 2.75) return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
	if (k < 2.5 / 2.75) return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
	return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
};
const bounceIn: EaseFunction = (k) => 1 - bounceOut(1 - k);
const bounceInOut: EaseFunction = (k) =>
	k < 0.5 ? 0.5 * bounceIn(k * 2) : 0.5 * bounceOut(k * 2 - 1) + 0.5;

export const Easing = {
	Linear: { None: linear, In: linear, Out: linear, InOut: linear },
	Quadratic: { In: easeIn(2), Out: easeOut(2), InOut: easeInOut(2) },
	Cubic: { In: easeIn(3), Out: easeOut(3), InOut: easeInOut(3) },
	Quartic: { In: easeIn(4), Out: easeOut(4), InOut: easeInOut(4) },
	Quintic: { In: easeIn(5), Out: easeOut(5), InOut: easeInOut(5) },
	Sinusoidal: { In: sinusoidalIn, Out: sinusoidalOut, InOut: sinusoidalInOut },
	Exponential: { In: exponentialIn, Out: exponentialOut, InOut: exponentialInOut },
	Circular: { In: circularIn, Out: circularOut, InOut: circularInOut },
	Elastic: { In: elasticIn, Out: elasticOut, InOut: elasticInOut },
	Back: { In: backIn, Out: backOut, InOut: backInOut },
	Bounce: { In: bounceIn, Out: bounceOut, InOut: bounceInOut },
} as const;
