/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shared `phaser` mock for the Jest suites.
 *
 * The real Phaser bundle needs a live WebGL/2D canvas context at import time,
 * which jsdom does not provide, so any suite whose import graph reaches
 * `phaser` (almost everything — `plasma-field` pulls in `BlendModes`) has to
 * stub it. This is the same mock that was inlined across the other suites,
 * extracted so there is a single place to keep in step with the Phaser 4
 * surface AB actually uses: `Scene`, `Math`, `Geom`, `GameObjects`,
 * `BlendModes`, `Scale`, and the legacy `Signal` shim.
 *
 * Usage — the factory has to stay inline because `jest.mock` is hoisted above
 * the imports, but it may pull the definition in from here:
 *
 *     jest.mock(
 *     	'phaser',
 *     	() => (jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock'))
 *     		.createPhaserMock(),
 *     );
 */

class SceneMock {
	sys: { settings: { key: string; data: Record<string, unknown> } } = {
		settings: { key: '', data: {} },
	};
	constructor(config?: any) {
		this.sys.settings.key = config?.key ?? '';
	}
}

class Vector2Mock {
	x: number;
	y: number;
	constructor(x?: number, y?: number) {
		this.x = x ?? 0;
		this.y = y ?? 0;
	}
	set(x: number, y?: number): this {
		this.x = x;
		this.y = y ?? x;
		return this;
	}
	setTo(x: number, y?: number): this {
		return this.set(x, y);
	}
	clone(): this {
		return new (this.constructor as any)(this.x, this.y);
	}
	copy(src: any): this {
		this.x = src.x;
		this.y = src.y;
		return this;
	}
}

class GeomPolygonMock {
	points: unknown;
	constructor(points?: unknown) {
		this.points = points ?? [];
	}
	contains(): boolean {
		return true;
	}
}

/**
 * Phaser 4's `Math.Easing`, mirrored exactly.
 *
 * AB reads its eases from the engine rather than shipping its own table (see
 * `src/utility/easing.ts`), so the mock has to provide them or every tween-using
 * suite fails.
 *
 * These are the real formulas, not approximations. An earlier version used one
 * curve per namespace for `In`/`Out`/`InOut`, which quietly changed what the
 * simulation animated — moves and shots followed different curves — and moved the
 * recorded match metrics without any test failing. A mock that silently alters
 * behaviour is worse than no mock, so the namespace names (Phaser 4's own list:
 * `Sine`, not `Sinusoidal`, and no `Linear`) and the curves both come from the
 * engine.
 */
type EaseFn = (k: number) => number;
type EaseSet = { In: EaseFn; Out: EaseFn; InOut: EaseFn };

const set = (easeIn: EaseFn, easeOut: EaseFn, easeInOut: EaseFn): EaseSet => ({
	In: easeIn,
	Out: easeOut,
	InOut: easeInOut,
});

const powerIn =
	(power: number): EaseFn =>
	(k) =>
		Math.pow(k, power);

const powerOut =
	(power: number): EaseFn =>
	(k) =>
		1 - Math.pow(1 - k, power);

const powerInOut =
	(power: number): EaseFn =>
	(k) =>
		k < 0.5 ? 0.5 * Math.pow(2 * k, power) : 1 - 0.5 * Math.pow(2 - 2 * k, power);

const bounceOut: EaseFn = (k) => {
	if (k < 1 / 2.75) return 7.5625 * k * k;
	if (k < 2 / 2.75) return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
	if (k < 2.5 / 2.75) return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
	return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
};
const bounceIn: EaseFn = (k) => 1 - bounceOut(1 - k);
const bounceInOut: EaseFn = (k) =>
	k < 0.5 ? 0.5 * bounceIn(k * 2) : 0.5 * bounceOut(k * 2 - 1) + 0.5;

const easingMock = {
	Back: set(
		(k) => k * k * (2.70158 * k - 1.70158),
		(k) => (k - 1) * (k - 1) * (2.70158 * (k - 1) + 1.70158) + 1,
		(k) => {
			const s = 1.70158 * 1.525;
			if ((k *= 2) < 1) return 0.5 * (k * k * ((s + 1) * k - s));
			return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
		},
	),
	Bounce: set(bounceIn, bounceOut, bounceInOut),
	Circular: set(
		(k) => 1 - Math.sqrt(1 - k * k),
		(k) => Math.sqrt(1 - (k - 1) * (k - 1)),
		(k) => {
			if ((k *= 2) < 1) return -0.5 * (Math.sqrt(1 - k * k) - 1);
			return 0.5 * (Math.sqrt(1 - (k - 2) * (k - 2)) + 1);
		},
	),
	Cubic: set(powerIn(3), powerOut(3), powerInOut(3)),
	Elastic: set(
		(k) => {
			if (k === 0) return 0;
			if (k === 1) return 1;
			return -Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);
		},
		(k) => {
			if (k === 0) return 0;
			if (k === 1) return 1;
			return Math.pow(2, -10 * k) * Math.sin((k - 0.1) * 5 * Math.PI) + 1;
		},
		(k) => {
			if (k === 0) return 0;
			if (k === 1) return 1;
			if ((k *= 2) < 1)
				return -0.5 * Math.pow(2, -10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);
			return 0.5 * Math.pow(2, -10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI) + 1;
		},
	),
	Expo: set(
		(k) => (k === 0 ? 0 : Math.pow(2, 10 * (k - 1))),
		(k) => (k === 1 ? 1 : 1 - Math.pow(2, -10 * k)),
		(k) => {
			if (k === 0) return 0;
			if (k === 1) return 1;
			if ((k *= 2) < 1) return 0.5 * Math.pow(2, 10 * (k - 1));
			return 0.5 * (2 - Math.pow(2, -10 * (k - 1)));
		},
	),
	Quadratic: set(powerIn(2), powerOut(2), powerInOut(2)),
	Quartic: set(powerIn(4), powerOut(4), powerInOut(4)),
	Quintic: set(powerIn(5), powerOut(5), powerInOut(5)),
	Sine: set(
		(k) => 1 - Math.cos((k * Math.PI) / 2),
		(k) => Math.sin((k * Math.PI) / 2),
		(k) => 0.5 * (1 - Math.cos(Math.PI * k)),
	),
};

/**
 * A stand-in for `Phaser.Events.EventEmitter`, covering the surface AB uses.
 *
 * The gameplay channels are Phaser `EventEmitter`s, so the mock has to provide
 * one. Phaser's own implementation is a hand-rolled listener map; this mirrors
 * the same four calls (`on`, `once`, `off`, `emit`) rather than wrapping Node's
 * `EventEmitter`, because Phaser's `emit` iterates a copy and allows a handler to
 * unsubscribe itself, and the fallback bus in `src/game-events/factory.ts`
 * promises the same guarantee.
 */
class EventEmitterMock {
	private listeners = new Map<string, Array<{ fn: (...args: any[]) => void; once: boolean }>>();

	on(event: string, fn: (...args: any[]) => void, _context?: unknown): this {
		return this.add(event, fn, false);
	}

	once(event: string, fn: (...args: any[]) => void, _context?: unknown): this {
		return this.add(event, fn, true);
	}

	private add(event: string, fn: (...args: any[]) => void, once: boolean): this {
		const existing = this.listeners.get(event);
		if (existing) {
			existing.push({ fn, once });
		} else {
			this.listeners.set(event, [{ fn, once }]);
		}
		return this;
	}

	off(event: string, fn?: (...args: any[]) => void): this {
		if (!fn) {
			this.listeners.delete(event);
			return this;
		}
		const remaining = (this.listeners.get(event) ?? []).filter((l) => l.fn !== fn);
		if (remaining.length) {
			this.listeners.set(event, remaining);
		} else {
			this.listeners.delete(event);
		}
		return this;
	}

	removeAllListeners(event?: string): this {
		if (event) {
			this.listeners.delete(event);
		} else {
			this.listeners.clear();
		}
		return this;
	}

	emit(event: string, ...args: any[]): boolean {
		const listeners = this.listeners.get(event);
		if (!listeners?.length) {
			return false;
		}
		for (const listener of [...listeners]) {
			if (listener.once) {
				this.off(event, listener.fn);
			}
			listener.fn(...args);
		}
		return true;
	}

	listenerCount(event: string): number {
		return this.listeners.get(event)?.length ?? 0;
	}
}

export function createPhaserMock() {
	return {
		Scene: SceneMock,
		Math: { Vector2: Vector2Mock, Easing: easingMock },
		Events: { EventEmitter: EventEmitterMock },
		/** Phaser 4 moved the geometry classes out of `GameObjects`. */
		Geom: { Polygon: GeomPolygonMock },
		GameObjects: {
			Polygon: class PolygonGameObjectMock extends GeomPolygonMock {
				constructor(_scene?: unknown, _x?: number, _y?: number, points?: unknown) {
					super(points);
				}
			},
		},
		BlendModes: { NORMAL: 0, ADD: 1, MULTIPLY: 2, SCREEN: 3 },
		AUTO: 0,
		CANVAS: 1,
		WEBGL: 2,
		HEADLESS: 3,
		Scale: {
			NONE: 0,
			FIT: 1,
			ENVELOP: 2,
			RESIZE: 3,
			NO_CENTER: 0,
			CENTER_BOTH: 1,
			WIDTH_CONTROLS_HEIGHT: 3,
			HEIGHT_CONTROLS_WIDTH: 4,
		},
		Signal: class SignalMock {},
		default: class PhaserMock {},
	};
}
