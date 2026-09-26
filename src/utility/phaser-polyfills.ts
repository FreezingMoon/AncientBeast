// Phaser 2 CE compatibility polyfills for Phaser 4
// This provides runtime implementations of Phaser 2 CE APIs that were removed in Phaser 4

// ─── Easing ────────────────────────────────────────────────────────────────────

type EaseFunction = (k: number) => number;

interface EasingMap {
	Linear: { None: EaseFunction; In: EaseFunction; Out: EaseFunction; InOut: EaseFunction };
	Quadratic: { In: EaseFunction; Out: EaseFunction; InOut: EaseFunction };
	Cubic: { In: EaseFunction; Out: EaseFunction; InOut: EaseFunction };
	Quartic: { In: EaseFunction; Out: EaseFunction; InOut: EaseFunction };
	Quintic: { In: EaseFunction; Out: EaseFunction; InOut: EaseFunction };
	Sinusoidal: { In: EaseFunction; Out: EaseFunction; InOut: EaseFunction };
	Exponential: { In: EaseFunction; Out: EaseFunction; InOut: EaseFunction };
	Circular: { In: EaseFunction; Out: EaseFunction; InOut: EaseFunction };
	Elastic: { In: EaseFunction; Out: EaseFunction; InOut: EaseFunction };
	Back: { In: EaseFunction; Out: EaseFunction; InOut: EaseFunction };
	Bounce: { In: EaseFunction; Out: EaseFunction; InOut: EaseFunction };
}

const linear = (k: number): number => k;

const easeIn =
	(power: number): EaseFunction =>
	(k: number): number =>
		Math.pow(k, power);

const easeOut =
	(power: number): EaseFunction =>
	(k: number): number =>
		1 - Math.pow(1 - k, power);

const easeInOut =
	(power: number): EaseFunction =>
	(k: number): number =>
		k < 0.5 ? 0.5 * Math.pow(2 * k, power) : 1 - 0.5 * Math.pow(2 - 2 * k, power);

const sinusoidalIn = (k: number): number => 1 - Math.cos((k * Math.PI) / 2);
const sinusoidalOut = (k: number): number => Math.sin((k * Math.PI) / 2);
const sinusoidalInOut = (k: number): number => 0.5 * (1 - Math.cos(Math.PI * k));

const exponentialIn = (k: number): number => (k === 0 ? 0 : Math.pow(2, 10 * (k - 1)));
const exponentialOut = (k: number): number => (k === 1 ? 1 : 1 - Math.pow(2, -10 * k));
const exponentialInOut = (k: number): number => {
	if (k === 0) return 0;
	if (k === 1) return 1;
	if ((k *= 2) < 1) return 0.5 * Math.pow(2, 10 * (k - 1));
	return 0.5 * (2 - Math.pow(2, -10 * (k - 1)));
};

const circularIn = (k: number): number => 1 - Math.sqrt(1 - k * k);
const circularOut = (k: number): number => Math.sqrt(1 - (k - 1) * (k - 1));
const circularInOut = (k: number): number => {
	if ((k *= 2) < 1) return -0.5 * (Math.sqrt(1 - k * k) - 1);
	return 0.5 * (Math.sqrt(1 - (k - 2) * (k - 2)) + 1);
};

const elasticIn = (k: number): number => {
	if (k === 0) return 0;
	if (k === 1) return 1;
	return -Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);
};
const elasticOut = (k: number): number => {
	if (k === 0) return 0;
	if (k === 1) return 1;
	return Math.pow(2, -10 * k) * Math.sin((k - 0.1) * 5 * Math.PI) + 1;
};
const elasticInOut = (k: number): number => {
	if (k === 0) return 0;
	if (k === 1) return 1;
	if ((k *= 2) < 1) return -0.5 * Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);
	return 0.5 * Math.pow(2, -10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI) + 1;
};

const backIn = (k: number): number => k * k * (2.70158 * k - 1.70158);
const backOut = (k: number): number => (k - 1) * (k - 1) * (2.70158 * (k - 1) + 1.70158) + 1;
const backInOut = (k: number): number => {
	const s = 1.70158 * 1.525;
	if ((k *= 2) < 1) return 0.5 * (k * k * ((s + 1) * k - s));
	return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
};

const bounceOut = (k: number): number => {
	if (k < 1 / 2.75) return 7.5625 * k * k;
	if (k < 2 / 2.75) return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
	if (k < 2.5 / 2.75) return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
	return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
};
const bounceIn = (k: number): number => 1 - bounceOut(1 - k);
const bounceInOut = (k: number): number =>
	k < 0.5 ? 0.5 * bounceIn(k * 2) : 0.5 * bounceOut(k * 2 - 1) + 0.5;

export const Easing: EasingMap = {
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
};

// ─── Signal ────────────────────────────────────────────────────────────────────

interface Listener {
	fn: (...args: unknown[]) => void;
	context: unknown;
	once: boolean;
}

export class Signal {
	private listeners: Listener[] = [];

	add(fn: (...args: unknown[]) => void, context?: unknown): void {
		this.listeners.push({ fn, context, once: false });
	}

	addOnce(fn: (...args: unknown[]) => void, context?: unknown): void {
		this.listeners.push({ fn, context, once: true });
	}

	remove(fn: (...args: unknown[]) => void, context?: unknown): void {
		this.listeners = this.listeners.filter(
			(l: Listener): boolean => l.fn !== fn || (context && l.context !== context),
		);
	}

	removeAll(): void {
		this.listeners = [];
	}

	dispatch(...args: unknown[]): void {
		const toRemove: number[] = [];
		this.listeners.forEach((listener, index) => {
			listener.fn.apply(listener.context, args);
			if (listener.once) toRemove.push(index);
		});
		for (let i = toRemove.length - 1; i >= 0; i--) {
			this.listeners.splice(toRemove[i], 1);
		}
	}

	get numListeners(): number {
		return this.listeners.length;
	}
}

// ─── BitmapData ────────────────────────────────────────────────────────────────

export class BitmapData {
	width: number;
	height: number;
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	dirty = false;

	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.canvas = document.createElement('canvas');
		this.canvas.width = width;
		this.canvas.height = height;
		const context = this.canvas.getContext('2d');
		if (!context) throw new Error('Failed to get 2d context');
		this.ctx = context;
	}

	update(): void {
		this.dirty = true;
	}

	destroy(): void {
		this.ctx = null as unknown as CanvasRenderingContext2D;
		this.canvas = null as unknown as HTMLCanvasElement;
	}
}

// ─── Group ─────────────────────────────────────────────────────────────────────

export class Group {
	x = 0;
	y = 0;
	alpha = 1;
	angle = 0;
	exists = true;
	children: unknown[] = [];

	position = {
		x: 0,
		y: 0,
		set: (x: number, y: number): void => {
			this.position.x = x;
			this.position.y = y;
			this.x = x;
			this.y = y;
		},
		clone: () => ({ x: this.x, y: this.y }),
	};

	scale = {
		x: 1,
		y: 1,
		setTo: (x: number, y?: number): void => {
			this.scale.x = x;
			this.scale.y = y ?? x;
		},
		set: (x: number, y?: number): void => {
			this.scale.x = x;
			this.scale.y = y ?? x;
		},
	};

	add(child: unknown): unknown {
		this.children.push(child);
		if ((child as Record<string, unknown>).parent)
			((child as Record<string, unknown>).parent as { remove: (c: unknown) => void }).remove(child);
		(child as Record<string, unknown>).parent = this;
		return child;
	}

	addAt(child: unknown, index: number): unknown {
		this.children.splice(index, 0, child);
		if ((child as Record<string, unknown>).parent)
			((child as Record<string, unknown>).parent as { remove: (c: unknown) => void }).remove(child);
		(child as Record<string, unknown>).parent = this;
		return child;
	}

	addChild(child: unknown): unknown {
		return this.add(child);
	}

	remove(child: unknown, destroy?: boolean): void {
		const idx = this.children.indexOf(child);
		if (idx > -1) {
			this.children.splice(idx, 1);
			(child as Record<string, unknown>).parent = null;
			if (destroy && (child as Record<string, unknown>).destroy)
				((child as Record<string, unknown>).destroy as () => void)();
		}
	}

	removeChild(child: unknown): void {
		this.remove(child);
	}

	removeAll(destroy?: boolean): void {
		this.children.forEach((c) => {
			(c as Record<string, unknown>).parent = null;
			if (destroy && (c as Record<string, unknown>).destroy)
				((c as Record<string, unknown>).destroy as () => void)();
		});
		this.children = [];
	}

	create(x: number, y: number, key: string, frame?: string, exists?: boolean): unknown {
		const sprite = { x, y, key, frame, exists: exists ?? true, parent: this };
		this.add(sprite);
		return sprite;
	}

	forEach(callback: (child: unknown) => void, context?: unknown): void {
		this.children.forEach((c) => callback.call(context, c));
	}

	sendToBack(child: unknown): void {
		const idx = this.children.indexOf(child);
		if (idx > 0) {
			this.children.splice(idx, 1);
			this.children.unshift(child);
		}
	}

	bringToTop(child: unknown): void {
		const idx = this.children.indexOf(child);
		if (idx > -1 && idx < this.children.length - 1) {
			this.children.splice(idx, 1);
			this.children.push(child);
		}
	}

	setChildIndex(child: unknown, index: number): void {
		const idx = this.children.indexOf(child);
		if (idx > -1) {
			this.children.splice(idx, 1);
			this.children.splice(index, 0, child);
		}
	}

	getChildIndex(child: unknown): number {
		return this.children.indexOf(child);
	}

	sort(key?: string, order?: number): void {
		if (key) {
			this.children.sort((a, b) => {
				const aVal = (a as Record<string, unknown>)[key];
				const bVal = (b as Record<string, unknown>)[key];
				return order ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
			});
		}
	}

	update(): void {
		this.children.forEach((c) => {
			if ((c as Record<string, unknown>).update)
				((c as Record<string, unknown>).update as () => void)();
		});
	}

	alignIn(): this {
		return this;
	}

	destroy(): void {
		this.removeAll(true);
	}

	createMultiple(quantity: number, key: string, frame?: string, exists?: boolean): unknown[] {
		const sprites: unknown[] = [];
		for (let i = 0; i < quantity; i++) {
			sprites.push(this.create(0, 0, key, frame, exists));
		}
		return sprites;
	}

	toGlobal(position: { x: number; y: number }): { x: number; y: number } {
		return { x: this.x + position.x, y: this.y + position.y };
	}

	toLocal(position: { x: number; y: number }): { x: number; y: number } {
		return { x: position.x - this.x, y: position.y - this.y };
	}
}

// ─── Tween ─────────────────────────────────────────────────────────────────────

interface TweenData {
	target: unknown;
	properties: Record<string, { start: number; end: number }>;
	duration: number;
	ease: EaseFunction;
	delay: number;
	repeat: number;
	yoyo: boolean;
	onComplete?: () => void;
	onUpdate?: (tween: Tween) => void;
	startTime: number;
	elapsed: number;
	isRunning: boolean;
	isPaused: boolean;
	repeatCounter: number;
	pendingDelete: boolean;
}

export class Tween {
	static manager: TweenManager | null = null;
	static game: unknown = null;

	private _target: unknown;
	private _properties: Record<string, { start: number; end: number }> = {};
	private _duration = 1000;
	private _ease: EaseFunction = linear;
	private _delay = 0;
	private _repeat = 0;
	private _yoyo = false;
	private _onComplete: (() => void) | null = null;
	private _onUpdate: ((tween: Tween) => void) | null = null;
	private _startTime = 0;
	private _elapsed = 0;
	private _isRunning = false;
	private _isPaused = false;
	private _repeatCounter = 0;
	private _pendingDelete = false;

	constructor(target: unknown, game?: unknown) {
		this._target = target;
		if (game) Tween.game = game;
		if (Tween.manager) Tween.manager.add(this);
	}

	to(
		properties: Record<string, number>,
		duration?: number,
		ease?: EaseFunction,
		autoStart?: boolean,
		delay?: number,
		repeat?: number,
		yoyo?: boolean,
	): this {
		this._properties = {};
		for (const key in properties) {
			this._properties[key] = {
				start: (this._target as Record<string, number>)[key] ?? 0,
				end: properties[key],
			};
		}
		if (duration !== undefined) this._duration = duration;
		if (ease !== undefined) this._ease = ease;
		if (delay !== undefined) this._delay = delay;
		if (repeat !== undefined) this._repeat = repeat;
		if (yoyo !== undefined) this._yoyo = yoyo;
		if (autoStart) this.start();
		return this;
	}

	start(): this {
		this._startTime = Date.now() + this._delay;
		this._elapsed = 0;
		this._isRunning = true;
		this._isPaused = false;
		this._repeatCounter = 0;
		return this;
	}

	stop(): this {
		this._isRunning = false;
		this._pendingDelete = true;
		return this;
	}

	pause(): this {
		this._isPaused = true;
		return this;
	}

	resume(): this {
		this._isPaused = false;
		return this;
	}

	update(time: number): boolean {
		if (!this._isRunning || this._isPaused || this._pendingDelete) return this._pendingDelete;

		if (time < this._startTime) return false;

		this._elapsed = time - this._startTime;
		const progress = Math.min(this._elapsed / this._duration, 1);
		const eased = this._ease(progress);

		for (const key in this._properties) {
			const prop = this._properties[key];
			(this._target as Record<string, number>)[key] = prop.start + (prop.end - prop.start) * eased;
		}

		if (this._onUpdate) this._onUpdate(this);

		if (progress >= 1) {
			if (this._repeatCounter < this._repeat) {
				this._repeatCounter++;
				if (this._yoyo) {
					for (const key in this._properties) {
						const prop = this._properties[key];
						[prop.start, prop.end] = [prop.end, prop.start];
					}
				} else {
					for (const key in this._properties) {
						this._properties[key].start = this._properties[key].end;
					}
				}
				this._startTime = time;
				this._elapsed = 0;
			} else {
				this._isRunning = false;
				this._pendingDelete = true;
				if (this._onComplete) this._onComplete();
			}
		}

		return this._pendingDelete;
	}

	onComplete(callback: () => void): this {
		this._onComplete = callback;
		return this;
	}

	onUpdate(callback: (tween: Tween) => void): this {
		this._onUpdate = callback;
		return this;
	}

	get isRunning(): boolean {
		return this._isRunning;
	}

	get pendingDelete(): boolean {
		return this._pendingDelete;
	}
}

export class TweenManager {
	private tweens: Tween[] = [];
	private game: unknown;

	constructor(game: unknown) {
		this.game = game;
		Tween.manager = this;
		Tween.game = game;
	}

	add(tween: Tween): Tween {
		this.tweens.push(tween);
		return tween;
	}

	remove(tween: Tween): void {
		const idx = this.tweens.indexOf(tween);
		if (idx > -1) this.tweens.splice(idx, 1);
	}

	removeFrom(target: object): void {
		this.tweens = this.tweens.filter(
			(t) => (t as unknown as { _target: unknown })._target !== target,
		);
	}

	update(time?: number): void {
		const now = time ?? Date.now();
		this.tweens = this.tweens.filter((t) => {
			const done = t.update(now);
			return !done;
		});
	}

	removeAll(): void {
		this.tweens = [];
	}

	getAll(): Tween[] {
		return [...this.tweens];
	}
}

// ─── Global registration ──────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
	const win = window as unknown as { Phaser?: Record<string, unknown> };
	if (win.Phaser) {
		win.Phaser.Easing = Easing;
		win.Phaser.Signal = Signal;
		win.Phaser.BitmapData = BitmapData;
		win.Phaser.Group = Group;
		win.Phaser.Tween = Tween;
		win.Phaser.TweenManager = TweenManager;
	}
}

export { Easing as defaultEasing };
