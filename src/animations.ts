import { BLEND_MODE_ADD } from './phaser/runtime';
import { createGameCanvasSurface, type CanvasSurface } from './game-display/canvas-surface';
import type { SpriteHandle, GroupHandle, TweenHandle } from './engine/types';
import { Easing } from './utility/easing';
import * as arrayUtils from './utility/arrayUtils';
import { extractTextureFrameInfo, createBitmapDataFromTexture } from './utility/bitmapUtils';
import { getEffectShader, advanceShaderTime, type ShaderUniformMap } from './shader';
import Game from './game';
import { Creature } from './creature';
import { Hex } from './utility/hex';
import { Trap } from './utility/trap';
import { Ability } from './ability';
import { QuadraticCurve } from './utility/curve';
import { DEBUG_ENABLE_FAST_WALKING, DEBUG_WALK_SPEED_MS } from './debug';
import { isDocumentHidden } from './utility/time';
import { after, deltaMs, now } from './timing/clock';
import { spawnAfterimageTrail, AFTERIMAGE_SPEED_BOOST } from './vertigo';

// to fix @ts-expect-error 2554: properly type the arguments for the trigger functions in `game.ts`

/**
 * Cardboard tilt tuning. A tilt is a rotation about the unit's base rather
 * than a slide, so the silhouette stays on its hex while the body leans —
 * forward into a strike, back from a blow. The lean scales with the damage
 * that provoked it (capped at {@link TILT_MAX_DAMAGE}) and carries a random
 * jitter so consecutive hits do not rock the cardboard identically.
 */
const TILT_BASE_DEGREES = 3;
const TILT_PER_DAMAGE = 0.18;
const TILT_MAX_DAMAGE = 50;
const TILT_MAX_DEGREES = 12;
const TILT_JITTER = 2;

/**
 * Per-hex share of a creature's `walk_speed` used by {@link Animations.fly}. Flying
 * covers the whole path in one tween, so a flat `walk_speed` made it look like a
 * teleport; walking the same distance at the walking pace made it look like a
 * crawl. Half pace per hex reads as flight.
 */
const FLIGHT_SPEED_FACTOR = 0.5;

type ShatterTexture = {
	crop?: { x: number; y: number; width: number; height: number };
	frame?: { x: number; y: number; width: number; height: number };
	baseTexture?: { source?: CanvasImageSource };
	width?: number;
	height?: number;
};

type AnimationOptions = {
	customMovementPoint?: number;
	overrideSpeed?: number;
	ignoreMovementPoint?: boolean;
	ignoreTraps?: boolean;
	ignoreFacing?: boolean;
	animation?: string;
	teleportEffect?: 'abolishedBonfire';
	createTeleportDestinationTraps?: () => Trap[];
	callback?: () => void;
	callbackStepIn?: (hex?: Hex) => void;
	pushed?: boolean;
	turnAroundOnComplete?: boolean;
	flipped?: boolean;
	/**
	 * Direction of a tilt, in facing units: 1 leans right, -1 left. A
	 * caster tilts toward the target it faces; a unit hit from the right
	 * leans away from it.
	 */
	tiltDir?: number;
	/**
	 * Damage that provoked a tilt, used to scale how far the cardboard
	 * leans. More damage, harder the lean — capped at
	 * {@link TILT_MAX_DAMAGE}.
	 */
	tiltDamage?: number;
	/**
	 * The moved creature trails afterimages for this move,
	 * even though the unit itself is not an afterimage
	 * unit. Set by abilities that dash, drag or knock
	 * their target around.
	 */
	afterimages?: boolean;
};

/**
 * Chase rate for the haze and heat overlays. High enough to look welded to the
 * cardboard while it stands still, low enough to smear behind it while it walks.
 */
const INFERNAL_OVERLAY_FOLLOW = 26;

/**
 * A cardboard jump larger than this is a teleport (materialise, reparent, hex
 * snap) rather than walking, and is snapped instead of eased.
 */
const INFERNAL_OVERLAY_SNAP_DISTANCE = 96;

/**
 * Rate of the glow's slow breath, in rad/s, so one full pulse is `2π / 0.69`
 * ~9.1s. Tuned down three times from the 1.87 it shipped at: a quarter slower,
 * then another 30%, then another 30%. Each step was still quick enough to read
 * as a pulse on a unit that is meant to look like it is smouldering rather than
 * flashing.
 */
const INFERNAL_GLOW_PULSE_SPEED = 0.69;

/**
 * The heat layer is bottom-anchored, so any vertical scale above 1 pushes a
 * full-cardboard copy above the silhouette with nothing occluding it: a static
 * ghost hovering over the unit, which does not move or breathe with it. Held at
 * 1:1 and feathered top-to-bottom it only bleeds through the cardboard's own
 * semi-transparent alpha. The upward heat comes from the rising smoke instead.
 */
const INFERNAL_HEAT_LAYER_SCALE_Y = 1;

/**
 * Rising smoke smoke.
 */
const INFERNAL_SMOKE_ENABLED = true;

/**
 * Chase rate for a smoke's anchor, in the same exponential form as
 * INFERNAL_OVERLAY_FOLLOW so the lag is frame-rate independent.
 *
 * Under a steady walk the anchor settles at `speed * (1 - follow) / follow`
 * behind the unit, and that distance is the entire lag. It is easy to make
 * this so small it stops reading as lag at all: at 95 it was ~2px on an
 * 8px/frame walk, invisible on a cardboard ~120px wide, so the smoke looked
 * welded on and simply rose straight up. At 20 it is ~20px, which is plainly a
 * trail while still overlapping the unit rather than parting company with it.
 * Dropping to a share-of-each-step model instead (letting the smoke fall
 * progressively further behind with no chase at all) was tried and is far too
 * much: a smoke's whole life is ~1.35s, enough to leave it hundreds of pixels
 * behind, which is the detached-ghost problem again.
 */
const INFERNAL_SMOKE_LAG_RATE = 9;

type InfernalCardboardEffectState = {
	trailNextAt: number;
	heatNextAt: number;
	/** Overlays trail the cardboard instead of being welded to it. */
	hazeX: number;
	hazeY: number;
	heatX: number;
	heatY: number;
	hazePulsePhaseMs: number;
	hazePulsePeriodMs: number;
	hazePulsePhaseRad: number;
	luminescenceUniforms: ShaderUniformMap;
	heatUniforms: ShaderUniformMap;
	hazeReady: boolean;
	heatReady: boolean;
	/**
	 * False until a tick has positioned the overlays on the live sprite. `init`
	 * runs while the cardboard is still at the origin and unflipped (`setDir`
	 * places it afterwards), so showing the overlays then drew a stray
	 * full-cardboard copy at (0, 0) that was not even facing the right way.
	 */
	synced: boolean;
	/**
	 * How fast the cardboard is travelling, in pixels per frame. Smoke at the
	 * unit's feet is parented to it and dimmed in motion, so a walking unit does
	 * not drag a bright full-cardboard copy along with it.
	 */
	speedPx: number;
	/**
	 * The combined pulse for this frame, shared between the haze and the heat
	 * layer so both breathe together.
	 */
	glowFlicker: number;
	/**
	 * Live smoke. Each tracks the unit through `anchor` and carries its own rise
	 * and drift in `offset`, with the sprite's position recomputed from the two
	 * every tick. The offset is what the tween animates: tweening `x`/`y`
	 * directly would write absolute spawn-time coordinates back over the anchor
	 * each frame, pinning the smoke where the unit used to be.
	 */
	smoke: Array<{
		sprite: SpriteHandle;
		/** Where the unit was when this smoke spawned. The smoke never returns to it. */
		anchorX: number;
		anchorY: number;
		/** Rise and drift away from the anchor, in the smoke layer's space. */
		offset: { x: number; y: number };
		/**
		 * Scale as an unsigned magnitude. Held separately from `sprite.scale` so
		 * the facing sign can be re-derived from the unit each tick: a sign baked
		 * in at spawn left smoke facing the way the unit was heading when it was
		 * born, so a unit that turned around kept trailing cardboard facing the
		 * other way.
		 */
		growth: { x: number; y: number };
	}>;
	/**
	 * The cardboard's world position on the previous tick. Movement is measured
	 * from this rather than from the sprite's own x/y: walking tweens the
	 * creature *group* (see CreatureSprite#setPx) while the sprite's local
	 * position stays fixed, so a sprite-local delta is always zero and any smoke
	 * driven by it stands still while the unit walks out from under it.
	 */
	lastWorldX: number;
	lastWorldY: number;
	/**
	 * The creature group's position on the previous tick. Walking tweens the
	 * group rather than the sprite, so this is what a detached smoke has to be
	 * fed to follow the unit.
	 */
	lastGroupX: number;
	lastGroupY: number;
	sprite: SpriteHandle;
	group: GroupHandle;
	hazeSprite?: SpriteHandle;
	hazeBmd?: CanvasSurface;
	hazeFrame?: { x: number; y: number; width: number; height: number };
	hazeSource?: CanvasImageSource;
	heatBmd?: CanvasSurface;
	heatFrame?: { x: number; y: number; width: number; height: number };
	heatSource?: CanvasImageSource;
	heatLayerSprite?: SpriteHandle;
	tweens: TweenHandle[];
	trailSprites: SpriteHandle[];
};

const BONFIRE_BASELINE_Y_COMPENSATION_PX = -15;

export class Animations {
	game: Game;
	movementPoints: number;
	animationCounter: number;
	private _infernalCardboardFx = new Map<string, InfernalCardboardEffectState>();
	xraySuppressed = false;

	constructor(game: Game) {
		this.game = game;
		this.movementPoints = 0;
		this.animationCounter = 0;
	}

	private _infernalCardboardFxKey(creature: Creature): string {
		return `${creature.team}:${creature.id}`;
	}

	private _getLiveInfernalCardboardTarget(creature: Creature, fallbackSprite?: SpriteHandle) {
		const sprite = creature.creatureSprite?.sprite ?? fallbackSprite;
		const group = (sprite?.parent as GroupHandle | undefined) ?? creature.creatureSprite?.grp;
		return { sprite, group };
	}

	/**
	 * Bottom-anchors an overlay onto the cardboard's own baseline and sets its
	 * scale and position in one step.
	 *
	 * Phaser 4 resolves an origin against the texture frame it is set on, so
	 * `loadTexture` invalidates any anchoring done before it. It also only treats
	 * `setOrigin` as meaningful together with the position it was set against,
	 * which is why `Hex#pinTopLeft` re-applies x/y. Doing all three here means
	 * every call site stays pinned to the cardboard's bottom edge — otherwise a
	 * scaled overlay grows about the wrong point and slides off the base.
	 */
	private _anchorInfernalOverlay(
		overlay: SpriteHandle,
		x: number,
		y: number,
		scaleX: number,
		scaleY: number,
	): void {
		overlay.setOrigin(0.5, 1);
		overlay.x = x;
		overlay.y = y;
		overlay.setScale(scaleX, scaleY);
	}

	private _retryInfernalCardboardBitmaps(
		state: InfernalCardboardEffectState,
		sprite: SpriteHandle,
		dir: number,
	) {
		const texture = sprite.texture as unknown as ShatterTexture & {
			baseTexture?: { source?: CanvasImageSource };
		};
		const frameInfo = extractTextureFrameInfo(texture);
		const frame = frameInfo?.frame;
		const source = frameInfo?.source;

		if (!frame || !source || frame.width <= 0 || frame.height <= 0) {
			return;
		}

		if (!state.hazeReady && state.hazeSprite) {
			try {
				state.hazeFrame = frame;
				state.hazeSource = source;
				state.hazeBmd?.destroy();
				state.hazeBmd = createBitmapDataFromTexture(this.game, {
					frame,
					source,
					width: frame.width,
					height: frame.height,
				});
				const { ctx } = state.hazeBmd;
				const { width, height } = frame;
				const imageData = ctx.getImageData(0, 0, width, height);
				const data = imageData.data;
				for (let index = 0; index < data.length; index += 4) {
					const red = data[index];
					const green = data[index + 1];
					const blue = data[index + 2];
					const alpha = data[index + 3] / 255;
					const warmMask = Math.max(0, (red - blue) / 255) * Math.max(0, (red - green) / 255);
					if (warmMask <= 0.08) {
						data[index + 3] = 0;
						continue;
					}

					// Hot core. Concentrating the glow toward the middle of the body
					// reads as the unit being alight from within; spreading it evenly
					// over the silhouette just brightens the whole outline and stays
					// flat however far the alpha is pushed.
					const px = (index / 4) % width;
					const py = Math.floor(index / 4 / width);
					const dx = (px - width * 0.5) / (width * 0.5);
					// Core sits below centre, where a body of heat would be, and the
					// top of the sprite is the head rather than the hot part.
					const dy = (py - height * 0.62) / (height * 0.62);
					const radial = Math.sqrt(dx * dx + dy * dy);
					const core = Math.max(0, 1 - radial * 0.85);

					const warmBoost = 1 + warmMask * 0.95;
					data[index] = Math.min(255, red * warmBoost);
					data[index + 1] = Math.min(255, green * (1 + warmMask * 0.48));
					data[index + 2] = Math.min(255, blue * (1 - warmMask * 0.2));
					data[index + 3] = Math.min(255, alpha * warmMask * 255 * (0.5 + core * 1.1));
				}
				ctx.putImageData(imageData, 0, 0);
				state.hazeBmd.commit();
				state.hazeSprite.setTexture(state.hazeBmd.key);
				this._anchorInfernalOverlay(state.hazeSprite, sprite.x, sprite.y, dir, 1);
				state.hazeSprite.tint = 0xffffff;
				state.hazeReady = true;
			} catch (e) {
				console.warn('[Infernal] Failed to retry haze BitmapData:', e);
			}
		}

		if (!state.heatReady && state.heatLayerSprite) {
			try {
				state.heatFrame = frame;
				state.heatSource = source;
				state.heatBmd?.destroy();
				state.heatBmd = createBitmapDataFromTexture(this.game, {
					frame,
					source,
					width: frame.width,
					height: frame.height,
				});
				const { ctx } = state.heatBmd;
				const { width, height } = frame;
				const imageData = ctx.getImageData(0, 0, width, height);
				const data = imageData.data;
				const leftFadeWidth = dir < 0 ? 10 : 45;
				const rightFadeWidth = dir < 0 ? 45 : 10;
				for (let py = 0; py < height; py += 1) {
					for (let px = 0; px < width; px += 1) {
						const index = (py * width + px) * 4;
						const alpha = data[index + 3] / 255;
						const leftFade = Math.min(1, (px + 1) / leftFadeWidth);
						const rightFade = Math.min(1, (width - px) / rightFadeWidth);
						const fade = Math.min(leftFade, rightFade);
						data[index + 3] = Math.min(255, alpha * fade * 255);
					}
				}
				ctx.putImageData(imageData, 0, 0);
				state.heatBmd.commit();
				state.heatReady = true;
				state.heatLayerSprite.setTexture(state.heatBmd.key);
				this._anchorInfernalOverlay(
					state.heatLayerSprite,
					sprite.x,
					sprite.y,
					dir,
					INFERNAL_HEAT_LAYER_SCALE_Y,
				);
				state.heatLayerSprite.tint = 0xffffff;
				state.heatLayerSprite.alpha = state.synced ? 0.18 : 0;
			} catch (e) {
				console.warn('[Infernal] Failed to retry heat BitmapData:', e);
			}
		}
	}

	private _creatureKey(creature: Creature): string {
		return `${creature.team}:${creature.id}`;
	}

	private _yoyo(
		obj: object,
		props: Record<string, number>,
		duration: number,
		ease: (k: number) => number,
		maxPhase = duration,
	) {
		return this.game.gameEngine
			.tween(obj)
			.to(props, duration, ease, true, Math.floor(Math.random() * maxPhase), -1, true);
	}

	private _hexKey(hexagon: Hex): string {
		return `${hexagon.x},${hexagon.y}`;
	}

	private _uniqueHexes(hexes: Hex[]): Hex[] {
		const seen = new Set<string>();
		return hexes.filter((hexagon) => {
			const key = this._hexKey(hexagon);
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	}

	private _footprintAt(hex: Hex, creatureSize: number): Hex[] {
		const footprint: Hex[] = [];
		for (let i = 0; i < creatureSize; i++) {
			const segment = this.game.grid.hexes[hex.y]?.[hex.x - i];
			if (segment) {
				footprint.push(segment);
			}
		}
		return footprint;
	}

	private _collectVisibleMovementAreaHexes(): Hex[] {
		const movementHexes: Hex[] = [];
		for (const row of this.game.grid.hexes) {
			for (const hexagon of row) {
				const isMovementHex =
					hexagon.reachable ||
					/\b(adj|dashed|abilityRange)\b/.test(hexagon.displayClasses) ||
					/\b(reachable|dashed)\b/.test(hexagon.overlayClasses);
				if (isMovementHex) {
					movementHexes.push(hexagon);
				}
			}
		}
		return this._uniqueHexes(movementHexes);
	}

	private _shouldAffectOverlayAlpha(hexagon: Hex): boolean {
		const overlayKey = hexagon.overlay?.key;
		const isPlayerOverlayKey = typeof overlayKey === 'string' && /^hex_p[0-3]$/.test(overlayKey);
		const isMovementOverlayKey =
			typeof overlayKey === 'string' &&
			(overlayKey === 'hex_path' || /^hex_dashed_p[0-3]$/.test(overlayKey));
		return (
			Boolean(hexagon.overlayClasses.match(/\bcreature\b/)) ||
			Boolean(hexagon.overlayClasses.match(/\breachable\b|\bdashed\b/)) ||
			isPlayerOverlayKey ||
			isMovementOverlayKey
		);
	}

	/**
	 * Atomically completes movement and fades in destination movement-area hexes with
	 * no gap in input locking. The secondary lockId is pushed to animationQueue BEFORE
	 * movementComplete removes animId, so freezedInput never momentarily drops to false.
	 * Movement hexes are collected AFTER movementComplete so we capture the correct
	 * hexes at the destination (established by the ability callback).
	 */
	private _completeThenFadeInMovementArea(
		creature: Creature,
		hex: Hex,
		animId: number,
		opts: AnimationOptions,
		duration = 420,
	): void {
		const game = this.game;

		// Lock BEFORE movementComplete so there is never a gap where freezedInput is false.
		const lockId = ++this.animationCounter;
		game.animationQueue.push(lockId);

		// Complete movement; ability callback runs here, establishing movement hexes at B.
		this.movementComplete(creature, hex, animId, opts);

		const excludeKeySet = new Set(creature.hexagons.map((hexagon) => this._hexKey(hexagon)));
		const movementAreaHexes = this._collectVisibleMovementAreaHexes().filter(
			(hexagon) => !excludeKeySet.has(this._hexKey(hexagon)),
		);

		const release = () => {
			game.animationQueue = game.animationQueue.filter((item) => item !== lockId);
			if (game.animationQueue.length === 0) {
				game.freezedInput = false;
				if (game.multiplayer) {
					game.freezedInput = game.UI.active ? false : true;
				}
				game.grid?.refreshHoverState();
			}
		};

		if (movementAreaHexes.length === 0) {
			release();
			return;
		}

		this._setHexVisualAlpha(movementAreaHexes, 0);
		this._tweenHexVisualAlpha(movementAreaHexes, 1, duration, true)
			.catch(() => undefined)
			.then(() => release());
	}

	private _createMovementHexTransition(creature: Creature, destinationHex: Hex) {
		const originHexes = this._uniqueHexes([...creature.hexagons]);
		const destinationHexes = this._uniqueHexes(this._footprintAt(destinationHex, creature.size));
		const destinationKeySet = new Set(destinationHexes.map((hexagon) => this._hexKey(hexagon)));
		const originOnlyHexes = originHexes.filter(
			(hexagon) => !destinationKeySet.has(this._hexKey(hexagon)),
		);
		return {
			originHexes,
			destinationHexes,
			originOnlyHexes,
		};
	}

	private _setHexForcedHidden(hexes: Hex[], hidden: boolean) {
		hexes.forEach((hexagon) => {
			hexagon.forcedHidden = hidden;
			if (hexagon.display?.active) {
				hexagon.display.visible = !hidden;
			}
			if (hexagon.overlay?.active) {
				hexagon.overlay.visible = !hidden;
			}
			if (hidden) {
				hexagon.displayVisualState('teleportHidden');
			} else {
				hexagon.cleanDisplayVisualState('teleportHidden');
			}
		});
	}

	private _setHexVisualAlpha(hexes: Hex[], alpha: number, clearOverride = false) {
		hexes.forEach((hexagon) => {
			hexagon.forcedDisplayAlpha = clearOverride ? undefined : alpha;
			hexagon.forcedCreatureOverlayAlpha = clearOverride ? undefined : alpha;
			if (hexagon.display?.active) {
				hexagon.display.alpha = alpha;
			}
			if (hexagon.overlay?.active) {
				const shouldAffectOverlay = this._shouldAffectOverlayAlpha(hexagon);
				if (shouldAffectOverlay) {
					hexagon.overlay.alpha = alpha;
				}
			}
		});
	}

	private _tweenHexVisualAlpha(
		hexes: Hex[],
		alpha: number,
		duration: number,
		clearOverrideOnComplete = false,
	): Promise<void[]> {
		return Promise.all(
			hexes.map((hexagon) => {
				const hasDisplay = Boolean(hexagon.display?.active);
				const hasOverlay = Boolean(hexagon.overlay?.active);
				if (!hasDisplay && !hasOverlay) {
					return Promise.resolve();
				}

				const tweenState = {
					alpha:
						typeof hexagon.forcedDisplayAlpha === 'number'
							? hexagon.forcedDisplayAlpha
							: hasDisplay
							? hexagon.display.alpha
							: hasOverlay
							? hexagon.overlay.alpha
							: alpha,
				};
				hexagon.forcedDisplayAlpha = tweenState.alpha;
				hexagon.forcedCreatureOverlayAlpha = tweenState.alpha;

				const alphaTween = this.game.gameEngine
					.tween(tweenState)
					.to({ alpha }, duration, 'Quadratic.InOut', true);
				alphaTween.onUpdateCallback(() => {
					hexagon.forcedDisplayAlpha = tweenState.alpha;
					hexagon.forcedCreatureOverlayAlpha = tweenState.alpha;
					if (hasDisplay) {
						hexagon.display.alpha = tweenState.alpha;
					}
					if (hasOverlay) {
						const shouldAffectOverlay = this._shouldAffectOverlayAlpha(hexagon);
						if (shouldAffectOverlay) {
							hexagon.overlay.alpha = tweenState.alpha;
						}
					}
				});

				return new Promise<void>((resolve) => {
					alphaTween.onComplete.addOnce(() => {
						hexagon.forcedDisplayAlpha = clearOverrideOnComplete ? undefined : alpha;
						hexagon.forcedCreatureOverlayAlpha = clearOverrideOnComplete ? undefined : alpha;
						resolve();
					});
				});
			}),
		);
	}

	private _scheduleHexVisualCleanup(
		hexes: Hex[],
		options: {
			minDelayMs?: number;
			requiredStableChecks?: number;
			maxAttempts?: number;
			intervalMs?: number;
			blockOnReachable?: boolean;
		} = {},
	) {
		const uniqueHexes = this._uniqueHexes(hexes);
		let attemptsLeft = options.maxAttempts ?? 18;
		let stableChecks = 0;
		const requiredStableChecks = options.requiredStableChecks ?? 3;
		const intervalMs = options.intervalMs ?? 50;
		const blockOnReachable = options.blockOnReachable ?? false;
		const tryClear = () => {
			const pending = uniqueHexes.filter((hexagon) => {
				const hasCreatureClass =
					/\bcreature\b/.test(hexagon.displayClasses) ||
					/\bcreature\b/.test(hexagon.overlayClasses);
				if (hasCreatureClass || (blockOnReachable && hexagon.reachable)) {
					return true;
				}
				hexagon.forcedDisplayAlpha = undefined;
				hexagon.forcedCreatureOverlayAlpha = undefined;
				hexagon.forcedHidden = false;
				if (hexagon.display?.active) {
					hexagon.display.visible = true;
				}
				if (hexagon.overlay?.active) {
					hexagon.overlay.visible = true;
				}
				hexagon.cleanDisplayVisualState('teleportHidden');
				return false;
			});

			attemptsLeft--;
			if (pending.length > 0) {
				stableChecks = 0;
			} else {
				stableChecks++;
				if (stableChecks >= requiredStableChecks) {
					return;
				}
			}

			if (attemptsLeft > 0) {
				after(intervalMs, tryClear);
			}
		};

		after(options.minDelayMs ?? 0, tryClear);
	}

	private _scheduleHexVisualCleanupOnNextInput(hexes: Hex[], timeoutMs = 2500) {
		// Deprecated path; keep signature for compatibility if reused later.
		this._scheduleHexVisualCleanup(hexes, {
			minDelayMs: timeoutMs,
			requiredStableChecks: 4,
			maxAttempts: 20,
		});
	}

	private _applyCreatureHexVisuals(hexes: Hex[], team: number) {
		hexes.forEach((hexagon) => {
			hexagon.displayVisualState(`creature player${team}`);
			hexagon.overlayVisualState(`creature player${team}`);
		});
	}

	startBonfireSpringTrapAnimation(
		display: SpriteHandle,
		trapGroup: GroupHandle,
		idleTweens: TweenHandle[],
		overlaySprites: SpriteHandle[],
	) {
		const base = display;

		// `setOrigin` rather than assigning `originY`: Phaser 4 derives
		// `displayOriginY` from it, and the placement below is measured against
		// that. Writing the property would leave the display origin stale.
		if (base.originY !== 1) {
			base.setOrigin(base.originX, 1);
			base.y += base.height / 2 + BONFIRE_BASELINE_Y_COMPENSATION_PX;
		}
		base.scale.y = 0.62;
		base.alpha = 0.76;
		const bx = base.x;
		const by = base.y;

		const rand = (n: number) => Math.random() * n;
		const randInt = (n: number) => Math.floor(rand(n));

		const baseGlow = this.game.gameEngine.add.sprite(
			bx,
			by,
			'trap_bonfire-spring',
			undefined,
			trapGroup,
		);
		baseGlow.setOrigin(0.5, 1);
		baseGlow.alpha = 0.4;
		baseGlow.setScale(1.08, 0.72);
		idleTweens.push(
			this._yoyo(baseGlow.scale, { x: 1.14, y: 0.8 }, 180 + randInt(120), Easing.Quadratic.InOut),
			this._yoyo(baseGlow, { alpha: 0.34 }, 180 + randInt(120), Easing.Linear.None),
		);
		overlaySprites.push(baseGlow);

		const core = this.game.gameEngine.add.sprite(
			bx,
			by - 6,
			'trap_bonfire-spring',
			undefined,
			trapGroup,
		);
		core.setOrigin(0.5, 1);
		core.alpha = 0.58;
		core.setScale(0.76, 0.98);
		idleTweens.push(
			this._yoyo(core.scale, { x: 0.81, y: 1.1 }, 220 + randInt(120), Easing.Quadratic.InOut),
			this._yoyo(core, { alpha: 0.5 }, 220 + randInt(120), Easing.Linear.None),
		);
		overlaySprites.push(core);

		const bridge = this.game.gameEngine.add.sprite(
			bx,
			by - 10,
			'trap_bonfire-spring',
			undefined,
			trapGroup,
		);
		bridge.setOrigin(0.5, 1);
		bridge.alpha = 0.34;
		bridge.setScale(0.56, 1.14);
		const bridgeDrift = 0.8 + rand(0.8);
		bridge.x = bx - bridgeDrift;
		idleTweens.push(
			this._yoyo(bridge.scale, { x: 0.58, y: 1.2 }, 230 + randInt(120), Easing.Quadratic.InOut),
			this._yoyo(bridge, { alpha: 0.32 }, 230 + randInt(120), Easing.Linear.None),
			this._yoyo(bridge, { x: bx + bridgeDrift }, 240 + randInt(120), Easing.Sinusoidal.InOut),
		);
		overlaySprites.push(bridge);

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

		const depthRows: Array<{
			dy: number;
			dxScale: number;
			scaleMul: number;
			alphaMul: number;
		}> = [
			{ dy: -10, dxScale: 0.74, scaleMul: 0.82, alphaMul: 0.62 },
			{ dy: -4, dxScale: 0.98, scaleMul: 1.02, alphaMul: 0.92 },
		];

		for (const c of clusters) {
			const emberX = bx + c.dx * 0.94;
			const emberSkirt = this.game.gameEngine.add.sprite(
				emberX,
				by + 1,
				'trap_bonfire-spring',
				undefined,
				trapGroup,
			);
			emberSkirt.setOrigin(0.5, 1);
			emberSkirt.alpha = 0.32;
			emberSkirt.setScale(1.02, 0.44 + c.bodyScaleY * 0.08);
			idleTweens.push(
				this._yoyo(
					emberSkirt.scale,
					{ x: emberSkirt.scaleX * 1.12, y: emberSkirt.scaleY * 1.08 },
					260 + randInt(110),
					Easing.Quadratic.InOut,
				),
				this._yoyo(emberSkirt, { alpha: 0.26 }, 220 + randInt(100), Easing.Linear.None),
			);
			overlaySprites.push(emberSkirt);
		}

		for (const row of depthRows) {
			for (const c of clusters) {
				const cx = bx + c.dx * row.dxScale;
				const isFloorRow = row.dy >= -5;

				const depthBody = this.game.gameEngine.add.sprite(
					cx,
					by + row.dy,
					'trap_bonfire-spring',
					undefined,
					trapGroup,
				);
				depthBody.setOrigin(0.5, 1);
				depthBody.alpha = 0.62 * row.alphaMul;
				depthBody.setScale((isFloorRow ? 0.86 : 0.72) * row.scaleMul, c.bodyScaleY * row.scaleMul);
				const depthSway = 0.012 + rand(0.012);
				depthBody.rotation = -depthSway;
				idleTweens.push(
					this._yoyo(
						depthBody.scale,
						{ y: c.bodyScaleY * row.scaleMul * 1.2 },
						340 + randInt(110),
						Easing.Quadratic.InOut,
					),
					this._yoyo(
						depthBody,
						{ alpha: depthBody.alpha * 0.74 },
						300 + randInt(100),
						Easing.Linear.None,
					),
					this._yoyo(
						depthBody,
						{ rotation: depthSway },
						760 + randInt(280),
						Easing.Sinusoidal.InOut,
					),
				);
				overlaySprites.push(depthBody);

				const depthTongue = this.game.gameEngine.add.sprite(
					cx,
					by + row.dy - 4,
					'trap_bonfire-spring',
					undefined,
					trapGroup,
				);
				depthTongue.setOrigin(0.5, 1);
				depthTongue.alpha = 0.34 * row.alphaMul;
				depthTongue.setScale(c.tongueScaleX * 0.66 * row.scaleMul, c.tongueScaleY * row.scaleMul);
				const depthTongueDrift = 0.012 + rand(0.012);
				depthTongue.rotation = -depthTongueDrift;
				idleTweens.push(
					this._yoyo(
						depthTongue.scale,
						{
							y: c.tongueScaleY * row.scaleMul * 1.26,
							x: c.tongueScaleX * 0.58 * row.scaleMul,
						},
						260 + randInt(100),
						Easing.Quadratic.InOut,
					),
					this._yoyo(
						depthTongue,
						{ alpha: depthTongue.alpha * 0.76 },
						220 + randInt(100),
						Easing.Linear.None,
					),
					this._yoyo(
						depthTongue,
						{ rotation: depthTongueDrift },
						680 + randInt(260),
						Easing.Sinusoidal.InOut,
					),
				);
				overlaySprites.push(depthTongue);
			}
		}

		for (const c of clusters) {
			const cx = bx + c.dx;
			const body = this.game.gameEngine.add.sprite(
				cx,
				by - 4,
				'trap_bonfire-spring',
				undefined,
				trapGroup,
			);
			body.setOrigin(0.5, 1);
			body.alpha = 0.72;
			body.setScale(0.78, c.bodyScaleY);
			const bodySway = 0.02 + rand(0.02);
			body.rotation = -bodySway;
			idleTweens.push(
				this._yoyo(
					body.scale,
					{ y: c.bodyScaleY * 1.18 },
					380 + randInt(120),
					Easing.Quadratic.InOut,
				),
				this._yoyo(body, { alpha: 0.52 }, 320 + randInt(100), Easing.Linear.None),
				this._yoyo(body, { rotation: bodySway }, 850 + randInt(300), Easing.Sinusoidal.InOut),
			);
			overlaySprites.push(body);

			const tongue = this.game.gameEngine.add.sprite(
				cx,
				by - 8,
				'trap_bonfire-spring',
				undefined,
				trapGroup,
			);
			tongue.setOrigin(0.5, 1);
			tongue.alpha = 0.36;
			tongue.setScale(c.tongueScaleX, c.tongueScaleY);
			const tongueDrift = 0.015 + rand(0.015);
			tongue.rotation = -tongueDrift;
			idleTweens.push(
				this._yoyo(
					tongue.scale,
					{ y: c.tongueScaleY * 1.32, x: c.tongueScaleX * 0.8 },
					240 + randInt(120),
					Easing.Quadratic.InOut,
				),
				this._yoyo(tongue, { alpha: 0.31 }, 220 + randInt(120), Easing.Linear.None),
				this._yoyo(tongue, { rotation: tongueDrift }, 760 + randInt(340), Easing.Sinusoidal.InOut),
			);
			overlaySprites.push(tongue);

			const tip = this.game.gameEngine.add.sprite(
				cx,
				by - 10,
				'trap_bonfire-spring',
				undefined,
				trapGroup,
			);
			tip.setOrigin(0.5, 1);
			tip.alpha = 0.48;
			tip.setScale(c.tongueScaleX * 0.55, c.tongueScaleY * 0.95);
			const tipSway = 0.09 + rand(0.04);
			const tipDriftX = 0.8 + rand(1.0);
			tip.x = cx - tipDriftX;
			tip.rotation = -tipSway;
			idleTweens.push(
				this._yoyo(
					tip.scale,
					{ y: c.tongueScaleY * 1.2, x: c.tongueScaleX * 0.46 },
					210 + randInt(120),
					Easing.Quadratic.InOut,
				),
				this._yoyo(tip, { alpha: 0.38 }, 180 + randInt(100), Easing.Linear.None),
				this._yoyo(tip, { rotation: tipSway }, 300 + randInt(140), Easing.Sinusoidal.InOut),
				this._yoyo(tip, { x: cx + tipDriftX }, 280 + randInt(140), Easing.Sinusoidal.InOut),
			);
			overlaySprites.push(tip);
		}
	}

	startScorchedGroundTrapAnimation(
		display: SpriteHandle,
		trapGroup: GroupHandle,
		idleTweens: TweenHandle[],
		overlaySprites: SpriteHandle[],
	) {
		display.alpha = 1;
		const bx = display.x;
		const by = display.y;
		const randInt = (n: number) => Math.floor(Math.random() * n);

		const innerGlow = this.game.gameEngine.add.sprite(
			bx,
			by,
			'trap_scorched-ground',
			undefined,
			trapGroup,
		);
		innerGlow.setOrigin(0.5, 0.5);
		innerGlow.alpha = 0.3;
		innerGlow.tint = 0xffa347;
		innerGlow.setScale(1.07, 1.06);
		innerGlow.blendMode = BLEND_MODE_ADD;
		idleTweens.push(
			this._yoyo(innerGlow, { alpha: 0.43 }, 480 + randInt(200), Easing.Linear.None),
			this._yoyo(innerGlow.scale, { x: 1.2, y: 1.17 }, 520 + randInt(210), Easing.Quadratic.InOut),
		);
		overlaySprites.push(innerGlow);

		const outerAura = this.game.gameEngine.add.sprite(
			bx,
			by,
			'trap_scorched-ground',
			undefined,
			trapGroup,
		);
		outerAura.setOrigin(0.5, 0.5);
		outerAura.alpha = 0.19;
		outerAura.tint = 0xff7a1f;
		outerAura.setScale(1.24, 1.22);
		outerAura.blendMode = BLEND_MODE_ADD;
		idleTweens.push(
			this._yoyo(outerAura, { alpha: 0.3 }, 700 + randInt(260), Easing.Linear.None),
			this._yoyo(
				outerAura.scale,
				{ x: 1.46, y: 1.38 },
				780 + randInt(280),
				Easing.Sinusoidal.InOut,
			),
		);
		overlaySprites.push(outerAura);
	}

	walk(creature: Creature, path: Hex[], opts: AnimationOptions) {
		const game = this.game;

		if (opts.customMovementPoint > 0) {
			path = path.slice(0, opts.customMovementPoint);
			// For compatibility
			this.movementPoints = creature.remainingMove;
			creature.remainingMove = opts.customMovementPoint;
		}

		game.freezedInput = true;

		const animId = ++this.animationCounter;
		game.animationQueue.push(animId);

		let hexId = 0;

		creature.healthHide();

		let speed = !opts.overrideSpeed ? creature.animation.walk_speed : opts.overrideSpeed;
		speed = Number(speed);

		if (DEBUG_ENABLE_FAST_WALKING) {
			speed = DEBUG_WALK_SPEED_MS;
		}

		// Afterimage units walk a fifth faster than their cardboard's
		// own pace, matching the flight boost in fly().
		if (creature.hasAfterimages && !opts.overrideSpeed) {
			speed /= 1 + AFTERIMAGE_SPEED_BOOST;
		}

		// The afterimage trail samples the unit's live position across
		// the whole walk — the unit's own afterimages, or a move an
		// ability granted them (a dash, a drag, a knockback). Skipped
		// in a backgrounded tab, matching the walk itself, which
		// collapses to instant there.
		if ((creature.hasAfterimages || opts.afterimages) && !isDocumentHidden()) {
			spawnAfterimageTrail(game, creature, speed * path.length);
		}

		const anim = () => {
			const hex = path[hexId];

			if (hexId < path.length && (creature.remainingMove > 0 || opts.ignoreMovementPoint)) {
				this.leaveHex(creature, hex, opts);
			} else {
				this.movementComplete(creature, path[path.length - 1], animId, opts);
				return;
			}

			const nextPos = game.grid.hexes[hex.y][hex.x - creature.size + 1];

			// Ignore traps for hover creatures, unless this is the last hex
			const enterHexOpts = {
				ignoreTraps: creature.movementType() !== 'normal' && hexId < path.length - 1,
				...opts,
			};

			// Re-checked every step (not just once up front) so a tab that gets
			// backgrounded mid-walk also collapses its remaining steps instead of
			// crawling along at Phaser's throttled background tick rate.
			const stepSpeed = isDocumentHidden() ? 0 : speed;
			creature.creatureSprite.setHex(nextPos, stepSpeed).then(() => {
				if (creature.dead) {
					// Stop moving if creature has died while moving
					this.movementComplete(creature, hex, animId, opts);
					return;
				}

				// Sound Effect
				game.soundsys.playSFX('sounds/step');

				if (!opts.ignoreMovementPoint) {
					creature.remainingMove--;

					if (opts.customMovementPoint === 0) {
						creature.travelDist++;
					}
				}

				this.enterHex(creature, hex, enterHexOpts);

				anim(); // Next tween
			});

			hexId++;
		};

		anim();
	}

	fly(creature: Creature, path: Hex[], opts: AnimationOptions) {
		const game = this.game;

		if (opts.customMovementPoint > 0) {
			path = path.slice(0, opts.customMovementPoint);
			// For compatibility
			this.movementPoints = creature.remainingMove;
			creature.remainingMove = opts.customMovementPoint;
		}

		game.freezedInput = true;

		const animId = Math.random();
		game.animationQueue.push(animId);

		creature.healthHide();

		const hex = path[0];

		const start = game.grid.hexes[creature.y][creature.x - creature.size + 1];
		const currentHex = game.grid.hexes[hex.y][hex.x - creature.size + 1];

		// Determine distance; guard against same-hex edge case to prevent an infinite loop.
		let distance = 0;
		let k = 0;
		const maxBoardDistance = 30;
		while (!distance && k < maxBoardDistance) {
			k++;

			if (arrayUtils.findPos(start.adjacentHex(k), currentHex)) {
				distance = k;
			}
		}

		this.leaveHex(creature, currentHex, opts);

		// A flight covers its whole path in a single tween, so a flat `walk_speed`
		// duration made a full-movement flight read as a teleport. Scale the tween
		// with the distance covered instead: half the per-hex pace of walking, so a
		// rested unit that banks movement visibly crosses the map without crawling.
		// An afterimage unit flies a fifth faster still — its trail is the point
		// of the effect — so its per-hex pace share drops by the boost.
		// `Math.max(distance, 1)` keeps a single-hex (or same-hex) move animating.
		const isFlier = creature.movementType() === 'flying';
		const flightSpeedFactor = creature.hasAfterimages
			? FLIGHT_SPEED_FACTOR / (1 + AFTERIMAGE_SPEED_BOOST)
			: FLIGHT_SPEED_FACTOR;

		const durationMS = !opts.overrideSpeed
			? creature.animation.walk_speed * flightSpeedFactor * Math.max(distance, 1)
			: opts.overrideSpeed;

		// The afterimage trail samples the unit's live position across
		// the crossing — the unit's own afterimages, or a move an
		// ability granted them (a dash, a drag, a knockback).
		// Skipped in a backgrounded tab, matching the flight
		// tween itself, which collapses to instant there.
		if ((creature.hasAfterimages || opts.afterimages) && !isDocumentHidden()) {
			spawnAfterimageTrail(game, creature, durationMS);
		}

		// A true flier (Scavenger) loops its wingbeat for the whole crossing instead
		// of a step per hex, since the flight is one uninterrupted tween with no
		// footfalls to hear. The landing is still marked by the usual step.
		const flightSound = isFlier ? game.soundsys.playSFXLoop('sounds/flight') : undefined;

		creature.creatureSprite.setHex(currentHex, isDocumentHidden() ? 0 : durationMS).then(() => {
			game.soundsys.stopSFX(flightSound);

			// Sound Effect
			game.soundsys.playSFX('sounds/step');

			if (!opts.ignoreMovementPoint) {
				creature.remainingMove -= distance;
				if (opts.customMovementPoint === 0) {
					creature.travelDist += distance;
				}
			}

			this.enterHex(creature, hex, opts);
			this.movementComplete(creature, hex, animId, opts);
			return;
		});
	}

	teleport(creature: Creature, path: Hex[], opts: AnimationOptions) {
		const game = this.game,
			hex = path[0],
			currentHex = game.grid.hexes[hex.y][hex.x - creature.size + 1];

		this.leaveHex(creature, currentHex, opts);

		const animId = Math.random();
		game.animationQueue.push(animId);

		if (opts.teleportEffect === 'abolishedBonfire') {
			const gameEngine = game.gameEngine;
			const transition = this._createMovementHexTransition(creature, hex);
			const originHexes = transition.originHexes;
			this._setHexForcedHidden(transition.originOnlyHexes, true);
			const getTallScaleMultiplier = (baselineHeight: number) => {
				const cardboardHeight = Math.max(70, Math.abs(creature.creatureSprite.sprite.height));
				return Math.max(4.2, (cardboardHeight / Math.max(1, baselineHeight)) * 3.2);
			};

			const liftBonfireCurtainFromTraps = (originTraps: Trap[]) => {
				const previousTypeOver = new Map<number, boolean>();
				let layerChanged = false;

				originTraps.forEach((trap) => {
					previousTypeOver.set(trap.id, Boolean(trap.typeOver));
					trap.pauseIdleAnimation();
					const activeOccupiesTrapHex = creature.hexagons.some(
						(hexagon) => hexagon.x === trap.x && hexagon.y === trap.y,
					);
					if (activeOccupiesTrapHex) {
						if (!trap.typeOver) {
							layerChanged = true;
						}
						trap.setTypeOver(true, false);
					}
				});
				if (layerChanged) {
					game.grid.orderCreatureZ();
				}

				const curtainSprites = originTraps.flatMap((trap) =>
					trap
						.getVisualSprites()
						.filter((sprite) => sprite.active)
						.map((sprite) => ({ trap, sprite })),
				);

				curtainSprites.forEach(({ sprite }) => {
					// See the note in `reanchorBasiliskBase`: the display origin has
					// to be refreshed too, so this goes through `setOrigin`.
					if (sprite.originY !== 1) {
						sprite.setOrigin(sprite.originX, 1);
						sprite.y += sprite.height / 2;
					}
				});

				const baseScales = curtainSprites.map(({ sprite }) => ({
					x: sprite.scaleX,
					y: sprite.scaleY,
				}));
				const baselineHeight = Math.max(
					1,
					...curtainSprites.map(({ sprite }) => Math.max(1, Math.abs(sprite.height))),
				);

				const tweenSprites = (
					target: 'tower' | 'idle',
					duration: number,
					ease: (k: number) => number,
				) => {
					const towerRatio = getTallScaleMultiplier(baselineHeight);

					return Promise.all(
						curtainSprites.map(({ sprite }, index) => {
							const baseScale = baseScales[index];
							const targetScale =
								target === 'tower'
									? {
											x: baseScale.x * 1.08,
											y: baseScale.y * towerRatio,
									  }
									: {
											x: baseScale.x,
											y: baseScale.y,
									  };

							const scaleTween = gameEngine
								.tween(sprite.scale)
								.to(targetScale, duration, ease, true);
							return new Promise<void>((resolve) => {
								scaleTween.onComplete.addOnce(() => resolve());
							});
						}),
					);
				};

				const restore = () => {
					let restoreLayerChanged = false;
					originTraps.forEach((trap) => {
						const shouldStayOver = previousTypeOver.get(trap.id) ?? false;
						if (trap.typeOver !== shouldStayOver) {
							restoreLayerChanged = true;
						}
						trap.setTypeOver(shouldStayOver, false);
						trap.resumeIdleAnimation();
					});
					if (restoreLayerChanged) {
						game.grid.orderCreatureZ();
					}
				};

				return { tweenSprites, restore };
			};

			const originTraps = game.traps.filter((trap) => {
				if (trap.type !== 'bonfire-spring' || trap.ownerCreature !== creature) {
					return false;
				}
				return creature.hexagons.some((hexagon) => hexagon.x === trap.x && hexagon.y === trap.y);
			});
			const originMovementAreaHexes = this._collectVisibleMovementAreaHexes();
			const originHexKeySet = new Set(originHexes.map((hexagon) => this._hexKey(hexagon)));
			const originOutlineHexes = originMovementAreaHexes.filter(
				(hexagon) => !originHexKeySet.has(this._hexKey(hexagon)),
			);
			const teleportCleanupOptions = {
				minDelayMs: 180,
				requiredStableChecks: 2,
				maxAttempts: 16,
				intervalMs: 40,
			};
			const fadePhaseAOriginHexes = () =>
				Promise.resolve()
					.then(() =>
						originOutlineHexes.length > 0
							? this._tweenHexVisualAlpha(originOutlineHexes, 0, 150)
							: Promise.resolve([]),
					)
					.then(() =>
						originHexes.length > 0
							? this._tweenHexVisualAlpha(originHexes, 0, 150)
							: Promise.resolve([]),
					);
			let fallbackOriginOnlyHexes: Hex[] = [];

			if (originTraps.length === 0) {
				this.xraySuppressed = true;
				game.grid.clearAllXray(true);
				fadePhaseAOriginHexes()
					.then(() => creature.creatureSprite.setAlpha(0, 500))
					.then((creatureSprite) => {
						game.soundsys.playSFX('sounds/step');
						creatureSprite.setHex(currentHex);
						this.enterHex(creature, hex, opts);
						const destinationHexes = [...creature.hexagons];
						const destinationHexKeySet = new Set(
							destinationHexes.map((hexagon) => this._hexKey(hexagon)),
						);
						fallbackOriginOnlyHexes = originHexes.filter(
							(hexagon) => !destinationHexKeySet.has(this._hexKey(hexagon)),
						);
						this._setHexForcedHidden(fallbackOriginOnlyHexes, true);
						const destinationFadeInHexes = destinationHexes;
						this._applyCreatureHexVisuals(destinationHexes, creature.team);
						this._setHexVisualAlpha(destinationFadeInHexes, 0);
						return Promise.all([
							creatureSprite.setAlpha(1, 500),
							this._tweenHexVisualAlpha(destinationFadeInHexes, 1, 620, true),
						]).then(() => creatureSprite);
					})
					.then(() => {
						this.xraySuppressed = false;
						this._completeThenFadeInMovementArea(creature, hex, animId, opts);
						this._scheduleHexVisualCleanup(fallbackOriginOnlyHexes, teleportCleanupOptions);
						this._scheduleHexVisualCleanup(originMovementAreaHexes, teleportCleanupOptions);
					})
					.catch(() => {
						this.xraySuppressed = false;
					});
				return;
			}
			const originCurtains = liftBonfireCurtainFromTraps(originTraps);
			let didRestoreOriginLayer = false;
			const restoreOriginLayer = () => {
				if (didRestoreOriginLayer) {
					return;
				}
				didRestoreOriginLayer = true;
				originCurtains.restore();
			};

			this.xraySuppressed = true;
			game.grid.clearAllXray(true);
			Promise.resolve()
				.then(() => fadePhaseAOriginHexes())
				.then(() => originCurtains.tweenSprites('tower', 260, Easing.Cubic.Out))
				.then(() => originCurtains.tweenSprites('idle', 340, Easing.Quadratic.InOut))
				.then(() => {
					restoreOriginLayer();
					game.soundsys.playSFX('sounds/step');
					return creature.creatureSprite.setHex(currentHex);
				})
				.then(() => {
					this.enterHex(creature, hex, opts);
					const destinationHexes = [...creature.hexagons];
					const destinationHexKeySet = new Set(
						destinationHexes.map((hexagon) => this._hexKey(hexagon)),
					);
					const originOnlyHexes = originHexes.filter(
						(hexagon) => !destinationHexKeySet.has(this._hexKey(hexagon)),
					);
					this._setHexForcedHidden(originOnlyHexes, true);
					const destinationFadeInHexes = destinationHexes;
					this._applyCreatureHexVisuals(destinationHexes, creature.team);
					this._setHexVisualAlpha(destinationFadeInHexes, 0);
					const destinationTraps = opts.createTeleportDestinationTraps?.() ?? [];

					if (destinationTraps.length > 0) {
						const destinationCurtains = liftBonfireCurtainFromTraps(destinationTraps);
						return destinationCurtains
							.tweenSprites('tower', 300, Easing.Cubic.Out)
							.then(() =>
								Promise.all([
									creature.creatureSprite.setAlpha(1, 420),
									destinationCurtains.tweenSprites('idle', 420, Easing.Quadratic.InOut),
								]),
							)
							.then(() => {
								destinationCurtains.restore();
								return this._tweenHexVisualAlpha(destinationFadeInHexes, 1, 620, true);
							})
							.then(() => {
								this.xraySuppressed = false;
								this._completeThenFadeInMovementArea(creature, hex, animId, opts);
								this._scheduleHexVisualCleanup(originOnlyHexes, teleportCleanupOptions);
								this._scheduleHexVisualCleanup(originMovementAreaHexes, teleportCleanupOptions);
							});
					}

					return creature.creatureSprite
						.setAlpha(1, 420)
						.then(() => this._tweenHexVisualAlpha(destinationFadeInHexes, 1, 620, true))
						.then(() => {
							this.xraySuppressed = false;
							this._completeThenFadeInMovementArea(creature, hex, animId, opts);
							this._scheduleHexVisualCleanup(originOnlyHexes, teleportCleanupOptions);
							this._scheduleHexVisualCleanup(originMovementAreaHexes, teleportCleanupOptions);
						});
				})
				.catch(() => {
					this.xraySuppressed = false;

					this._setHexForcedHidden(originHexes, false);
					this._setHexForcedHidden(creature.hexagons, false);
					this._scheduleHexVisualCleanup([...originHexes, ...creature.hexagons]);
					this.movementComplete(creature, hex, animId, opts);
				});

			return;
		}

		creature.creatureSprite
			.setAlpha(0, 500)
			.then((creatureSprite) => {
				// Sound Effect
				game.soundsys.playSFX('sounds/step');

				// Position
				creatureSprite.setHex(currentHex);

				this.enterHex(creature, hex, opts);
				this.movementComplete(creature, hex, animId, opts);
				return creatureSprite;
			})
			.then((creatureSprite) => creatureSprite.setAlpha(1, 500));
	}

	push(creature: Creature, path: Hex[], opts: AnimationOptions) {
		opts.pushed = true;
		this.walk(creature, path, opts);
	}

	//--------Special Functions---------//

	enterHex(creature: Creature, hex: Hex, opts: AnimationOptions) {
		const game = this.game;

		creature.cleanHex();
		creature.x = hex.x - 0;
		creature.y = hex.y - 0;
		creature.pos = hex.pos;
		creature.updateHex();

		game.onStepIn(creature, hex, opts);

		creature.pickupDrop();

		if (opts.callbackStepIn) {
			opts.callbackStepIn(hex);
		}

		game.grid.orderCreatureZ();

		// Refresh xray so obstructors are correctly ghosted as the unit moves rows
		if (game.activeCreature === creature) {
			game.grid.refreshActiveCreatureXray();
		}
	}

	leaveHex(creature: Creature, hex: Hex, opts: AnimationOptions) {
		const game = this.game;

		if (!opts.ignoreFacing && !opts.pushed) {
			creature.faceHex(hex, creature.hexagons[0], false, false); // Determine facing
		}
		const stepOutHex = creature.hexagons[0];
		// @ts-expect-error 2554
		game.onStepOut(creature, stepOutHex); // Trigger

		// For walk/fly, clear logical occupancy right as movement starts so volumetric trap
		// visuals on the origin hex stop rendering above the moving creature immediately.
		// For teleport, preserve origin occupancy during the curtain/transition animation.
		if (opts.animation !== 'teleport') {
			creature.cleanHex();
		}
		game.grid.orderCreatureZ();
	}

	movementComplete(creature: Creature, hex: Hex, animId: number, opts: AnimationOptions) {
		const game = this.game;

		if (opts.customMovementPoint > 0) {
			creature.remainingMove = this.movementPoints;
		}

		// TODO: Turn around animation
		if (opts.turnAroundOnComplete) {
			creature.facePlayerDefault();
		}

		// TODO: Reveal health indicator
		creature.healthShow();

		creature.hexagons.forEach(() => {
			creature.pickupDrop();
		});

		game.grid.orderCreatureZ();

		const queue = game.animationQueue.filter((item) => item != animId);

		if (queue.length === 0) {
			game.freezedInput = false;
			if (game.multiplayer) {
				game.freezedInput = game.UI.active ? false : true;
			}
			game.grid?.refreshHoverState();
		}

		game.animationQueue = queue;
		opts.callback?.();
	}

	projectile(
		this2: Ability,
		target: { id: number },
		spriteId: string,
		path: Hex[],
		args: { direction: number },
		startX: number,
		startY: number,
	): [TweenHandle, SpriteHandle, number] {
		// Get the target's position on the projectile's path that is closest
		const emissionPointX = this2.creature.legacyProjectileEmissionPoint.x + startX;
		let distance = Number.MAX_SAFE_INTEGER;
		if (!path.length) {
			// Nothing to animate along. Without this, `path[0]` below throws.
			return;
		}
		let targetX = path[0].displayPos.x;
		for (const hex of path) {
			if (typeof hex.creature != 'undefined' && hex.creature.id == target.id) {
				if (distance > Math.abs(emissionPointX - hex.displayPos.x)) {
					distance = Math.abs(emissionPointX - hex.displayPos.x);
					targetX = hex.displayPos.x;
				}
			}
		}
		const game = this.game,
			baseDist = arrayUtils.filterCreature(path.slice(0), false, false).length,
			dist = baseDist == 0 ? 1 : baseDist,
			// `baseDist` counts creature-free hexes but indexes `path` directly.
			// When creatures and empty hexes interleave, the last creature-free
			// hex is not at index `baseDist - 1`, so `path[baseDist]` could be
			// undefined and the projectile target threw. Clamp instead.
			targetHexIdx = Math.min(baseDist, path.length - 1),
			emissionPoint = {
				x: this2.creature.legacyProjectileEmissionPoint.x + startX,
				y: this2.creature.legacyProjectileEmissionPoint.y + startY,
			},
			targetPoint = {
				x: targetX + 45,
				y: path[targetHexIdx].displayPos.y - 20,
			},
			// Sprite id here
			sprite = game.gameEngine.add.sprite(
				emissionPoint.x,
				emissionPoint.y,
				spriteId,
				undefined,
				game.grid.creatureGroup,
			),
			duration = dist * 75;

		sprite.setOrigin(0.5, 0.5);
		sprite.rotation = -Math.PI / 3 + (args.direction * Math.PI) / 3;
		const tween = game.gameEngine
			.tween(sprite)
			.to(
				{
					x: targetPoint.x,
					y: targetPoint.y,
				},
				duration,
				Easing.Linear.None,
			)
			.start();

		return [tween, sprite, dist];
	}

	death(creature: Creature, opts: AnimationOptions) {
		// Animation Properties
		const length = 100; // Distance travelled in x
		const numSegments = 10; // "Resolution" of the curve
		const speed = !opts.overrideSpeed ? 500 : opts.overrideSpeed;

		// Curve should pass (0, 0)
		const curve = opts.flipped ? new QuadraticCurve(0.1, 5, 0) : new QuadraticCurve(0.1, -5, 0);

		// Tween properties
		const segmentLength = (opts.flipped ? -1 : 1) * Math.round(length / numSegments);
		const segmentTime = Math.round(speed / numSegments);

		const startPos = creature.creatureSprite.getPos();

		creature.healthHide();

		let currSegment = 1;

		const anim = () => {
			if (currSegment > numSegments) {
				opts.callback();
				return;
			}

			// Calculate the point in the curve
			const next = {
				x: startPos.x + segmentLength * currSegment,
				y: startPos.y + curve.calc_y(segmentLength * currSegment),
			};

			// Tween to point
			creature.creatureSprite.setPx(next, segmentTime).then(() => {
				// Next tween
				anim();
			});

			currSegment++;
		};

		// Rotate and Fade the sprite
		creature.creatureSprite.setAngle(opts.flipped ? -90 : 90, 500);
		creature.creatureSprite.setAlpha(0, 500);

		// Launch the sprite
		anim();
	}

	melt(creature: Creature, opts: AnimationOptions) {
		const speed = !opts.overrideSpeed ? 650 : opts.overrideSpeed;
		const sprite = creature.sprite;
		const startScaleX = sprite.scaleX;
		const startScaleY = sprite.scaleY;

		creature.healthHide();
		creature.creatureSprite.setAngle(0, 0);

		// Squash and fade the sprite as it melts into the puddle
		this.game.gameEngine
			.tween(sprite.scale)
			.to(
				{
					x: startScaleX * 1.1,
					y: startScaleY * 0.2,
				},
				Math.round(speed * 0.7),
				Easing.Quadratic.In,
				true,
			)
			.start();

		creature.creatureSprite.setAlpha(0, speed).then(() => {
			opts.callback();
		});
	}

	rise(creature: Creature, opts: AnimationOptions) {
		const speed = !opts.overrideSpeed ? 650 : opts.overrideSpeed;
		const sprite = creature.sprite;
		const startScaleX = sprite.scaleX;
		const startScaleY = sprite.scaleY;

		creature.healthHide();
		creature.creatureSprite.setAngle(0, 0);

		// Start from squashed position
		sprite.scale.x = startScaleX * 1.1;
		sprite.scale.y = startScaleY * 0.2;
		creature.creatureSprite.setAlpha(0, 0);

		// Unsquash and fade back in as Gumble reshapes himself
		this.game.gameEngine
			.tween(sprite.scale)
			.to(
				{
					x: startScaleX,
					y: startScaleY,
				},
				Math.round(speed * 0.7),
				Easing.Quadratic.Out,
				true,
			)
			.start();

		creature.creatureSprite.setAlpha(1, speed).then(() => {
			creature.healthShow();
			opts.callback();
		});
	}

	shatterDown(creature: Creature, opts: AnimationOptions) {
		const speed = !opts.overrideSpeed ? 300 : opts.overrideSpeed;
		const game = this.game;
		const sprite = creature.sprite;
		const texture = sprite.texture as ShatterTexture;
		const texW = Math.round(texture.width || 1);
		const texH = Math.round(texture.height || 1);
		// frame.width/height must equal texW/texH so the flipped path
		// (frame.x + frame.width - sx - sw) stays positive; a zero width
		// produces a negative srcX, silently yielding empty shards.
		// Prefer cutWidth/cutHeight (the rect the renderer samples) over the
		// display width/height, which collapses trimmed frames to the visible
		// box instead of the full source region.
		const rawFrame = (texture.frame ??
			texture.crop ?? { x: 0, y: 0, width: texW, height: texH }) as {
			x?: number;
			y?: number;
			width?: number;
			height?: number;
			cutX?: number;
			cutY?: number;
			cutWidth?: number;
			cutHeight?: number;
			canvasData?: { x: number; y: number; width: number; height: number };
		};
		const frame = {
			x: rawFrame.cutX ?? rawFrame.canvasData?.x ?? rawFrame.x ?? 0,
			y: rawFrame.cutY ?? rawFrame.canvasData?.y ?? rawFrame.y ?? 0,
			width: rawFrame.cutWidth ?? rawFrame.canvasData?.width ?? rawFrame.width ?? texW,
			height: rawFrame.cutHeight ?? rawFrame.canvasData?.height ?? rawFrame.height ?? texH,
		};
		const isFlipped = sprite.scaleX < 0;

		// Validate the source image via CreatureSprite's resolver so that a
		// stale proxy (which could hand back an array or undefined) doesn't make
		// drawImage throw mid-loop and strand the creature invisible.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const source = (creature.creatureSprite as any)._resolveSpriteDrawSource(sprite);
		if (!source) {
			creature.creatureSprite.setAlpha(0, speed).then(() => {
				opts.callback?.();
			});
			return;
		}

		const shardFadeMs = Math.max(260, Math.round(speed * 1.2));

		const spriteLeft = creature.grp.x + sprite.x - sprite.width / 2;
		const spriteTop = creature.grp.y + sprite.y - sprite.height;

		const minShardW = 4;
		const maxShardW = 10;
		const minShardH = 6;
		const maxShardH = 15;
		const baseHeight = Math.max(12, Math.floor(texH * 0.22));
		const baseTopY = Math.max(minShardH, texH - baseHeight);
		const baseBottom = spriteTop + texH;
		const seamProfile = new Array<number>(texW);
		let seamX = 0;
		let previousSeamY = baseTopY;
		while (seamX < texW) {
			const bandWidth = Math.min(texW - seamX, 4 + Math.floor(Math.random() * 8));
			const nextSeamY = Math.max(
				minShardH,
				Math.min(texH - minShardH, previousSeamY + (-9 + Math.floor(Math.random() * 19))),
			);

			for (let fillX = seamX; fillX < seamX + bandWidth; fillX++) {
				seamProfile[fillX] = nextSeamY;
			}

			previousSeamY = nextSeamY;
			seamX += bandWidth;
		}

		let longestShardLifetime = 0;

		for (let sx = 0; sx < texW; ) {
			const seamY = seamProfile[Math.min(sx, texW - 1)];
			for (let sy = 0; sy < seamY; ) {
				if (Math.random() < 0.08) {
					sy += minShardH;
					continue;
				}

				const sw = Math.min(
					minShardW + Math.floor(Math.random() * (maxShardW - minShardW + 1)),
					texW - sx,
				);
				const localSeamY = seamProfile[Math.min(texW - 1, sx + Math.floor(sw / 2))];
				const sh = Math.min(
					minShardH + Math.floor(Math.random() * (maxShardH - minShardH + 1)),
					localSeamY - sy,
				);
				if (sw <= 0 || sh <= 0) {
					sy += minShardH;
					continue;
				}

				const bmd = createGameCanvasSurface(game, sw, sh);
				const srcX = isFlipped ? frame.x + frame.width - sx - sw : frame.x + sx;
				const srcY = frame.y + sy;
				bmd.ctx.clearRect(0, 0, sw, sh);
				bmd.ctx.drawImage(source, srcX, srcY, sw, sh, 0, 0, sw, sh);
				bmd.commit();

				const shardScreenX = isFlipped ? texW - sx - sw : sx;
				const x = spriteLeft + shardScreenX + sw / 2;
				const y = spriteTop + sy + sh / 2;
				const shard = game.gameEngine.add.sprite(x, y, bmd.key, undefined, game.grid.creatureGroup);
				shard.setOrigin(0.5, 0.5);
				shard.angle = -18 + Math.random() * 36;

				const driftX = -40 + Math.random() * 80;
				const landingMinY = Math.max(y + 10, spriteTop + localSeamY + sh / 2 - 2);
				const landingMaxY = Math.max(landingMinY, baseBottom - sh / 2);
				const targetY = landingMinY + Math.random() * Math.max(0, landingMaxY - landingMinY);
				const shardDuration = Math.round(shardFadeMs * (0.9 + Math.random() * 0.35));
				const shardFadeDuration = Math.max(90, Math.round(shardDuration * 0.22));
				longestShardLifetime = Math.max(longestShardLifetime, shardDuration + shardFadeDuration);
				const travelTween = game.gameEngine.tween(shard).to(
					{
						x: x + driftX,
						y: targetY,
						angle: shard.angle + (-90 + Math.random() * 180),
					},
					shardDuration,
					Easing.Cubic.In,
					true,
				);

				travelTween.onComplete.add(() => {
					game.gameEngine
						.tween(shard)
						.to(
							{
								alpha: 0,
							},
							shardFadeDuration,
							Easing.Linear.None,
							true,
						)
						.onComplete.add(() => {
							shard.destroy();
							bmd.destroy();
						});
				});

				sy += Math.max(minShardH - 1, sh - Math.floor(Math.random() * 3));
			}

			sx += Math.max(minShardW - 1, 3 + Math.floor(Math.random() * 5));
		}

		creature.healthHide();

		const baseSh = Math.max(0, texH);
		if (baseSh > 0) {
			const baseBmd = createGameCanvasSurface(game, texW, baseSh);
			baseBmd.ctx.clearRect(0, 0, texW, baseSh);
			for (let copyX = 0; copyX < texW; copyX++) {
				const seamY = seamProfile[Math.min(copyX, texW - 1)];
				const copyHeight = Math.max(0, texH - seamY);
				if (copyHeight <= 0) {
					continue;
				}

				const sourceX = isFlipped ? frame.x + frame.width - copyX - 1 : frame.x + copyX;
				const sourceY = frame.y + seamY;
				baseBmd.ctx.drawImage(source, sourceX, sourceY, 1, copyHeight, copyX, seamY, 1, copyHeight);
			}
			baseBmd.commit();

			const baseX = spriteLeft + texW / 2;
			const baseY = spriteTop + texH / 2;
			const baseSprite = game.gameEngine.add.sprite(
				baseX,
				baseY,
				baseBmd.key,
				undefined,
				game.grid.creatureGroup,
			);
			baseSprite.setOrigin(0.5, 0.5);
			if (isFlipped) {
				baseSprite.scale.x = -1;
			}

			creature.creatureSprite.setAlpha(0, 0);
			const baseFadeDelay = Math.max(0, longestShardLifetime - speed);
			game.gameEngine
				.tween(baseSprite)
				.to(
					{
						alpha: 0,
					},
					speed,
					Easing.Linear.None,
					true,
					baseFadeDelay,
				)
				.onComplete.add(() => {
					baseSprite.destroy();
					baseBmd.destroy();
					opts.callback?.();
				});
			return;
		}

		creature.creatureSprite.setAlpha(0, speed).then(() => {
			opts.callback?.();
		});
	}

	initInfernalCardboardEffect(creature: Creature, spriteRef?: SpriteHandle) {
		if (creature.name !== 'Infernal') {
			return;
		}
		// Temp creatures are invisible placement placeholders, so they must not
		// spawn overlays or smoke: those are separate sprites and hiding the
		// cardboard does not hide them, which leaves a lit ghost behind.
		if (creature.temp) {
			return;
		}

		const { sprite, group } = this._getLiveInfernalCardboardTarget(creature, spriteRef);
		if (!sprite || !group) {
			return;
		}

		const effectKey = this._infernalCardboardFxKey(creature);
		const existingState = this._infernalCardboardFx.get(effectKey);
		if (existingState) {
			const isExistingStateAttached =
				existingState.group === group &&
				sprite.parent === group &&
				existingState.hazeSprite?.parent === group &&
				existingState.heatLayerSprite?.parent === group;
			if (existingState.sprite === sprite && isExistingStateAttached) {
				return;
			}

			this.disposeInfernalCardboardEffect(creature);
		}
		const rand = (n: number) => Math.random() * n;
		const randInt = (n: number) => Math.floor(rand(n));
		const luminescenceShader = getEffectShader('infernal-luminescence');
		const heatShader = getEffectShader('infernal-heat');
		const luminescenceUniforms: ShaderUniformMap = {
			uTime: 0,
			uGlowStrength: 0.95,
			...(luminescenceShader?.defaultUniforms ?? {}),
			// Overrides the shader default: at 4.2 the glow strobed hard enough to
			// read as a flicker. Raised from 0.55 along with the alphas, because a
			// brighter glow at 0.55 was slow enough to look like a static wash
			// rather than something molten, then dropped three times more to
			// INFERNAL_GLOW_PULSE_SPEED: 1.87, 1.4 and 0.98 all cycled fast enough to
			// read as a flutter instead of a smoulder.
			uPulseSpeed: INFERNAL_GLOW_PULSE_SPEED,
		};
		const heatUniforms: ShaderUniformMap = {
			uTime: 0,
			uDistortion: 0.01,
			uBanding: 0.8,
			...(heatShader?.defaultUniforms ?? {}),
		};
		const state: InfernalCardboardEffectState = {
			trailNextAt: now(),
			heatNextAt: now(),
			hazeX: sprite.x,
			hazeY: sprite.y,
			heatX: sprite.x,
			heatY: sprite.y,
			hazePulsePhaseMs: randInt(2000),
			hazePulsePeriodMs: 260 + randInt(180),
			hazePulsePhaseRad: Math.random() * Math.PI * 2,
			luminescenceUniforms,
			heatUniforms,
			hazeReady: false,
			heatReady: false,
			synced: false,
			speedPx: 0,
			glowFlicker: 0.5,
			smoke: [],
			lastWorldX: group.x + sprite.x,
			lastWorldY: group.y + sprite.y,
			lastGroupX: group.x,
			lastGroupY: group.y,
			sprite,
			group,
			tweens: [],
			trailSprites: [],
		};

		// A list position, not the sprite's `depth`: both values feed `addAt`
		// below, which indexes the group's child list. `orderCreatureZ` derives
		// depth from the grid band, so a depth of 440 used to be clamped onto a
		// three-child group and the haze layers landed in the wrong place.
		const spriteIndex = group.getIndex(sprite);
		const dir = sprite.scaleX < 0 ? -1 : 1;
		const hazeTex = sprite.texture as unknown as ShatterTexture & {
			baseTexture?: { source?: CanvasImageSource };
		};
		const hazeFrameInfo = extractTextureFrameInfo(hazeTex);
		const hazeFrame = hazeFrameInfo?.frame;
		const hazeSource = hazeFrameInfo?.source;
		const heatFrame = hazeFrame;
		const heatSource = hazeSource;

		// Always create a visible haze layer bound to Infernal's silhouette.
		// Emits from the cardboard's own bottom anchor, with no extra offset.
		// Exactly on the cardboard's own position. With the overlays at scale.y 1 an
		// offset is not a look choice but an additive double-image, which is what
		// reads as the unit being blurry.
		const hazeSprite = this.game.gameEngine.add.sprite(
			sprite.x,
			sprite.y,
			sprite.key,
			undefined,
			group,
		);
		this._anchorInfernalOverlay(hazeSprite, sprite.x, sprite.y, dir, 1);
		hazeSprite.alpha = 0;
		hazeSprite.tint = 0xff8f3a;
		hazeSprite.blendMode = BLEND_MODE_ADD;
		group.addAt(hazeSprite, Math.min(group.children.length - 1, spriteIndex + 1));
		state.hazeSprite = hazeSprite;
		state.trailSprites.push(hazeSprite);
		if (hazeFrame && hazeSource && hazeFrame.width > 0 && hazeFrame.height > 0) {
			try {
				state.hazeFrame = hazeFrame;
				state.hazeSource = hazeSource;
				const hazeFrameInfo = {
					frame: hazeFrame,
					source: hazeSource,
					width: hazeFrame.width,
					height: hazeFrame.height,
				};
				state.hazeBmd = createBitmapDataFromTexture(this.game, hazeFrameInfo, false);
				const { ctx } = state.hazeBmd;
				const { width, height } = hazeFrame;
				const imageData = ctx.getImageData(0, 0, width, height);
				const data = imageData.data;
				for (let index = 0; index < data.length; index += 4) {
					const red = data[index];
					const green = data[index + 1];
					const blue = data[index + 2];
					const alpha = data[index + 3] / 255;
					const warmMask = Math.max(0, (red - blue) / 255) * Math.max(0, (red - green) / 255);
					if (warmMask <= 0.08) {
						data[index + 3] = 0;
						continue;
					}

					const warmBoost = 1 + warmMask * 0.95;
					data[index] = Math.min(255, red * warmBoost);
					data[index + 1] = Math.min(255, green * (1 + warmMask * 0.48));
					data[index + 2] = Math.min(255, blue * (1 - warmMask * 0.2));
					data[index + 3] = Math.min(255, alpha * warmMask * 255 * 1.15);
				}
				ctx.putImageData(imageData, 0, 0);
				state.hazeBmd.commit();
				state.hazeSprite.setTexture(state.hazeBmd.key);
				this._anchorInfernalOverlay(state.hazeSprite, sprite.x, sprite.y, dir, 1);
				state.hazeSprite.tint = 0xffffff;
				state.hazeReady = true;
			} catch (e) {
				console.warn('[Infernal] Failed to initialize haze BitmapData:', e);
			}
		}
		if (heatFrame && heatSource && heatFrame.width > 0 && heatFrame.height > 0) {
			try {
				state.heatFrame = heatFrame;
				state.heatSource = heatSource;
				const heatFrameInfo = {
					frame: heatFrame,
					source: heatSource,
					width: heatFrame.width,
					height: heatFrame.height,
				};
				state.heatBmd = createBitmapDataFromTexture(this.game, heatFrameInfo, false);
				const { ctx } = state.heatBmd;
				const { width, height } = heatFrame;
				const imageData = ctx.getImageData(0, 0, width, height);
				const data = imageData.data;
				// Swap fade widths for the mirrored side so the visual result is symmetric.
				const leftFadeWidth = dir < 0 ? 10 : 45;
				const rightFadeWidth = dir < 0 ? 45 : 10;
				for (let py = 0; py < height; py += 1) {
					for (let px = 0; px < width; px += 1) {
						const index = (py * width + px) * 4;
						const alpha = data[index + 3] / 255;
						const leftFade = Math.min(1, (px + 1) / leftFadeWidth);
						const rightFade = Math.min(1, (width - px) / rightFadeWidth);
						const fade = Math.min(leftFade, rightFade);
						data[index + 3] = Math.min(255, alpha * fade * 255);
					}
				}
				ctx.putImageData(imageData, 0, 0);
				state.heatBmd.commit();
				state.heatReady = true;
			} catch (e) {
				console.warn('[Infernal] Failed to initialize heat BitmapData:', e);
			}
		}

		// Keep expanded heat distortion behind the cardboard to prevent ghost overlays.
		const heatLayerSprite = this.game.gameEngine.add.sprite(
			sprite.x,
			sprite.y,
			sprite.key,
			undefined,
			group,
		);
		this._anchorInfernalOverlay(
			heatLayerSprite,
			sprite.x,
			sprite.y,
			dir,
			INFERNAL_HEAT_LAYER_SCALE_Y,
		);
		heatLayerSprite.alpha = 0;
		heatLayerSprite.tint = 0xffa15a;
		heatLayerSprite.blendMode = BLEND_MODE_ADD;
		group.addAt(heatLayerSprite, Math.max(0, spriteIndex));
		state.heatLayerSprite = heatLayerSprite;
		state.trailSprites.push(heatLayerSprite);
		if (state.heatReady && state.heatBmd) {
			heatLayerSprite.setTexture(state.heatBmd.key);
			this._anchorInfernalOverlay(
				heatLayerSprite,
				sprite.x,
				sprite.y,
				dir,
				INFERNAL_HEAT_LAYER_SCALE_Y,
			);
			heatLayerSprite.tint = 0xffffff;
			// Held back until the first tick: until then the cardboard is still at
			// the origin and unflipped, so this would flash a stray copy there.
			heatLayerSprite.alpha = 0;
		}

		this._spawnInfernalCardboardTrail(creature, state, true);

		state.tweens.push(
			this.game.gameEngine
				.tween(sprite)
				.to(
					{ alpha: 0.86 },
					1160 + randInt(300),
					Easing.Sinusoidal.InOut,
					true,
					randInt(500),
					-1,
					true,
				),
		);

		this._infernalCardboardFx.set(effectKey, state);
	}

	tickInfernalCardboardEffect(creature: Creature) {
		const state = this._infernalCardboardFx.get(this._infernalCardboardFxKey(creature));
		if (!state) {
			return;
		}
		const { sprite, group } = this._getLiveInfernalCardboardTarget(creature, state.sprite);
		if (!sprite || !group || !state.sprite.active || !state.group.active) {
			this.disposeInfernalCardboardEffect(creature);
			return;
		}
		if (
			sprite !== state.sprite ||
			group !== state.group ||
			state.sprite.parent !== state.group ||
			state.hazeSprite?.parent !== state.group ||
			state.heatLayerSprite?.parent !== state.group
		) {
			this.disposeInfernalCardboardEffect(creature);
			this.initInfernalCardboardEffect(creature, sprite);
			return;
		}

		const dir = sprite.scaleX < 0 ? -1 : 1;

		// `init` runs while the cardboard is still at the origin and unflipped:
		// `setDir` places and faces it afterwards. The overlays are created there
		// too, so until a tick has put them on the live sprite they would draw a
		// stray full-cardboard copy at (0, 0), facing the wrong way. The first
		// tick snaps them into place and only then lets them show.
		if (!state.synced) {
			state.hazeX = sprite.x;
			state.hazeY = sprite.y;
			state.heatX = sprite.x;
			state.heatY = sprite.y;
			this._anchorInfernalOverlay(state.hazeSprite, sprite.x, sprite.y, dir, 1);
			if (state.heatLayerSprite) {
				this._anchorInfernalOverlay(
					state.heatLayerSprite,
					sprite.x,
					sprite.y,
					dir,
					INFERNAL_HEAT_LAYER_SCALE_Y,
				);
			}
			state.synced = true;
		}

		if (!state.hazeReady || !state.heatReady) {
			this._retryInfernalCardboardBitmaps(state, sprite, dir);
		}

		this._positionInfernalSmoke(state, sprite);
		this._spawnInfernalCardboardTrail(creature, state);
	}

	disposeInfernalCardboardEffect(creature: Creature) {
		const effectKey = this._infernalCardboardFxKey(creature);
		const state = this._infernalCardboardFx.get(effectKey);
		if (!state) {
			return;
		}

		state.tweens.forEach((tween) => tween.stop());
		state.trailSprites.forEach((sprite) => sprite.destroy());
		state.smoke = [];
		state.hazeBmd?.destroy();
		state.heatBmd?.destroy();
		this._infernalCardboardFx.delete(effectKey);
	}

	/**
	 * Re-keys the Infernal cardboard FX state after the creature's ID has been reassigned.
	 * In the Creature constructor, the auto-assigned ID changes to the temp creature's ID
	 * after CreatureSprite (and therefore initInfernalCardboardEffect) has already run.
	 * Without this rekey, tick looks up the new ID and finds no state.
	 */
	rekeyInfernalCardboardEffect(creature: Creature, oldId: number) {
		const oldKey = `${creature.team}:${oldId}`;
		const state = this._infernalCardboardFx.get(oldKey);
		if (!state) {
			return;
		}
		this._infernalCardboardFx.delete(oldKey);
		this._infernalCardboardFx.set(this._infernalCardboardFxKey(creature), state);
	}

	/**
	 * Cardboard tilt: a quick rotation about the unit's base, the way the
	 * lightning demo's hit reaction leans a cardboard — forward when it acts,
	 * backward when it takes a hit. A rotation reads as a lean rather than a
	 * slide, so the silhouette stays on its hex while the body appears to
	 * absorb the blow or commit to the strike.
	 *
	 * The angle is tweened on the cardboard *sprite* directly, anchored on its
	 * base: the sprite is created with `setOrigin(0.5, 1)` (bottom-centre /
	 * feet), so rotating its `angle` leans the body about the feet while its
	 * x/y stay fixed on the hex. Tweening the group instead would swing the
	 * whole stack (sprite + hints + health bar) about the hex origin instead
	 * of rocking the unit in place.
	 *
	 * The lean is never flat: a random jitter is folded in so no two hits
	 * tilt the same way, and a hit scales with the damage dealt — more
	 * damage, harder the cardboard leans — up to a cap, since a unit
	 * crumpling from a glancing blow should not tilt as far as one taking
	 * a body shot.
	 */
	tiltForward(creature: Creature, opts: AnimationOptions) {
		const sprite = creature.creatureSprite;
		if (!sprite || sprite.destroyed) {
			return;
		}
		const speed = !opts.overrideSpeed ? 90 : opts.overrideSpeed;
		const dir = opts.tiltDir ?? (sprite.sprite.scaleX < 0 ? -1 : 1);
		const tilt = this._tiltAngle(0, dir);
		const settle = Math.round(speed * 1.4);
		const target = sprite.sprite;
		// Lean forward into the strike, then ease back to upright. One chain,
		// one start: queued tweens do not play until `.start()` is called.
		this.game.gameEngine
			.tween(target)
			.to({ angle: tilt }, speed, Easing.Cubic.Out)
			.to({ angle: 0 }, settle, Easing.Cubic.Out)
			.start();
	}

	/**
	 * Backward tilt for a unit taking damage — the opposite lean of
	 * {@link tiltForward}, as if the blow shoved the body back. The lean
	 * scales with the damage dealt (capped at {@link TILT_MAX_DAMAGE}),
	 * so a hard hit rocks the cardboard further than a tickle.
	 */
	tiltBackward(creature: Creature, opts: AnimationOptions) {
		const sprite = creature.creatureSprite;
		if (!sprite || sprite.destroyed) {
			return;
		}
		const speed = !opts.overrideSpeed ? 90 : opts.overrideSpeed;
		const dir = opts.tiltDir ?? (sprite.sprite.scaleX < 0 ? -1 : 1);
		const tilt = this._tiltAngle(opts.tiltDamage ?? 0, dir);
		const settle = Math.round(speed * 1.4);
		const target = sprite.sprite;
		this.game.gameEngine
			.tween(target)
			.to({ angle: tilt }, speed, Easing.Cubic.Out)
			.to({ angle: 0 }, settle, Easing.Cubic.Out)
			.start();
	}

	/**
	 * Peak lean angle for a tilt, in degrees. Scales with the damage that
	 * provoked it, capped so a unit never crumples past a believable angle:
	 * a base lean plus a share of the damage, with a random jitter folded in
	 * so consecutive hits do not rock the cardboard identically.
	 */
	private _tiltAngle(damage: number, dir: number): number {
		const damageShare = Math.min(damage, TILT_MAX_DAMAGE) / TILT_MAX_DAMAGE;
		const tilt =
			(TILT_BASE_DEGREES + TILT_PER_DAMAGE * damageShare + (Math.random() * 2 - 1) * TILT_JITTER) *
			dir;
		return Math.max(-TILT_MAX_DEGREES, Math.min(TILT_MAX_DEGREES, tilt));
	}

	/**
	 * Moves a smoke out of the creature's group once it has risen above the
	 * cardboard. Below that line it is smoke at the unit's feet and belongs to
	 * the unit; above it, it is hanging in the air and should stay where it was
	 * released instead of being dragged along by the group's position tween.
	 */
	/**
	 * Moves each smoke to `anchor + offset`, where the anchor chases the unit's
	 * world position and the offset is the rise and drift the smoke's own tween is
	 * animating.
	 *
	 * The position is written here rather than tweened on the sprite because a
	 * tween holds absolute spawn-time coordinates: it would rewrite x/y from
	 * `from -> to` every frame and overwrite the anchor, leaving detached smoke
	 * pinned at the place the unit had walked away from.
	 */
	private _positionInfernalSmoke(state: InfernalCardboardEffectState, sprite: SpriteHandle) {
		const smokeGroup = this.game.grid?.infernalSmokeGroup;
		if (!smokeGroup) {
			return;
		}
		// The unit's world position. Walking tweens the creature group and leaves
		// the sprite's own x/y fixed, so the group is what has to be read.
		const worldX = state.group.x + sprite.x;
		const worldY = state.group.y + sprite.y;
		const frameSeconds = Math.min(deltaMs() / 1000, 0.1);
		const follow = 1 - Math.exp(-INFERNAL_SMOKE_LAG_RATE * frameSeconds);
		// A materialisation or hex snap is a teleport, not a walk. Chasing across
		// one would slide the smoke a long way across the board, so it is snapped
		// onto the unit instead.
		const teleported =
			!state.synced ||
			Math.abs(worldX - state.hazeX) > INFERNAL_OVERLAY_SNAP_DISTANCE ||
			Math.abs(worldY - state.hazeY) > INFERNAL_OVERLAY_SNAP_DISTANCE;
		// Re-read the facing every tick. A unit that turns around mid-walk would
		// otherwise leave its smoke facing the direction it was travelling when
		// each smoke spawned, trailing backwards cardboard.
		const dir = sprite.scaleX < 0 ? -1 : 1;
		for (const entry of state.smoke) {
			if (!entry.sprite.active) {
				continue;
			}
			if (teleported) {
				entry.anchorX = worldX;
				entry.anchorY = worldY;
			} else {
				// The smoke absorbs only part of the gap each frame, so under a steady
				// walk it settles at a fixed distance behind the unit. That distance is
				// the whole of the lag: the smoke keeps up, but visibly trails rather
				// than sitting on top of the cardboard and rising straight up.
				entry.anchorX += (worldX - entry.anchorX) * follow;
				entry.anchorY += (worldY - entry.anchorY) * follow;
			}
			entry.sprite.setPosition(entry.anchorX + entry.offset.x, entry.anchorY + entry.offset.y);
			// The tween carries only the growth magnitude, so the facing sign is
			// applied here to keep tracking the unit's current direction.
			entry.sprite.setScale(dir * entry.growth.x, entry.growth.y);
		}
	}

	private _spawnInfernalCardboardTrail(
		creature: Creature,
		state: InfernalCardboardEffectState,
		forceHeatSpawn = false,
	) {
		const rand = (n: number) => Math.random() * n;
		const randInt = (n: number) => Math.floor(rand(n));
		const nowMs = now();

		const sprite = state.sprite;
		if (!sprite) {
			return;
		}

		const dir = sprite.scaleX < 0 ? -1 : 1;
		const frameSeconds = Math.min(deltaMs() / 1000, 0.1);
		// How far the unit travelled since the previous tick, smoothed so a single
		// jittery frame cannot spike the smoke's brightness. Measured in world
		// space: walking tweens the creature group, leaving the sprite's own x/y
		// untouched, so a sprite-local delta would read as a stationary unit.
		const worldX = state.group.x + sprite.x;
		const worldY = state.group.y + sprite.y;
		const moved = Math.hypot(worldX - state.lastWorldX, worldY - state.lastWorldY);
		state.speedPx = state.speedPx * 0.7 + moved * 0.3;
		state.lastWorldX = worldX;
		state.lastWorldY = worldY;
		state.lastGroupX = state.group.x;
		state.lastGroupY = state.group.y;
		// Frame-rate independent chase. A stationary cardboard is caught exactly,
		// while a walking one is not, so the overlays smear into a trail instead of
		// riding along at the unit's speed.
		const follow = 1 - Math.exp(-INFERNAL_OVERLAY_FOLLOW * frameSeconds);
		// Materialisation, reparenting and hex snapping teleport the cardboard.
		// Easing across one of those jumps slides a second cardboard copy into the
		// unit, so anything that far away is a teleport and gets snapped instead.
		// Chased in the group's space, because that is what a walk tweens. The
		// overlays are children of the group, so their own x/y are group-local:
		// comparing them against a world-space target would chase a constant
		// offset forever and never settle.
		const targetX = state.group.x + sprite.x;
		const targetY = state.group.y + sprite.y;
		if (
			!state.synced ||
			Math.abs(targetX - state.hazeX) > INFERNAL_OVERLAY_SNAP_DISTANCE ||
			Math.abs(targetY - state.hazeY) > INFERNAL_OVERLAY_SNAP_DISTANCE
		) {
			state.hazeX = targetX;
			state.hazeY = targetY;
			state.heatX = targetX;
			state.heatY = targetY;
		} else {
			state.hazeX += (targetX - state.hazeX) * follow;
			state.hazeY += (targetY - state.hazeY) * follow;
			state.heatX += (targetX - state.heatX) * follow;
			state.heatY += (targetY - state.heatY) * follow;
		}

		if (state.hazeSprite) {
			this._anchorInfernalOverlay(
				state.hazeSprite,
				state.hazeX - state.group.x,
				state.hazeY - state.group.y,
				dir,
				1,
			);
		}
		if (state.hazeSprite && state.hazeReady && state.synced) {
			const deltaSeconds = Math.min(deltaMs() / 1000, 0.1);
			state.luminescenceUniforms = advanceShaderTime(state.luminescenceUniforms, deltaSeconds);
			const uTime = state.luminescenceUniforms.uTime as number;
			const pulseSpeed =
				(state.luminescenceUniforms.uPulseSpeed as number) ?? INFERNAL_GLOW_PULSE_SPEED;
			// Two beats, not one. A single sine is a smooth swell: it reads as a
			// lamp being dimmed rather than something alight, because the intensity
			// only ever changes at one rate. Layering a faster, shallower beat over
			// the slow breath makes it fluctuate unevenly, the way a real glow does,
			// without returning to the hard strobe the shader's 4.2 default gave.
			const slow = 0.5 + 0.5 * Math.sin(uTime * pulseSpeed + state.hazePulsePhaseRad);
			// ~0.6Hz against the slow beat's 0.11Hz, and only a third of the
			// amplitude: enough that the intensity visibly wavers several times
			// within each breath, shallow enough that it stays a glow.
			const fast = 0.5 + 0.5 * Math.sin(uTime * pulseSpeed * 5.5 + state.hazePulsePhaseRad * 2.7);
			const flicker = slow * 0.65 + fast * 0.35;
			// A wide swing rather than a uniform lift. The trough goes almost dark
			// and the crest punches well past the old ceiling, so the pulsation is
			// obvious; the midpoint is close to where the flat version sat, so this
			// is more dynamic rather than brighter.
			state.hazeSprite.alpha = 0.05 + flicker * 0.61;
			// Shared with the heat layer below, which is driven from its own block
			// so it does not depend on the haze bitmap having loaded.
			state.glowFlicker = flicker;
		}
		if (state.heatLayerSprite && !state.synced) {
			state.heatLayerSprite.alpha = 0;
		}
		if (state.heatLayerSprite) {
			this._anchorInfernalOverlay(
				state.heatLayerSprite,
				state.heatX - state.group.x,
				state.heatY - state.group.y,
				dir,
				INFERNAL_HEAT_LAYER_SCALE_Y,
			);
			// The heat layer used to sit at a fixed alpha while the haze breathed,
			// leaving a quarter of the glow completely static. It pulses off the same
			// signal so the whole effect moves together.
			state.heatLayerSprite.alpha =
				state.heatReady && state.synced ? 0.06 + (state.glowFlicker ?? 0.5) * 0.24 : 0;
		}

		// Smokes are additive full-cardboard copies; one spawned before the first
		// sync would be drawn at the origin, facing the wrong way.
		if (
			INFERNAL_SMOKE_ENABLED &&
			state.heatReady &&
			state.synced &&
			(forceHeatSpawn || nowMs >= state.heatNextAt)
		) {
			// Born in the smoke layer in world space, not parented to the creature
			// group. A child of the moving group is dragged along by the group's
			// position tween and cannot lag behind it at all, and a smoke-layer
			// child that nothing repositions is left standing where the unit used to
			// be. `_positionInfernalSmoke` owns the position instead.
			const smokeGroup = this.game.grid?.infernalSmokeGroup;
			if (!smokeGroup) {
				return;
			}
			const deltaSeconds = Math.min(deltaMs() / 1000, 0.1);
			state.heatUniforms = advanceShaderTime(state.heatUniforms, deltaSeconds);
			const smokeX = state.group.x + sprite.x;
			const smokeY = state.group.y + sprite.y;
			const smoke = this.game.gameEngine.add.sprite(
				smokeX,
				smokeY,
				sprite.key,
				undefined,
				smokeGroup,
			);
			const growth = { x: 1 + rand(0.06), y: 0.96 + rand(0.1) };
			this._anchorInfernalOverlay(smoke, smokeX, smokeY, dir * growth.x, growth.y);
			// Born invisible and eased up to its peak. Appearing at full alpha steps
			// the total additive brightness in one frame, and with several smoke
			// overlapping that reads as a flicker rather than smoke.
			smoke.alpha = 0;
			// A stationary unit can carry full smoke; a walking one gets roughly
			// half, so the trail dissipates rather than reading as a ghost.
			const motionFade = 1 - Math.min(0.5, state.speedPx * 0.08);
			const smokePeakAlpha = (0.11 + rand(0.04)) * motionFade;
			smoke.tint = 0xff9c52;
			smoke.blendMode = BLEND_MODE_ADD;
			if (state.heatBmd) {
				smoke.setTexture(state.heatBmd.key);
				// `loadTexture` swaps the frame the origin is measured from, and may
				// reset the scale, so re-assert both from the intended values.
				this._anchorInfernalOverlay(smoke, smokeX, smokeY, dir * growth.x, growth.y);
				smoke.tint = 0xffffff;
			}
			state.trailSprites.push(smoke);
			const offset = { x: 0, y: 0 };
			state.smoke.push({
				sprite: smoke,
				anchorX: smokeX,
				anchorY: smokeY,
				offset,
				growth,
			});

			const driftX = (randInt(2) === 0 ? -1 : 1) * (2 + rand(4));
			const riseY = 8 + rand(4);
			const duration = 1350 + randInt(450);
			// Rise and drift are tweened on a detached offset object, never on the
			// sprite itself. A tween writes absolute `from -> to` values into x/y
			// every frame, so tweening the sprite would overwrite the anchor that
			// tracks the walking unit and pin the smoke at its spawn point.
			const moveTween = this.game.gameEngine
				.tween(offset)
				.to({ x: driftX, y: -riseY }, duration, Easing.Sinusoidal.Out, true);
			// Eased in over the first third, then eased back out. A single
			// `Sinusoidal.Out` to zero starts at full slope, so the smoke would dim
			// fastest exactly when it is brightest and hardest to notice.
			const fadeTween = this.game.gameEngine
				.tween(smoke)
				.to({ alpha: smokePeakAlpha }, duration * 0.3, Easing.Sinusoidal.InOut, true)
				.to({ alpha: 0 }, duration * 0.7, Easing.Sinusoidal.In, true);
			const scaleTween = this.game.gameEngine
				.tween(growth)
				.to(
					{ x: growth.x + rand(0.06), y: 1.12 + rand(0.05) },
					duration,
					Easing.Sinusoidal.Out,
					true,
				);
			moveTween.onComplete.add(() => {
				smoke.destroy();
				state.trailSprites = state.trailSprites.filter((s) => s !== smoke);
				state.smoke = state.smoke.filter((entry) => entry.sprite !== smoke);
				state.tweens = state.tweens.filter(
					(t) => t !== moveTween && t !== scaleTween && t !== fadeTween,
				);
			});
			state.tweens.push(moveTween, scaleTween, fadeTween);

			state.heatNextAt = nowMs + 420 + randInt(140);
		}
	}
}
