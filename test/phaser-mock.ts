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

export function createPhaserMock() {
	return {
		Scene: SceneMock,
		Math: { Vector2: Vector2Mock },
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
