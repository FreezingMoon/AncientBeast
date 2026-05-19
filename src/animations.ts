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

// to fix @ts-expect-error 2554: properly type the arguments for the trigger functions in `game.ts`

type AnimationOptions = {
	customMovementPoint?: number;
	overrideSpeed?: number;
	ignoreMovementPoint?: boolean;
	ignoreTraps?: boolean;
	ignoreFacing?: boolean;
	teleportEffect?: 'abolishedBonfire';
	createTeleportDestinationTraps?: () => Trap[];
	callback?: () => void;
	callbackStepIn?: (hex?: Hex) => void;
	pushed?: boolean;
	turnAroundOnComplete?: boolean;
	flipped?: boolean;
};

type ShatterTexture = {
	crop?: { x: number; y: number; width: number; height: number };
	frame?: { x: number; y: number; width: number; height: number };
	baseTexture?: { source?: CanvasImageSource };
	width?: number;
	height?: number;
};

type InfernalCardboardEffectState = {
	trailNextAt: number;
	heatNextAt: number;
	glowOffsetY: number;
	hazePulsePhaseMs: number;
	hazePulsePeriodMs: number;
	hazePulsePhaseRad: number;
	luminescenceUniforms: ShaderUniformMap;
	heatUniforms: ShaderUniformMap;
	hazeReady: boolean;
	heatReady: boolean;
	sprite: Phaser.Sprite;
	group: Phaser.Group;
	hazeSprite?: Phaser.Sprite;
	hazeBmd?: Phaser.BitmapData;
	hazeFrame?: { x: number; y: number; width: number; height: number };
	hazeSource?: CanvasImageSource;
	heatBmd?: Phaser.BitmapData;
	heatFrame?: { x: number; y: number; width: number; height: number };
	heatSource?: CanvasImageSource;
	heatLayerSprite?: Phaser.Sprite;
	tweens: Phaser.Tween[];
	trailSprites: Phaser.Sprite[];
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

	private _getLiveInfernalCardboardTarget(creature: Creature, fallbackSprite?: Phaser.Sprite) {
		const sprite = creature.creatureSprite?.sprite ?? fallbackSprite;
		const group = (sprite?.parent as Phaser.Group | undefined) ?? creature.creatureSprite?.grp;
		return { sprite, group };
	}

	private _retryInfernalCardboardBitmaps(
		state: InfernalCardboardEffectState,
		sprite: Phaser.Sprite,
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

					const warmBoost = 1 + warmMask * 0.95;
					data[index] = Math.min(255, red * warmBoost);
					data[index + 1] = Math.min(255, green * (1 + warmMask * 0.48));
					data[index + 2] = Math.min(255, blue * (1 - warmMask * 0.2));
					data[index + 3] = Math.min(255, alpha * warmMask * 255 * 1.15);
				}
				ctx.putImageData(imageData, 0, 0);
				state.hazeBmd.dirty = true;
				state.hazeSprite.loadTexture(state.hazeBmd);
				state.hazeSprite.scale.setTo(dir, 1);
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
				state.heatBmd.dirty = true;
				state.heatReady = true;
				state.heatLayerSprite.loadTexture(state.heatBmd);
				state.heatLayerSprite.scale.setTo(dir, 1.38);
				state.heatLayerSprite.tint = 0xffffff;
				state.heatLayerSprite.alpha = 0.24;
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
		props: object,
		duration: number,
		ease: (k: number) => number,
		maxPhase = duration,
	) {
		return this.game.Phaser.add
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
			if (hexagon.display?.exists) {
				hexagon.display.visible = !hidden;
			}
			if (hexagon.overlay?.exists) {
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
			if (hexagon.display?.exists) {
				hexagon.display.alpha = alpha;
			}
			if (hexagon.overlay?.exists) {
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
		const phaser = this.game.Phaser;
		return Promise.all(
			hexes.map((hexagon) => {
				const hasDisplay = Boolean(hexagon.display?.exists);
				const hasOverlay = Boolean(hexagon.overlay?.exists);
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

				const alphaTween = phaser.add
					.tween(tweenState)
					.to({ alpha }, duration, Phaser.Easing.Quadratic.InOut, true);
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
				if (hexagon.display?.exists) {
					hexagon.display.visible = true;
				}
				if (hexagon.overlay?.exists) {
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
				this.game.Phaser.time.events.add(intervalMs, tryClear);
			}
		};

		this.game.Phaser.time.events.add(options.minDelayMs ?? 0, tryClear);
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
		display: Phaser.Sprite,
		trapGroup: Phaser.Group,
		idleTweens: Phaser.Tween[],
		overlaySprites: Phaser.Sprite[],
	) {
		const base = display;

		if (base.anchor.y !== 1) {
			base.anchor.y = 1;
			base.y += base.height / 2 + BONFIRE_BASELINE_Y_COMPENSATION_PX;
		}
		base.scale.y = 0.62;
		base.alpha = 0.76;
		const bx = base.x;
		const by = base.y;

		const rand = (n: number) => Math.random() * n;
		const randInt = (n: number) => Math.floor(rand(n));

		const baseGlow = trapGroup.create(bx, by, 'trap_bonfire-spring') as Phaser.Sprite;
		baseGlow.anchor.setTo(0.5, 1);
		baseGlow.alpha = 0.4;
		baseGlow.scale.setTo(1.08, 0.72);
		idleTweens.push(
			this._yoyo(
				baseGlow.scale,
				{ x: 1.14, y: 0.8 },
				180 + randInt(120),
				Phaser.Easing.Quadratic.InOut,
			),
			this._yoyo(baseGlow, { alpha: 0.34 }, 180 + randInt(120), Phaser.Easing.Linear.None),
		);
		overlaySprites.push(baseGlow);

		const core = trapGroup.create(bx, by - 6, 'trap_bonfire-spring') as Phaser.Sprite;
		core.anchor.setTo(0.5, 1);
		core.alpha = 0.58;
		core.scale.setTo(0.76, 0.98);
		idleTweens.push(
			this._yoyo(
				core.scale,
				{ x: 0.81, y: 1.1 },
				220 + randInt(120),
				Phaser.Easing.Quadratic.InOut,
			),
			this._yoyo(core, { alpha: 0.5 }, 220 + randInt(120), Phaser.Easing.Linear.None),
		);
		overlaySprites.push(core);

		const bridge = trapGroup.create(bx, by - 10, 'trap_bonfire-spring') as Phaser.Sprite;
		bridge.anchor.setTo(0.5, 1);
		bridge.alpha = 0.34;
		bridge.scale.setTo(0.56, 1.14);
		const bridgeDrift = 0.8 + rand(0.8);
		bridge.x = bx - bridgeDrift;
		idleTweens.push(
			this._yoyo(
				bridge.scale,
				{ x: 0.58, y: 1.2 },
				230 + randInt(120),
				Phaser.Easing.Quadratic.InOut,
			),
			this._yoyo(bridge, { alpha: 0.32 }, 230 + randInt(120), Phaser.Easing.Linear.None),
			this._yoyo(
				bridge,
				{ x: bx + bridgeDrift },
				240 + randInt(120),
				Phaser.Easing.Sinusoidal.InOut,
			),
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
			const emberSkirt = trapGroup.create(emberX, by + 1, 'trap_bonfire-spring') as Phaser.Sprite;
			emberSkirt.anchor.setTo(0.5, 1);
			emberSkirt.alpha = 0.32;
			emberSkirt.scale.setTo(1.02, 0.44 + c.bodyScaleY * 0.08);
			idleTweens.push(
				this._yoyo(
					emberSkirt.scale,
					{ x: emberSkirt.scale.x * 1.12, y: emberSkirt.scale.y * 1.08 },
					260 + randInt(110),
					Phaser.Easing.Quadratic.InOut,
				),
				this._yoyo(emberSkirt, { alpha: 0.26 }, 220 + randInt(100), Phaser.Easing.Linear.None),
			);
			overlaySprites.push(emberSkirt);
		}

		for (const row of depthRows) {
			for (const c of clusters) {
				const cx = bx + c.dx * row.dxScale;
				const isFloorRow = row.dy >= -5;

				const depthBody = trapGroup.create(cx, by + row.dy, 'trap_bonfire-spring') as Phaser.Sprite;
				depthBody.anchor.setTo(0.5, 1);
				depthBody.alpha = 0.62 * row.alphaMul;
				depthBody.scale.setTo(
					(isFloorRow ? 0.86 : 0.72) * row.scaleMul,
					c.bodyScaleY * row.scaleMul,
				);
				const depthSway = 0.012 + rand(0.012);
				depthBody.rotation = -depthSway;
				idleTweens.push(
					this._yoyo(
						depthBody.scale,
						{ y: c.bodyScaleY * row.scaleMul * 1.2 },
						340 + randInt(110),
						Phaser.Easing.Quadratic.InOut,
					),
					this._yoyo(
						depthBody,
						{ alpha: depthBody.alpha * 0.74 },
						300 + randInt(100),
						Phaser.Easing.Linear.None,
					),
					this._yoyo(
						depthBody,
						{ rotation: depthSway },
						760 + randInt(280),
						Phaser.Easing.Sinusoidal.InOut,
					),
				);
				overlaySprites.push(depthBody);

				const depthTongue = trapGroup.create(
					cx,
					by + row.dy - 4,
					'trap_bonfire-spring',
				) as Phaser.Sprite;
				depthTongue.anchor.setTo(0.5, 1);
				depthTongue.alpha = 0.34 * row.alphaMul;
				depthTongue.scale.setTo(
					c.tongueScaleX * 0.66 * row.scaleMul,
					c.tongueScaleY * row.scaleMul,
				);
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
						Phaser.Easing.Quadratic.InOut,
					),
					this._yoyo(
						depthTongue,
						{ alpha: depthTongue.alpha * 0.76 },
						220 + randInt(100),
						Phaser.Easing.Linear.None,
					),
					this._yoyo(
						depthTongue,
						{ rotation: depthTongueDrift },
						680 + randInt(260),
						Phaser.Easing.Sinusoidal.InOut,
					),
				);
				overlaySprites.push(depthTongue);
			}
		}

		for (const c of clusters) {
			const cx = bx + c.dx;
			const body = trapGroup.create(cx, by - 4, 'trap_bonfire-spring') as Phaser.Sprite;
			body.anchor.setTo(0.5, 1);
			body.alpha = 0.72;
			body.scale.setTo(0.78, c.bodyScaleY);
			const bodySway = 0.02 + rand(0.02);
			body.rotation = -bodySway;
			idleTweens.push(
				this._yoyo(
					body.scale,
					{ y: c.bodyScaleY * 1.18 },
					380 + randInt(120),
					Phaser.Easing.Quadratic.InOut,
				),
				this._yoyo(body, { alpha: 0.52 }, 320 + randInt(100), Phaser.Easing.Linear.None),
				this._yoyo(
					body,
					{ rotation: bodySway },
					850 + randInt(300),
					Phaser.Easing.Sinusoidal.InOut,
				),
			);
			overlaySprites.push(body);

			const tongue = trapGroup.create(cx, by - 8, 'trap_bonfire-spring') as Phaser.Sprite;
			tongue.anchor.setTo(0.5, 1);
			tongue.alpha = 0.36;
			tongue.scale.setTo(c.tongueScaleX, c.tongueScaleY);
			const tongueDrift = 0.015 + rand(0.015);
			tongue.rotation = -tongueDrift;
			idleTweens.push(
				this._yoyo(
					tongue.scale,
					{ y: c.tongueScaleY * 1.32, x: c.tongueScaleX * 0.8 },
					240 + randInt(120),
					Phaser.Easing.Quadratic.InOut,
				),
				this._yoyo(tongue, { alpha: 0.31 }, 220 + randInt(120), Phaser.Easing.Linear.None),
				this._yoyo(
					tongue,
					{ rotation: tongueDrift },
					760 + randInt(340),
					Phaser.Easing.Sinusoidal.InOut,
				),
			);
			overlaySprites.push(tongue);

			const tip = trapGroup.create(cx, by - 10, 'trap_bonfire-spring') as Phaser.Sprite;
			tip.anchor.setTo(0.5, 1);
			tip.alpha = 0.48;
			tip.scale.setTo(c.tongueScaleX * 0.55, c.tongueScaleY * 0.95);
			const tipSway = 0.09 + rand(0.04);
			const tipDriftX = 0.8 + rand(1.0);
			tip.x = cx - tipDriftX;
			tip.rotation = -tipSway;
			idleTweens.push(
				this._yoyo(
					tip.scale,
					{ y: c.tongueScaleY * 1.2, x: c.tongueScaleX * 0.46 },
					210 + randInt(120),
					Phaser.Easing.Quadratic.InOut,
				),
				this._yoyo(tip, { alpha: 0.38 }, 180 + randInt(100), Phaser.Easing.Linear.None),
				this._yoyo(tip, { rotation: tipSway }, 300 + randInt(140), Phaser.Easing.Sinusoidal.InOut),
				this._yoyo(tip, { x: cx + tipDriftX }, 280 + randInt(140), Phaser.Easing.Sinusoidal.InOut),
			);
			overlaySprites.push(tip);
		}
	}

	startScorchedGroundTrapAnimation(
		display: Phaser.Sprite,
		trapGroup: Phaser.Group,
		idleTweens: Phaser.Tween[],
		overlaySprites: Phaser.Sprite[],
	) {
		display.alpha = 1;
		const bx = display.x;
		const by = display.y;
		const randInt = (n: number) => Math.floor(Math.random() * n);

		const innerGlow = trapGroup.create(bx, by, 'trap_scorched-ground') as Phaser.Sprite;
		innerGlow.anchor.setTo(0.5);
		innerGlow.alpha = 0.3;
		innerGlow.tint = 0xffa347;
		innerGlow.scale.setTo(1.07, 1.06);
		innerGlow.blendMode = Phaser.blendModes.ADD;
		idleTweens.push(
			this._yoyo(innerGlow, { alpha: 0.43 }, 480 + randInt(200), Phaser.Easing.Linear.None),
			this._yoyo(
				innerGlow.scale,
				{ x: 1.2, y: 1.17 },
				520 + randInt(210),
				Phaser.Easing.Quadratic.InOut,
			),
		);
		overlaySprites.push(innerGlow);

		const outerAura = trapGroup.create(bx, by, 'trap_scorched-ground') as Phaser.Sprite;
		outerAura.anchor.setTo(0.5);
		outerAura.alpha = 0.19;
		outerAura.tint = 0xff7a1f;
		outerAura.scale.setTo(1.24, 1.22);
		outerAura.blendMode = Phaser.blendModes.ADD;
		idleTweens.push(
			this._yoyo(outerAura, { alpha: 0.3 }, 700 + randInt(260), Phaser.Easing.Linear.None),
			this._yoyo(
				outerAura.scale,
				{ x: 1.46, y: 1.38 },
				780 + randInt(280),
				Phaser.Easing.Sinusoidal.InOut,
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

			creature.creatureSprite.setHex(nextPos, speed).then(() => {
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

		this.leaveHex(creature, currentHex, opts);

		const durationMS = !opts.overrideSpeed ? creature.animation.walk_speed : opts.overrideSpeed;

		creature.creatureSprite.setHex(currentHex, durationMS).then(() => {
			// Sound Effect
			game.soundsys.playSFX('sounds/step');

			if (!opts.ignoreMovementPoint) {
				// Determine distance
				let distance = 0;
				let k = 0;
				while (!distance) {
					k++;

					if (arrayUtils.findPos(start.adjacentHex(k), currentHex)) {
						distance = k;
					}
				}

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
			const phaser = game.Phaser;
			const transition = this._createMovementHexTransition(creature, hex);
			const originHexes = transition.originHexes;
			this._setHexForcedHidden(transition.originOnlyHexes, true);
			const moveSpriteToGroup = (sprite: Phaser.Sprite, targetGroup: Phaser.Group) => {
				const sourceGroup = sprite.parent as Phaser.Group;
				const worldPos = sourceGroup.toGlobal(sprite.position.clone());
				sourceGroup.remove(sprite, false);
				targetGroup.add(sprite);
				const localPos = targetGroup.toLocal(worldPos, game.Phaser.world);
				sprite.position.set(localPos.x, localPos.y);
			};
			const getTallScaleMultiplier = (baselineHeight: number) => {
				const cardboardHeight = Math.max(70, Math.abs(creature.creatureSprite.sprite.height));
				return Math.max(4.2, (cardboardHeight / Math.max(1, baselineHeight)) * 3.2);
			};

			const liftBonfireCurtainFromTraps = (originTraps: Trap[], shouldOverlapCreature = false) => {
				const trapOverGroup = game.grid.trapOverGroup;
				const trapGroup = game.grid.trapGroup;
				type SpriteRestore = {
					trap: Trap;
					sprite: Phaser.Sprite;
					parent: Phaser.Group;
					index: number;
					bringToTop: boolean;
				};
				const spriteRestoreData: SpriteRestore[] = [];

				originTraps.forEach((trap) => trap.pauseIdleAnimation());

				const curtainSprites = originTraps.flatMap((trap) =>
					trap
						.getVisualSprites()
						.filter((sprite) => sprite.exists)
						.map((sprite) => ({ trap, sprite })),
				);

				curtainSprites.forEach(({ trap, sprite }) => {
					if (sprite.anchor.y !== 1) {
						sprite.anchor.y = 1;
						sprite.y += sprite.height / 2;
					}
					if (shouldOverlapCreature) {
						const parent = sprite.parent as Phaser.Group;
						spriteRestoreData.push({
							trap,
							sprite,
							parent,
							index: parent.getChildIndex(sprite),
							bringToTop: parent === trapGroup,
						});
						// Move sprites without bringToTop yet to preserve their relative layering order
						moveSpriteToGroup(sprite, trapOverGroup);
					} else {
						trapGroup.bringToTop(sprite);
					}
				});
				// After all sprites are moved, bring only the last one to top to place trap above existing sprites
				// while preserving the internal layering of display vs overlays
				if (shouldOverlapCreature && curtainSprites.length > 0) {
					trapOverGroup.bringToTop(curtainSprites[curtainSprites.length - 1].sprite);
				}

				const baseScales = curtainSprites.map(({ sprite }) => ({
					x: sprite.scale.x,
					y: sprite.scale.y,
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

							const scaleTween = phaser.add
								.tween(sprite.scale)
								.to(targetScale, duration, ease, true);
							return new Promise<void>((resolve) => {
								scaleTween.onComplete.addOnce(() => resolve());
							});
						}),
					);
				};

				const restore = () => {
					spriteRestoreData.forEach((item) => {
						if (!item.sprite.exists) {
							return;
						}
						if (!trapGroup.exists) {
							return;
						}
						moveSpriteToGroup(item.sprite, trapGroup);
						if (item.parent === trapGroup) {
							if (item.bringToTop) {
								trapGroup.bringToTop(item.sprite);
							} else {
								const safeIndex = Math.min(item.index, trapGroup.children.length - 1);
								trapGroup.setChildIndex(item.sprite, Math.max(safeIndex, 0));
							}
						} else {
							trapGroup.bringToTop(item.sprite);
						}
					});
					originTraps.forEach((trap) => trap.resumeIdleAnimation());
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
				game.grid.clearAllXray();
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
			const originCurtains = liftBonfireCurtainFromTraps(originTraps, true);
			let didRestoreOriginLayer = false;
			const restoreOriginLayer = () => {
				if (didRestoreOriginLayer) {
					return;
				}
				didRestoreOriginLayer = true;
				originCurtains.restore();
			};

			this.xraySuppressed = true;
			game.grid.clearAllXray();
			Promise.resolve()
				.then(() => fadePhaseAOriginHexes())
				.then(() => originCurtains.tweenSprites('tower', 260, Phaser.Easing.Cubic.Out))
				.then(() =>
					Promise.all([
						creature.creatureSprite.setAlpha(0, 340),
						originCurtains.tweenSprites('idle', 340, Phaser.Easing.Quadratic.InOut),
					]),
				)
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
						const destinationCurtains = liftBonfireCurtainFromTraps(destinationTraps, false);
						return destinationCurtains
							.tweenSprites('tower', 300, Phaser.Easing.Cubic.Out)
							.then(() =>
								Promise.all([
									creature.creatureSprite.setAlpha(1, 420),
									destinationCurtains.tweenSprites('idle', 420, Phaser.Easing.Quadratic.InOut),
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
		// @ts-expect-error 2554
		game.onStepOut(creature, creature.hexagons[0]); // Trigger
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
	) {
		// Get the target's position on the projectile's path that is closest
		const emissionPointX = this2.creature.legacyProjectileEmissionPoint.x + startX;
		let distance = Number.MAX_SAFE_INTEGER;
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
			emissionPoint = {
				x: this2.creature.legacyProjectileEmissionPoint.x + startX,
				y: this2.creature.legacyProjectileEmissionPoint.y + startY,
			},
			targetPoint = {
				x: targetX + 45,
				y: path[baseDist].displayPos.y - 20,
			},
			// Sprite id here
			sprite = game.grid.creatureGroup.create(emissionPoint.x, emissionPoint.y, spriteId),
			duration = dist * 75;

		sprite.anchor.setTo(0.5);
		sprite.rotation = -Math.PI / 3 + (args.direction * Math.PI) / 3;
		const tween = game.Phaser.add
			.tween(sprite)
			.to(
				{
					x: targetPoint.x,
					y: targetPoint.y,
				},
				duration,
				Phaser.Easing.Linear.None,
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
		const startScaleX = sprite.scale.x;
		const startScaleY = sprite.scale.y;

		creature.healthHide();
		creature.creatureSprite.setAngle(0, 0);

		// Squash and fade the sprite as it melts into the puddle
		this.game.Phaser.add
			.tween(sprite.scale)
			.to(
				{
					x: startScaleX * 1.1,
					y: startScaleY * 0.2,
				},
				Math.round(speed * 0.7),
				Phaser.Easing.Quadratic.In,
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
		const startScaleX = sprite.scale.x;
		const startScaleY = sprite.scale.y;

		creature.healthHide();
		creature.creatureSprite.setAngle(0, 0);

		// Start from squashed position
		sprite.scale.x = startScaleX * 1.1;
		sprite.scale.y = startScaleY * 0.2;
		creature.creatureSprite.setAlpha(0, 0);

		// Unsquash and fade back in as Gumble reshapes himself
		this.game.Phaser.add
			.tween(sprite.scale)
			.to(
				{
					x: startScaleX,
					y: startScaleY,
				},
				Math.round(speed * 0.7),
				Phaser.Easing.Quadratic.Out,
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
		const frame = texture.crop || texture.frame || { x: 0, y: 0, width: 0, height: 0 };
		const source = texture.baseTexture?.source as CanvasImageSource;
		const texW = Math.round(texture.width || frame.width || 1);
		const texH = Math.round(texture.height || frame.height || 1);
		const isFlipped = sprite.scale.x < 0;

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

				const bmd = game.Phaser.add.bitmapData(sw, sh);
				const srcX = isFlipped ? frame.x + frame.width - sx - sw : frame.x + sx;
				const srcY = frame.y + sy;
				bmd.ctx.clearRect(0, 0, sw, sh);
				bmd.ctx.drawImage(source, srcX, srcY, sw, sh, 0, 0, sw, sh);
				bmd.dirty = true;

				const shardScreenX = isFlipped ? texW - sx - sw : sx;
				const x = spriteLeft + shardScreenX + sw / 2;
				const y = spriteTop + sy + sh / 2;
				const shard = game.grid.creatureGroup.create(x, y, bmd);
				shard.anchor.setTo(0.5, 0.5);
				shard.angle = -18 + Math.random() * 36;

				const driftX = -40 + Math.random() * 80;
				const landingMinY = Math.max(y + 10, spriteTop + localSeamY + sh / 2 - 2);
				const landingMaxY = Math.max(landingMinY, baseBottom - sh / 2);
				const targetY = landingMinY + Math.random() * Math.max(0, landingMaxY - landingMinY);
				const shardDuration = Math.round(shardFadeMs * (0.9 + Math.random() * 0.35));
				const shardFadeDuration = Math.max(90, Math.round(shardDuration * 0.22));
				longestShardLifetime = Math.max(longestShardLifetime, shardDuration + shardFadeDuration);
				const travelTween = game.Phaser.add.tween(shard).to(
					{
						x: x + driftX,
						y: targetY,
						angle: shard.angle + (-90 + Math.random() * 180),
					},
					shardDuration,
					Phaser.Easing.Cubic.In,
					true,
				);

				travelTween.onComplete.add(() => {
					game.Phaser.add
						.tween(shard)
						.to(
							{
								alpha: 0,
							},
							shardFadeDuration,
							Phaser.Easing.Linear.None,
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
			const baseBmd = game.Phaser.add.bitmapData(texW, baseSh);
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
			baseBmd.dirty = true;

			const baseX = spriteLeft + texW / 2;
			const baseY = spriteTop + texH / 2;
			const baseSprite = game.grid.creatureGroup.create(baseX, baseY, baseBmd);
			baseSprite.anchor.setTo(0.5, 0.5);
			if (isFlipped) {
				baseSprite.scale.x = -1;
			}

			creature.creatureSprite.setAlpha(0, 0);
			const baseFadeDelay = Math.max(0, longestShardLifetime - speed);
			game.Phaser.add
				.tween(baseSprite)
				.to(
					{
						alpha: 0,
					},
					speed,
					Phaser.Easing.Linear.None,
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

	initInfernalCardboardEffect(creature: Creature, spriteRef?: Phaser.Sprite) {
		if (creature.name !== 'Infernal') {
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
			uPulseSpeed: 4.2,
			...(luminescenceShader?.defaultUniforms ?? {}),
		};
		const heatUniforms: ShaderUniformMap = {
			uTime: 0,
			uDistortion: 0.01,
			uBanding: 0.8,
			...(heatShader?.defaultUniforms ?? {}),
		};
		const state: InfernalCardboardEffectState = {
			trailNextAt: this.game.Phaser.time.now,
			heatNextAt: this.game.Phaser.time.now,
			glowOffsetY: sprite.texture.height * 0.02,
			hazePulsePhaseMs: randInt(2000),
			hazePulsePeriodMs: 260 + randInt(180),
			hazePulsePhaseRad: Math.random() * Math.PI * 2,
			luminescenceUniforms,
			heatUniforms,
			hazeReady: false,
			heatReady: false,
			sprite,
			group,
			tweens: [],
			trailSprites: [],
		};

		const spriteIndex = group.getChildIndex(sprite);
		const dir = sprite.scale.x < 0 ? -1 : 1;
		const hazeTex = sprite.texture as unknown as ShatterTexture & {
			baseTexture?: { source?: CanvasImageSource };
		};
		const hazeFrameInfo = extractTextureFrameInfo(hazeTex);
		const hazeFrame = hazeFrameInfo?.frame;
		const hazeSource = hazeFrameInfo?.source;
		const heatFrame = hazeFrame;
		const heatSource = hazeSource;

		// Always create a visible haze layer bound to Infernal's silhouette.
		const hazeSprite = group.create(sprite.x, sprite.y - state.glowOffsetY, sprite.key);
		hazeSprite.anchor.setTo(0.5, 1);
		hazeSprite.scale.setTo(dir, 1);
		hazeSprite.alpha = 0;
		hazeSprite.tint = 0xff8f3a;
		hazeSprite.blendMode = Phaser.blendModes.ADD;
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
				state.hazeBmd.dirty = true;
				state.hazeSprite.loadTexture(state.hazeBmd);
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
				state.heatBmd.dirty = true;
				state.heatReady = true;
			} catch (e) {
				console.warn('[Infernal] Failed to initialize heat BitmapData:', e);
			}
		}

		const heatLayerSprite = group.create(sprite.x, sprite.y - state.glowOffsetY, sprite.key);
		heatLayerSprite.anchor.setTo(0.5, 1);
		heatLayerSprite.scale.setTo(dir, 1.38);
		heatLayerSprite.alpha = 0;
		heatLayerSprite.tint = 0xffa15a;
		heatLayerSprite.blendMode = Phaser.blendModes.ADD;
		// Keep expanded heat distortion behind the cardboard to prevent ghost overlays.
		group.addAt(heatLayerSprite, Math.max(0, spriteIndex));
		state.heatLayerSprite = heatLayerSprite;
		state.trailSprites.push(heatLayerSprite);
		if (state.heatReady && state.heatBmd) {
			heatLayerSprite.loadTexture(state.heatBmd);
			heatLayerSprite.tint = 0xffffff;
			heatLayerSprite.alpha = 0.24;
		}

		this._spawnInfernalCardboardTrail(creature, state, true);

		state.tweens.push(
			this.game.Phaser.add
				.tween(sprite)
				.to(
					{ alpha: 0.86 },
					1160 + randInt(300),
					Phaser.Easing.Sinusoidal.InOut,
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
		if (!sprite || !group || !state.sprite.exists || !state.group.exists) {
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

		if (!state.hazeReady || !state.heatReady) {
			const dir = sprite.scale.x < 0 ? -1 : 1;
			this._retryInfernalCardboardBitmaps(state, sprite, dir);
		}

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

	private _spawnInfernalCardboardTrail(
		creature: Creature,
		state: InfernalCardboardEffectState,
		forceHeatSpawn = false,
	) {
		const rand = (n: number) => Math.random() * n;
		const randInt = (n: number) => Math.floor(rand(n));
		const now = this.game.Phaser.time.now;

		const sprite = state.sprite;
		if (!sprite) {
			return;
		}

		const dir = sprite.scale.x < 0 ? -1 : 1;
		if (state.hazeSprite && state.hazeReady) {
			state.hazeSprite.x = sprite.x;
			state.hazeSprite.y = sprite.y - state.glowOffsetY;
			state.hazeSprite.scale.setTo(dir, 1);
			const deltaSeconds = Math.min((this.game.Phaser?.time?.elapsedMS ?? 0) / 1000, 0.1);
			state.luminescenceUniforms = advanceShaderTime(state.luminescenceUniforms, deltaSeconds);
			const uTime = state.luminescenceUniforms.uTime as number;
			const pulseSpeed = (state.luminescenceUniforms.uPulseSpeed as number) ?? 4.2;
			const hazePulse = 0.5 + 0.5 * Math.sin(uTime * pulseSpeed + state.hazePulsePhaseRad);
			state.hazeSprite.alpha = 0.12 + hazePulse * 0.88;
		}
		if (state.heatLayerSprite) {
			state.heatLayerSprite.x = sprite.x;
			state.heatLayerSprite.y = sprite.y - state.glowOffsetY;
			state.heatLayerSprite.scale.setTo(dir, 1.38);
			state.heatLayerSprite.alpha = state.heatReady ? 0.24 : 0;
		}

		if (state.heatReady && (forceHeatSpawn || now >= state.heatNextAt)) {
			const group = state.group;
			const deltaSeconds = Math.min((this.game.Phaser?.time?.elapsedMS ?? 0) / 1000, 0.1);
			state.heatUniforms = advanceShaderTime(state.heatUniforms, deltaSeconds);
			const wisp = group.create(sprite.x, sprite.y - state.glowOffsetY, sprite.key);
			wisp.anchor.setTo(0.5, 1);
			wisp.scale.setTo(dir * (1 + rand(0.06)), 0.96 + rand(0.1));
			wisp.alpha = 0.26 + rand(0.12);
			wisp.tint = 0xff9c52;
			wisp.blendMode = Phaser.blendModes.ADD;
			group.addAt(wisp, 0);
			if (state.heatBmd) {
				wisp.loadTexture(state.heatBmd);
				wisp.tint = 0xffffff;
			}
			state.trailSprites.push(wisp);

			const driftX = (randInt(2) === 0 ? -1 : 1) * (2 + rand(4));
			const riseY = 22 + rand(18);
			const duration = 1900 + randInt(700);
			const moveTween = this.game.Phaser.add
				.tween(wisp)
				.to(
					{ x: wisp.x + driftX, y: wisp.y - riseY, alpha: 0 },
					duration,
					Phaser.Easing.Sinusoidal.Out,
					true,
				);
			const scaleTween = this.game.Phaser.add
				.tween(wisp.scale)
				.to(
					{ x: dir * (1.02 + rand(0.08)), y: 1.5 + rand(0.12) },
					duration,
					Phaser.Easing.Sinusoidal.Out,
					true,
				);
			moveTween.onComplete.add(() => {
				wisp.destroy();
				state.trailSprites = state.trailSprites.filter((s) => s !== wisp);
				state.tweens = state.tweens.filter((t) => t !== moveTween && t !== scaleTween);
			});
			state.tweens.push(moveTween, scaleTween);

			state.heatNextAt = now + 240 + randInt(160);
		}
	}
}
