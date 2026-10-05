import { Easing } from './easing';
import Game from '../game';
import { Effect } from '../effect';
import { Hex } from './hex';
import { Player } from '../player';
import { Creature } from '../creature';
import { capitalize } from './string';
import type { GroupHandle, SpriteHandle, TweenHandle } from '../engine/types';
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
	display: SpriteHandle;
	displayOver: SpriteHandle;

	/** Tweens running the idle sprite animation (e.g. flame flicker). Stopped on destroy. */
	private _idleTweens: TweenHandle[] = [];
	/** Extra sprites created by the idle animation (e.g. flame layers). Destroyed with the trap. */
	private _overlaySprites: SpriteHandle[] = [];

	private _moveSpriteToGroup(sprite: SpriteHandle, targetGroup: GroupHandle) {
		const sourceGroup = sprite.parent as GroupHandle | null;
		if (!sourceGroup || sourceGroup === targetGroup) {
			return;
		}

		const worldPos = sourceGroup.toGlobal(sprite.position.clone());
		sourceGroup.remove(sprite, false);
		targetGroup.add(sprite);
		const localPos = targetGroup.toLocal(worldPos);
		sprite.setPosition(localPos.x, localPos.y);
	}

	private _moveVisualsToOverLayer(enabled: boolean) {
		const targetGroup = enabled ? this.game.grid.creatureGroup : this.game.grid.trapGroup;
		this._moveSpriteToGroup(this.display, targetGroup);
		this._overlaySprites.forEach((sprite) => {
			if (sprite && sprite.active) {
				this._moveSpriteToGroup(sprite, targetGroup);
			}
		});
		if (this.displayOver && this.displayOver.active) {
			this._moveSpriteToGroup(this.displayOver, targetGroup);
		}
	}

	syncTypeOverVisual(enabled: boolean) {
		this._moveVisualsToOverLayer(enabled);
	}

	setTypeOver(enabled: boolean, reorder = true) {
		if (this.typeOver === enabled) {
			return;
		}

		this.typeOver = enabled;
		this._moveVisualsToOverLayer(enabled);
		if (reorder) {
			this.game.grid.orderCreatureZ();
		}
	}

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

		// Traps are created in the base trap layer.
		// Bonfire-spring is moved above units only while a creature occupies the same hex.
		const targetGroup = game.grid.trapGroup;
		this.display = game.gameEngine.add.sprite(
			px.x + HEX_WIDTH_PX / 2,
			px.y + 60,
			spriteName,
			undefined,
			targetGroup,
		);
		this.display.setOrigin(0.5, 0.5);

		if (type === 'bonfire-spring') {
			game.animations.startBonfireSpringTrapAnimation(
				this.display,
				targetGroup,
				this._idleTweens,
				this._overlaySprites,
			);
		}

		if (type === 'scorched-ground') {
			game.animations.startScorchedGroundTrapAnimation(
				this.display,
				targetGroup,
				this._idleTweens,
				this._overlaySprites,
			);
		}

		game.grid.orderCreatureZ();
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
		const tweenDuration = 500;

		// Stop idle animations so they don't interfere with the destroy tween.
		this._idleTweens.forEach((t) => t.stop());
		this._idleTweens = [];

		const destroySprite = (sprite: SpriteHandle, animation: string) => {
			if (animation === 'shrinkDown') {
				// Flame animation may have already set anchor to bottom; only compensate once.
				if (sprite.originY !== 1) {
					sprite.originY = 1;
					sprite.y += sprite.height / 2;
				}

				const tween = game.gameEngine.tween(sprite.scale).to({ y: 0 }, tweenDuration).start();
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
		this.game.gameEngine.tween(this.display).to({ alpha: 0 }, duration, Easing.Linear.None).start();
	}

	show(duration = 0) {
		this.game.gameEngine.tween(this.display).to({ alpha: 1 }, duration, Easing.Linear.None).start();
	}

	getVisualSprites(): SpriteHandle[] {
		const sprites = [this.display, ...this._overlaySprites];
		return sprites.filter((sprite): sprite is SpriteHandle => Boolean(sprite && sprite.active));
	}

	pauseIdleAnimation() {
		this._idleTweens.forEach((tween) => tween.stop());
		this._idleTweens = [];
	}

	resumeIdleAnimation() {
		if (!this.display || !this.display.active) {
			return;
		}

		if (this.type !== 'bonfire-spring' && this.type !== 'scorched-ground') {
			return;
		}

		this._overlaySprites.forEach((sprite) => {
			if (sprite && sprite.active) {
				sprite.destroy();
			}
		});
		this._overlaySprites = [];

		const group = this.display.parent as GroupHandle | null;
		if (!group) {
			return;
		}

		if (this.type === 'bonfire-spring') {
			this.game.animations.startBonfireSpringTrapAnimation(
				this.display,
				group,
				this._idleTweens,
				this._overlaySprites,
			);
			if (this.typeOver && group !== this.game.grid.trapOverGroup) {
				this.setTypeOver(true);
				return;
			}
			this.game.grid.orderCreatureZ();
			return;
		}

		this.game.animations.startScorchedGroundTrapAnimation(
			this.display,
			group,
			this._idleTweens,
			this._overlaySprites,
		);
		if (this.typeOver && group !== this.game.grid.trapOverGroup) {
			this.setTypeOver(true);
			return;
		}
		this.game.grid.orderCreatureZ();
	}
}
