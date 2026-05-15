import Game from '../game';
import { Effect } from '../effect';
import { Hex } from './hex';
import { Player } from '../player';
import { Creature } from '../creature';
import { capitalize } from './string';
import { getPointFacade } from './pointfacade';
import { HEX_WIDTH_PX, offsetCoordsToPx } from './const';

export type DestroyAnimationType = 'shrinkDown' | 'none';

export type TrapOptions = Partial<Trap>;

export class Trap {
	id: number;
	x: number;
	y: number;
	game: Game;
	type: string;
	name: string;
	effects: Effect[];
	owner: Player;
	creationTurn: number;

	/**
	 * NOTE: The following attributes are typically set in the
	 * constructor using the "opt" argument.
	 */
	turnLifetime = -1;
	fullTurnLifetime = false;
	ownerCreature: Creature | undefined = undefined; // Needed for fullTurnLifetime
	destroyOnActivate = false;
	typeOver = false;
	destroyAnimation: DestroyAnimationType = 'none';

	/** Optional callback invoked when this trap is destroyed.
	 *  Receives the creature whose trap placement caused the destruction, if known.
	 */
	onDestroyFn?: (destroyer?: Creature) => void;

	//
	display: Phaser.Sprite;
	displayOver: Phaser.Sprite;

	/** Tweens running the idle sprite animation (e.g. flame flicker). Stopped on destroy. */
	private _idleTweens: Phaser.Tween[] = [];
	/** Extra sprites created by the idle animation (e.g. flame layers). Destroyed with the trap. */
	private _overlaySprites: Phaser.Sprite[] = [];

	constructor(
		x: number,
		y: number,
		type: string,
		effects: Effect[],
		owner: Player,
		opt: TrapOptions | undefined,
		game: Game,
		name = '',
	) {
		this.game = game;
		this.type = type;
		this.x = x;
		this.y = y;
		this.name = name || capitalize(type.split('-').join(' '));
		this.effects = effects;
		this.owner = owner;
		this.creationTurn = game.turn;

		if (opt) {
			for (const key of Object.keys(opt)) {
				if (key in this) {
					this[key] = opt[key];
				}
			}
		}

		this.id = game.trapId++;

		// NOTE: Destroy any existing traps here, attributing the destruction to
		// the owner of the new (this) trap so onDestroyFn callbacks know the killer.
		getPointFacade()
			.getTrapsAt(this)
			.forEach((trap) => trap.destroy(this.ownerCreature));
		game.traps.push(this);

		for (let i = this.effects.length - 1; i >= 0; i--) {
			this.effects[i].trap = this;
		}

		const spriteName = 'trap_' + type;
		const px = offsetCoordsToPx(this);
		this.display = game.grid.trapGroup.create(px.x + HEX_WIDTH_PX / 2, px.y + 60, spriteName);
		this.display.anchor.setTo(0.5);

		if (type === 'bonfire-spring') {
			this._startFlameAnimation(game);
		}

		if (this.typeOver) {
			this.displayOver = game.grid.trapOverGroup.create(
				px.x + HEX_WIDTH_PX / 2,
				px.y + 60,
				spriteName,
			);
			this.displayOver.anchor.setTo(0.5);
			this.displayOver.scale.x *= -1;
		}
	}

	/**
	 * @deprecated: Use this.game.hexAt(x, y)
	 */
	get hex(): Hex {
		return this.game.hexAt(this.x, this.y);
	}

	activate(trigger: RegExp, target: Creature | Hex) {
		this.effects.forEach((effect) => {
			if (trigger.test(effect.trigger) && effect.requireFn()) {
				this.game.log('Trap triggered');
				effect.activate(target);
			}
		});

		if (this.destroyOnActivate) {
			this.destroy();
		}
	}

	destroy(destroyer?: Creature) {
		const game = this.game;
		const phaser: Phaser.Game = game.Phaser;
		const tweenDuration = 500;

		// Stop idle animations so they don't interfere with the destroy tween.
		this._idleTweens.forEach((t) => t.stop());
		this._idleTweens = [];

		const destroySprite = (sprite: Phaser.Sprite, animation: string) => {
			if (animation === 'shrinkDown') {
				// Flame animation may have already set anchor to bottom; only compensate once.
				if (sprite.anchor.y !== 1) {
					sprite.anchor.y = 1;
					sprite.y += sprite.height / 2;
				}

				const tween = phaser.add
					.tween(sprite.scale)
					.to({ y: 0 }, tweenDuration, Phaser.Easing.Linear.None)
					.start();
				tween.onComplete.add(() => sprite.destroy());
			} else {
				sprite.destroy();
			}
		};

		destroySprite(this.display, this.destroyAnimation);
		if (this.displayOver) {
			destroySprite(this.displayOver, this.destroyAnimation);
		}
		this._overlaySprites.forEach((s) => destroySprite(s, this.destroyAnimation));
		this._overlaySprites = [];

		game.traps = game.traps.filter((trap) => trap !== this);
		this.onDestroyFn?.(destroyer);
	}

	hide(duration = 0) {
		this.game.Phaser.add
			.tween(this.display)
			.to({ alpha: 0 }, duration, Phaser.Easing.Linear.None)
			.start();
	}

	show(duration = 0) {
		this.game.Phaser.add
			.tween(this.display)
			.to({ alpha: 1 }, duration, Phaser.Easing.Linear.None)
			.start();
	}

	/**
	 * Builds a layered flame for bonfire-spring traps.
	 *
	 * - Static base is compressed into an ember bed.
	 * - Centered glow layers provide dense molten mass.
	 * - Three spread clusters add body + lower tongue + upper tip layers.
	 *
	 * Tweens use random phase delays to prevent traps from moving in sync.
	 */
	private _startFlameAnimation(game: Game) {
		const phaser: Phaser.Game = game.Phaser;
		const base = this.display;

		base.anchor.y = 1;
		base.y += base.height / 2;
		// Variant 02 baseline from the demo: flatten the stock sprite into an ember bed.
		base.scale.y = 0.62;
		base.alpha = 0.76;
		const bx = base.x;
		const by = base.y;

		const rand = (n: number) => Math.random() * n;
		const randInt = (n: number) => Math.floor(rand(n));

		// Forever-yoyo tween with a random initial phase.
		const yoyo = (
			obj: object,
			props: object,
			duration: number,
			ease: (k: number) => number,
			maxPhase = duration,
		): Phaser.Tween =>
			phaser.add.tween(obj).to(props, duration, ease, true, randInt(maxPhase), -1, true);

		// Broad ember flicker under the flames: keeps the base glowing without moving sideways.
		const baseGlow = game.grid.trapGroup.create(bx, by, 'trap_bonfire-spring') as Phaser.Sprite;
		baseGlow.anchor.setTo(0.5, 1);
		baseGlow.alpha = 0.4;
		baseGlow.scale.setTo(1.08, 0.72);
		this._idleTweens.push(
			yoyo(baseGlow.scale, { x: 1.14, y: 0.8 }, 180 + randInt(120), Phaser.Easing.Quadratic.InOut),
			yoyo(baseGlow, { alpha: 0.34 }, 180 + randInt(120), Phaser.Easing.Linear.None),
		);
		this._overlaySprites.push(baseGlow);

		// Dense molten core: centered and persistent so the fire reads as thick, not hollow.
		const core = game.grid.trapGroup.create(bx, by - 6, 'trap_bonfire-spring') as Phaser.Sprite;
		core.anchor.setTo(0.5, 1);
		core.alpha = 0.58;
		core.scale.setTo(0.76, 0.98);
		this._idleTweens.push(
			yoyo(core.scale, { x: 0.81, y: 1.1 }, 220 + randInt(120), Phaser.Easing.Quadratic.InOut),
			yoyo(core, { alpha: 0.5 }, 220 + randInt(120), Phaser.Easing.Linear.None),
		);
		this._overlaySprites.push(core);

		// Bridge layer ties the dense base/core to the animated top tongues.
		const bridge = game.grid.trapGroup.create(bx, by - 10, 'trap_bonfire-spring') as Phaser.Sprite;
		bridge.anchor.setTo(0.5, 1);
		bridge.alpha = 0.34;
		bridge.scale.setTo(0.56, 1.14);
		const bridgeDrift = 0.8 + rand(0.8);
		bridge.x = bx - bridgeDrift;
		this._idleTweens.push(
			yoyo(bridge.scale, { x: 0.58, y: 1.2 }, 230 + randInt(120), Phaser.Easing.Quadratic.InOut),
			yoyo(bridge, { alpha: 0.32 }, 230 + randInt(120), Phaser.Easing.Linear.None),
			yoyo(bridge, { x: bx + bridgeDrift }, 240 + randInt(120), Phaser.Easing.Sinusoidal.InOut),
		);
		this._overlaySprites.push(bridge);

		// ── Three clusters spread across the hex at x ≈ -26, -2, +24 ────────────────
		const clusters: Array<{
			dx: number;
			bodyScaleY: number;
			tongueScaleY: number;
			tongueScaleX: number;
		}> = [
			{ dx: -26, bodyScaleY: 0.75, tongueScaleY: 1.18, tongueScaleX: 0.38 },
			{ dx: -2, bodyScaleY: 0.82, tongueScaleY: 1.28, tongueScaleX: 0.42 },
			{ dx: 24, bodyScaleY: 0.7, tongueScaleY: 1.14, tongueScaleX: 0.35 },
		];

		for (const c of clusters) {
			const cx = bx + c.dx;

			// Body: lifted a bit above the base so the ground line stays visually stiff.
			const body = game.grid.trapGroup.create(cx, by - 4, 'trap_bonfire-spring') as Phaser.Sprite;
			body.anchor.setTo(0.5, 1);
			body.alpha = 0.72;
			body.scale.setTo(0.78, c.bodyScaleY);
			// Keep near-base sway very subtle so only upper portions read as moving.
			const bodySway = 0.02 + rand(0.02); // ±0.02–0.04 rad ≈ ±1–2°
			body.rotation = -bodySway;
			this._idleTweens.push(
				yoyo(
					body.scale,
					{ y: c.bodyScaleY * 1.18 },
					380 + randInt(120),
					Phaser.Easing.Quadratic.InOut,
				),
				yoyo(body, { alpha: 0.52 }, 320 + randInt(100), Phaser.Easing.Linear.None),
				yoyo(body, { rotation: bodySway }, 850 + randInt(300), Phaser.Easing.Sinusoidal.InOut),
			);
			this._overlaySprites.push(body);

			// Lower tongue: lifted and damped so it doesn't make the bottom look like it's sliding.
			const tongue = game.grid.trapGroup.create(cx, by - 8, 'trap_bonfire-spring') as Phaser.Sprite;
			tongue.anchor.setTo(0.5, 1);
			tongue.alpha = 0.36;
			tongue.scale.setTo(c.tongueScaleX, c.tongueScaleY);
			const tongueDrift = 0.015 + rand(0.015); // ±0.015–0.03 rad ≈ ±1–2°
			tongue.rotation = -tongueDrift;
			this._idleTweens.push(
				yoyo(
					tongue.scale,
					{ y: c.tongueScaleY * 1.32, x: c.tongueScaleX * 0.8 },
					240 + randInt(120),
					Phaser.Easing.Quadratic.InOut,
				),
				yoyo(tongue, { alpha: 0.31 }, 220 + randInt(120), Phaser.Easing.Linear.None),
				yoyo(tongue, { rotation: tongueDrift }, 760 + randInt(340), Phaser.Easing.Sinusoidal.InOut),
			);
			this._overlaySprites.push(tongue);

			// Upper tip: a separate layer placed slightly higher, with controlled sway.
			const tip = game.grid.trapGroup.create(cx, by - 10, 'trap_bonfire-spring') as Phaser.Sprite;
			tip.anchor.setTo(0.5, 1);
			tip.alpha = 0.48;
			tip.scale.setTo(c.tongueScaleX * 0.55, c.tongueScaleY * 0.95);
			const tipSway = 0.09 + rand(0.04); // ±0.09–0.13 rad ≈ ±5–7°
			const tipDriftX = 0.8 + rand(1.0);
			tip.x = cx - tipDriftX;
			tip.rotation = -tipSway;
			this._idleTweens.push(
				yoyo(
					tip.scale,
					{ y: c.tongueScaleY * 1.2, x: c.tongueScaleX * 0.46 },
					210 + randInt(120),
					Phaser.Easing.Quadratic.InOut,
				),
				yoyo(tip, { alpha: 0.38 }, 180 + randInt(100), Phaser.Easing.Linear.None),
				yoyo(tip, { rotation: tipSway }, 300 + randInt(140), Phaser.Easing.Sinusoidal.InOut),
				yoyo(tip, { x: cx + tipDriftX }, 280 + randInt(140), Phaser.Easing.Sinusoidal.InOut),
			);
			this._overlaySprites.push(tip);
		}
	}
}
