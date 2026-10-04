import { Easing } from './utility/easing';
import $j from 'jquery';
import { Ability } from './ability';
import { search } from './utility/pathfinding';
import { Hex } from './utility/hex';
import Game from './game';
import * as arrayUtils from './utility/arrayUtils';
import { Drop, DropDefinition } from './drop';
import { ensureCardboard, ensureDropTexture, isTextureReady } from './assets';
import { Point, getPointFacade } from './utility/pointfacade';
import { Effect } from './effect';
import { Player, PlayerID, getDarkPriestCardboardKey, getDarkPriestDisplayOffsetX } from './player';
import { Damage, DamageResult } from './damage';
import { AugmentedMatrix } from './utility/matrices';
import { Trap } from './utility/trap';
import {
	GHOST_PREVIEW_ALPHA,
	HEX_WIDTH_PX,
	hashOffsetCoords,
	offsetNeighbors,
} from './utility/const';
import { CreatureType, Level, Realm, Unit, UnitName } from './data/types';
import { PlasmaField, detectWeakHardware, detectVeryWeakHardware } from './plasma-field';
import type { GameEngine } from './engine/types';
import { getFrameSize, MISSING_TEXTURE_KEY } from './game-display/texture';
import { onPointerDown } from './input/input';
import { setHandCursor } from './game-display/cursor';
import { createGameCanvasSurface, type CanvasSurface } from './game-display/canvas-surface';

/** Vertical distance (in pixels) between the Dark Priest's feet and the Plasma Field center. */
const PLASMA_FIELD_OFFSET_Y = 90;

/** Per player-color hue shift (degrees) so each team's shield reads in its color. */
const PLASMA_FIELD_HUE_BY_COLOR: Record<string, number> = {
	red: 54,
	blue: 300,
	orange: 90,
	green: 218,
};

/**
 * Returns the horizontal offset (in unflipped sprite-local units) of the center
 * of the topmost row of non-transparent pixels of the dark priest's cardboard
 * texture. Subtracting half the texture width converts to an offset relative to
 * the cardboard's anchor center; at runtime we multiply by the flip direction
 * so the field is correctly mirrored when the priest faces right.
 *
 * Returns 0 when the texture cannot be read (e.g. mocked environment).
 */
function computeCardboardCenterOffset(gameEngine: GameEngine, sprite: any): number {
	const key = sprite.key;
	if (typeof key !== 'string') return 0;
	const src = gameEngine.cache.getImage(key) as HTMLImageElement | HTMLCanvasElement | null;
	if (!src || !(src.width > 0) || !(src.height > 0)) return 0;

	const w = src.width;
	const h = src.height;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return 0;

	let data: Uint8ClampedArray;
	try {
		ctx.drawImage(src, 0, 0);
		data = ctx.getImageData(0, 0, w, h).data;
	} catch {
		return 0;
	}

	for (let y = 0; y < h; y++) {
		let minX = -1;
		let maxX = -1;
		for (let x = 0; x < w; x++) {
			if (data[(y * w + x) * 4 + 3] > 16) {
				if (minX === -1) minX = x;
				maxX = x;
			}
		}
		if (minX !== -1) {
			return (minX + maxX) / 2 - w / 2;
		}
	}
	return 0;
}
import { UnitDisplayInfo, UnitSize } from './data/units';

// To fix @ts-expect-error 2554: properly type the arguments for the trigger functions in `game.ts`

export type CreatureVitals = {
	health: number;
	regrowth: number;
	endurance: number;
	energy: number;
	meditation: number;
	initiative: number;
	offense: number;
	defense: number;
	movement: number;
};

export type CreatureMasteries = {
	pierce: number;
	slash: number;
	crush: number;
	shock: number;
	burn: number;
	frost: number;
	poison: number;
	sonic: number;
	mental: number;
};

export type Movement = 'normal' | 'flying' | 'hover';

type CreatureStats = CreatureVitals &
	CreatureMasteries & {
		moveable: boolean;
		fatigueImmunity: boolean;
		reqEnergy: number;
	};

type TracePositionOptions = Partial<{
	x: number;
	y: number;
	overlayClass: string;
	displayClass: string;
	drawOverCreatureTiles: boolean;
}>;

type QueryMoveOptions = Partial<{
	targeting: boolean;
	noPath: boolean;
	isAbility: boolean;
	ownCreatureHexShade: boolean;
	range: Hex[];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	callback: (hex: Hex, args: any) => void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	args: any;
}>;

type Status = {
	frozen: boolean;
	cryostasis: boolean;
	dizzy: boolean;
};

type CreatureRuntimeFlags = {
	hideFromQueue?: boolean;
	hideFromCreatureCount?: boolean;
	deathAnimationType?: string;
};

/**
 * Creature Class
 *
 * Creature contains all creatures properties and attacks/imgres?imgurl=https://i.pinimg.com/originals/e0/f0/53/e0f05354e9ca1ab73b860a896238d553.jpg&tbnid=FRJ2QLlrmIxDtM&vet=1&imgrefurl=https://www.pinterest.com/pin/346706871308486887/&docid=GMQJmxHxt2C2zM&w=931&h=807&hl=en-US&source=sh/x/im/4
 */
export class Creature {
	//TODO: This can be removed when it's factored out of get fatigueText
	#fatigueText = '';

	/* Attributes
	 *
	 * NOTE : attributes and variables starting with $ are jquery element
	 * and jquery function can be called directly from them.
	 *
	 * // Jquery attributes
	 * $display :		Creature representation
	 * $effects :		Effects container (inside $display)
	 *
	 * // Normal attributes
	 * x :				Integer :	Hex coordinates
	 * y :				Integer :	Hex coordinates
	 * pos :			Object :	Pos object for hex comparison {x,y}
	 *
	 * name :			String :	Creature name
	 * id :			Integer :	Creature Id incrementing for each creature starting to 1
	 * size :			Integer :	Creature size in hexes (1,2 or 3)
	 * type :			String :	Type of the creature stored in the database. Made up of `creature.realm` + `creature.level`. exception for Dark Priest "--"
	 * team :			Integer :	Owner's ID (0,1,2 or 3)
	 * player :		Player :	Player object shortcut
	 * hexagons :		Array :		Array containing the hexes where the creature is
	 *
	 * dead :			Boolean :	True if dead
	 * stats :			Object :	Object containing stats of the creature
	 * statsAlt :		Object :	Object containing the alteration value for each stat // TODO
	 * abilities :		Array :		Array containing the 4 abilities
	 * remainingMove : Integer :	Remaining moves allowed until the end of turn
	 * temp :           Boolean :   True if the creature is only temporary for preview, false otherwise
	 *
	 */

	// Engine
	game: Game;
	name: UnitName;
	id: number;
	x: number;
	y: number;
	pos: Point;
	size: UnitSize;
	type: CreatureType;
	level: Level;
	realm: Realm;
	animation: { walk_speed: number };
	display: UnitDisplayInfo;
	drop: DropDefinition;
	_movementType: Movement;
	temp: boolean;
	hexagons: Hex[];
	team: PlayerID;
	player: Player;

	// Game
	dead: boolean;
	undead: boolean;
	killer: Player;
	hasWait: boolean;
	travelDist: number;
	effects: Array<Effect>;
	dropCollection: Drop[];
	protectedFromFatigue: boolean;
	turnsActive: number;
	private _nextGameTurnActive: number;
	private _waitedTurn: number;
	private _hinderedTurn: number;
	materializationSickness: boolean;
	noActionPossible: boolean;

	// Statistics
	baseStats: CreatureStats;
	stats: CreatureStats;
	status: Status;
	health: number;
	oldHealth: number;
	endurance: number;
	energy: number;
	oldEnergy: number;
	remainingMove: number;
	/**
	 * Movement banked from previous turns by an ability that stores unused movement
	 * (see `stashedMovementCap()`). Added on top of `this.stats.movement` to form
	 * `this.maxMovement`, and spent first during a turn.
	 */
	movementPool: number;
	abilities: Ability[];
	accumulatedTeleportRange = 0; // Used for Abolished's third ability
	// BRB state — used by Gumble's upgraded Gooey Body to defer death
	_brbActive: boolean;
	_brbState: { killer: Creature | { player: Player }; gooTrap: Trap } | null;
	/** True after BRB has fired once; prevents Gooey Body re-triggering on the follow-up death. */
	_brbSpent: boolean;

	creatureSprite: CreatureSprite;

	/** Procedural Plasma Field visual, shown for Dark Priests with plasma. */
	plasmaField: PlasmaField | null = null;

	/** Base horizontal offset used to center the field on the cardboard's top opaque row. */
	private _plasmaFieldBaseOffsetX = 0;

	/**
	 * The per-frame hook that keeps {@link plasmaField} centred on the priest.
	 * Held so it can be unregistered when the field is torn down.
	 */
	private _plasmaFieldPositionHook: (() => void) | null = null;

	/**
	 * Whether the Plasma Field is currently shown because this Dark Priest is the
	 * active creature. Set when its turn begins and cleared once it performs an
	 * action (so after the turn it reverts to the normal inactive/hover display).
	 */
	private _plasmaFieldActiveTurn = false;

	/**
	 * @constructor
	 * @param{Object} obj - Object containing all creature stats
	 * @param{Game} game - Game instance
	 */
	constructor(
		obj: Unit & {
			// These properties are created by the `summon` method in `player.ts`
			x: number;
			y: number;
			team: PlayerID;
			temp: boolean;
			// These are properties that might not exists on all creatures
			type?: CreatureType;
			drop?: DropDefinition;
			display?: UnitDisplayInfo;
			movementType?: Movement;
			// This depends on player._summonCreaturesWithMaterializationSickness
			materializationSickness?: boolean;
		},
		game: Game,
	) {
		// Engine
		this.game = game;
		this.name = obj.name;
		this.id = game.creatures.length;
		this.x = obj.x - 0;
		this.y = obj.y - 0;
		this.pos = {
			x: this.x,
			y: this.y,
		};
		this.size = obj.size;
		this.type = obj.type;
		this.level = obj.level;
		this.realm = obj.realm;
		this.animation = obj.animation;
		this.display = obj.display;
		this.drop = obj.drop;
		// A unit only leaves its drop behind when it dies, which can be many turns
		// away — so the pickup art is fetched here, while there is still time for
		// it to land, rather than being part of the match preload.
		if (obj.drop) {
			ensureDropTexture(obj.drop.name);
		}
		this._movementType = 'normal';
		this.temp = obj.temp;

		if (obj.movementType) {
			this._movementType = obj.movementType;
		}

		this.hexagons = [];

		// Game
		this.team = obj.team; // = playerID (0,1,2,3)
		this.player = game.players[obj.team];
		this.dead = false;
		this.killer = undefined;
		this.hasWait = false;
		this.travelDist = 0;
		this.effects = [];
		this.dropCollection = [];
		this.protectedFromFatigue = this.isDarkPriest() ? true : false;
		// Safety net for a unit that reaches the board without a placement preview
		// to trigger its own cardboard load — the Dark Priest builds its temp
		// creature before the first preview, and `player.summon` can run straight
		// after a click. Setup already waits for the Dark Priest's own variant, so
		// in practice this is a no-op for it and a genuine request for a summoned
		// unit's board art.
		ensureCardboard(this.isDarkPriest() ? getDarkPriestCardboardKey(this.player) : this.name);
		this.turnsActive = 0;
		this._brbActive = false;
		this._brbState = null;
		this._brbSpent = false;

		// Statistics
		this.baseStats = {
			health: obj.stats.health - 0,
			endurance: obj.stats.endurance - 0,
			regrowth: obj.stats.regrowth - 0,
			energy: obj.stats.energy - 0,
			meditation: obj.stats.meditation - 0,
			initiative: obj.stats.initiative - 0,
			offense: obj.stats.offense - 0,
			defense: obj.stats.defense - 0,
			movement: obj.stats.movement - 0,
			pierce: obj.stats.pierce - 0,
			slash: obj.stats.slash - 0,
			crush: obj.stats.crush - 0,
			shock: obj.stats.shock - 0,
			burn: obj.stats.burn - 0,
			frost: obj.stats.frost - 0,
			poison: obj.stats.poison - 0,
			sonic: obj.stats.sonic - 0,
			mental: obj.stats.mental - 0,

			/* TODO: Move boolean flags into this.status, because updateAlterations() resets
			this.stats unless they've been applied via an effect. */
			moveable: true,
			fatigueImmunity: false,
			// Extra energy required for abilities
			reqEnergy: 0,
		};

		this.stats = {
			...this.baseStats,

			/**
			 * Represents the available "pool" or maximum health of the creature.
			 * `this.health` represents the current remaining health which cannot exceed
			 * this value.
			 */
			health: this.baseStats.health,

			/**
			 * Represents the available "pool" or maximum energy of the creature.
			 * `this.energy` represents the current remaining energy which cannot exceed
			 * this value.
			 */
			energy: this.baseStats.energy,

			/**
			 * Represents the available "pool" or maximum endurance of the creature.
			 * `this.endurance` represents the current remaining endurance which cannot
			 * exceed this value. It also cannot be lower than 0.
			 */
			endurance: this.baseStats.endurance,

			/**
			 * Represents the available "pool" or maximum movement of the creature.
			 * `this.remainingMove` represents the current remaining movement which cannot
			 * exceed this value.
			 */
			movement: this.baseStats.movement,
		};

		this.status = {
			/**
			 * "Frozen" creature will miss their next turn. Frozen expires at the end
			 * of their next (missed) turn. Any damage will break the frozen status.
			 */
			frozen: false,

			/**
			 * "Cryostasis" enhances the "Frozen" status to not break on damage from any
			 * source.
			 */
			cryostasis: false,

			/**
			 * Another type of "Frozen", with a different name.
			 */
			dizzy: false,
		};

		// Current health. Maximum health is `this.stats.health`.
		this.health = obj.stats.health;
		// Current endurance. Maximum endurance is `this.stats.endurance`.
		this.endurance = obj.stats.endurance;
		// Current energy. Maximum energy is `this.stats.energy`.
		this.energy = obj.stats.energy;
		// Current movement. Maximum movement is `this.maxMovement`.
		this.remainingMove = 0; //Default value recovered each turn
		// Movement banked from previous turns. Only abilities granting a
		// `stashedMovementCap()` can fill this; see `stashMovement()`.
		this.movementPool = 0;

		// Abilities
		this.abilities = [
			new Ability(this, 0, game),
			new Ability(this, 1, game),
			new Ability(this, 2, game),
			new Ability(this, 3, game),
		];

		this.updateHex();

		this.creatureSprite = new CreatureSprite(this);

		if (!this.temp) {
			let tempCreature: Creature | undefined = undefined;
			for (const other of game.creatures) {
				if (other && other.type === this.type && other.team === this.team && other.temp) {
					/**
					 *  NOTE:
					 * `this` is the summoned version of `other`
					 *
					 * `this` is a summoned Creature: temp == false.
					 * `other` is an "unmaterialized" Creature: temp == true.
					 *
					 * Use the "unmaterialized" creature's id so that `this` will replace
					 * `other` in `game.creatures`.
					 */
					tempCreature = other;
				}
			}
			if (tempCreature) {
				const oldId = this.id;
				this.id = tempCreature.id;
				tempCreature.destroy();
				// FX state was keyed under oldId; rekey to match the final assigned id.
				if (this.name === 'Infernal') {
					game.animations.rekeyInfernalCardboardEffect(this, oldId);
				}
			}
		}
		// Adding Himself to creature arrays and queue
		game.creatures[this.id] = this;
		if (typeof obj.materializationSickness !== 'undefined') {
			this.materializationSickness = obj.materializationSickness;
		} else {
			this.materializationSickness = this.isDarkPriest() ? false : true;
		}
		this.noActionPossible = false;

		this._nextGameTurnActive =
			!this.materializationSickness || this.isDarkPriest() ? this.game.turn : this.game.turn + 1;
		this._waitedTurn = -1;
		this._hinderedTurn = -1;
	}

	// NOTE: These fields previously existed on Creature
	// but are now part of their own class.
	// TODO: These should be factored out when possible,
	// as their use constitutes a Demeter violation.
	get grp() {
		return this.creatureSprite.grp;
	}
	get sprite() {
		return this.creatureSprite.sprite;
	}

	get legacyProjectileEmissionPoint() {
		return this.creatureSprite.legacyProjectileEmissionPoint;
	}

	/**
	 * Summon animation.
	 */
	summon(disableMaterializationSickness = false) {
		const game = this.game;

		if (disableMaterializationSickness) {
			this.materializationSickness = false;
		}

		game.updateQueueDisplay();

		game.grid.orderCreatureZ();

		// Materialization fade-in: 1 second per occupied hex
		const fadeMs = 1000 * this.size;
		// The cardboard comes in at the ghost opacity the player was just
		// previewing, so the confirmed unit rises out of the ghost rather than
		// popping into existence — the ghost itself fades out over the same span
		// (see HexGrid.fadeOutTempCreature).
		this.creatureSprite.setAlpha(GHOST_PREVIEW_ALPHA, 0);
		game.grid.fadeOutTempCreature(undefined, fadeMs);
		this.creatureSprite.setAlpha(1, fadeMs);
		setTimeout(() => {
			if (this.dead) {
				return;
			}

			const materializedGroup = this.creatureSprite?.grp;
			if (materializedGroup && materializedGroup.alpha < 1) {
				this.creatureSprite.setAlpha(1);
			}
		}, fadeMs + 50);

		// Ghost creatures in front so the materializing unit is spotlighted
		this.hexagons.forEach((hex) => hex.ghostOverlap(this));
		setTimeout(() => {
			if (!game.grid) return;
			if (game.grid.lastXrayHex) {
				game.grid.xray(game.grid.lastXrayHex);
			} else {
				game.creatures.forEach((c) => {
					if (c instanceof Creature) c.xray(false);
				});
			}
		}, fadeMs + 600);

		// Reveal and position health indicator
		this.updateHealth();
		this.healthShow();

		// Trigger trap under
		this.hexagons.forEach((hex) => {
			hex.activateTrap(game.triggers.onStepIn, this);
		});

		// Pickup drop
		this.pickupDrop();
		if (!(this as CreatureRuntimeFlags).hideFromQueue) {
			this.hint(this.name, 'creature_name');
		}
	}

	healthHide() {
		this.creatureSprite.showHealth(false);
	}

	healthShow() {
		this.creatureSprite.showHealth(true);
	}

	/**
	 * Activate the creature by showing movement range and binding controls to this creature
	 */
	activate() {
		this.travelDist = 0;
		this.oldEnergy = this.energy;
		this.oldHealth = this.health;
		this.noActionPossible = false;

		// Show the Plasma Field for an active Dark Priest with plasma so the player
		// can see their shield during their own turn. Cleared in deactivate() once
		// the creature performs an action.
		this._plasmaFieldActiveTurn = this.isDarkPriest() && this.hasCreaturePlayerGotPlasma();

		const game = this.game;
		const stats = this.stats;
		const varReset = () => {
			this.game.onReset(this);
			// Variables reset
			this.updateAlteration();
			this.remainingMove = this.maxMovement;

			if (!this.materializationSickness) {
				// Fatigued creatures (endurance 0) should not regenerate.
				if (!this.isFatigued()) {
					this.heal(stats.regrowth, true);

					if (stats.meditation > 0) {
						this.recharge(stats.meditation);
					}
				} else {
					if (stats.regrowth < 0) {
						this.heal(stats.regrowth, true);
					} else {
						this.hint('♦', 'damage');
					}
				}
			} else {
				this.hint('♣', 'damage');
			}

			setTimeout(() => {
				game.UI.energyBar.animSize(this.energy / stats.energy);
				game.UI.healthBar.animSize(this.health / stats.health);
			}, 1000);

			this.endurance = stats.endurance;

			this.abilities.forEach((ability) => {
				ability.reset();
				if (!ability.upgraded && ability.usesLeftBeforeUpgrade() === 0) {
					ability.setUpgraded();
				}
			});
		};
		varReset.bind(this);

		// Frozen or dizzy effect
		if (this.isFrozen() || this.isDizzy()) {
			varReset();
			const interval = setInterval(() => {
				if (!game.turnThrottle) {
					clearInterval(interval);
					game.skipTurn({
						tooltip: this.isFrozen() ? 'Frozen' : 'Dizzy',
					});
				}
			}, 50);
			return;
		}

		// Dazzled effect — ronin units whose Dark Priest has been killed in 2vs2
		if (this.player.hasLost) {
			varReset();
			const interval = setInterval(() => {
				if (!game.turnThrottle) {
					clearInterval(interval);
					game.skipTurn({
						tooltip: 'Dazzled',
					});
				}
			}, 50);
			return;
		}

		// BRB state — Gumble's upgraded Gooey Body deferred revival
		if (this._brbState) {
			varReset();
			const brbState = this._brbState;
			const brbInterval = setInterval(() => {
				if (!game.turnThrottle) {
					clearInterval(brbInterval);

					// Trap hex is occupied — skip this turn and try again next
					if (brbState.gooTrap.hex.creature) {
						game.skipTurn({ tooltip: 'BRB' });
						return;
					}

					// Hex is free — revive!
					this._brbSpent = false; // reset so ability can fire again if Gumble dies later
					this._brbState = null;
					this.x = brbState.gooTrap.x;
					this.y = brbState.gooTrap.y;
					this.pos = { x: this.x, y: this.y };
					this.health = this.stats.health;
					this.energy = this.stats.energy;
					this.endurance = this.stats.endurance;
					this.updateHex();
					this.facePlayerDefault();

					// Revive with rise animation (inverse of melt)
					const reviveFadeMs = 1000;
					this.creatureSprite.setAngle(0, 0);
					this.creatureSprite.setHex(brbState.gooTrap.hex, 0);

					// Fade trap out while Gumble rises back in
					brbState.gooTrap.hide(reviveFadeMs);
					setTimeout(() => brbState.gooTrap.destroy(), reviveFadeMs);
					this.healthShow();
					this.updateHealth();

					game.animations.rise(this, {
						callback: () => {
							game.updateQueueDisplay();
							game.grid.updateDisplay();
						},
						overrideSpeed: reviveFadeMs,
					});

					game.log('%CreatureName' + this.id + '% rises from the goo!');
					this.hint('Back!', 'msg_effects');

					setTimeout(() => {
						game.startTimer();
						this.queryMove(null);
					}, reviveFadeMs);
				}
			}, 50);
			return;
		}

		if (!this.hasWait) {
			varReset();

			// Trigger
			// @ts-expect-error 2554
			game.onStartPhase(this);
		}

		this.materializationSickness = false;

		const interval = setInterval(() => {
			// if (!game.freezedInput) { remove for muliplayer
			clearInterval(interval);
			if (game.turn >= game.minimumTurnBeforeFleeing) {
				game.UI.btnFlee?.changeState('normal');
			}

			game.startTimer();
			this.queryMove(null);
			game.grid?.refreshHoverState();
			// }
		}, 1000);

		// Apply active-unit xray immediately; queryMove() starts after a delay and
		// can otherwise leave one-hex units visually hidden during turn handoff.
		game.grid.refreshActiveCreatureXray();
		this.xray(false);

		// Elevate health indicator above all creatures while this unit is active
		this.startBounce();
	}

	/**
	 * Deactivate the creature. Called when the creature is active, then is no longer active.
	 *
	 * @param {'wait' | 'turn-end'} reason: Why is the creature deactivated?
	 */
	deactivate(reason: 'wait' | 'turn-end') {
		const game = this.game;
		// Skip / Delay are NOT actions that hide the Plasma Field — the turn just
		// ends and the priest becomes inactive (or starts a fresh turn), so the
		// field is kept by the normal inactive / hover display. We deliberately
		// don't touch `_plasmaFieldActiveTurn` here, otherwise the priest would be
		// briefly still flagged active during the turn handoff and any updateHealth
		// call would destroy and re-create the field (a flicker for no reason).
		// De-elevate health indicator when this unit is no longer active
		this.resetBounce();
		this.status.frozen = false;
		this.status.cryostasis = false;
		this.status.dizzy = false;
		// Effects triggers
		if (reason === 'turn-end') {
			// Prevent queryMove() from replaying hover on the old mouse hex during
			// turn handoff, which can briefly render the active unit preview at cursor.
			game.grid.lastMouseHex = undefined;
			game.grid.suppressNextHoverRefresh = true;
			this.stashMovement();
			this.queryMove(null);
			this.turnsActive += 1;
			this._nextGameTurnActive = game.turn + 1;
			// @ts-expect-error 2554
			game.onEndPhase(this);
		}
		this.hasWait = this.isDelayed;
	}

	get isInCurrentQueue() {
		return !this.dead && !this.temp && this._nextGameTurnActive <= this.game.turn;
	}

	get isInNextQueue() {
		return !this.dead;
	}

	get isDelayedInNextQueue(): null | boolean {
		if (!this.isInNextQueue) return null;
		return !this.isInCurrentQueue && this.isDelayed;
	}

	/**
	 * @deprecated Use isDelayed
	 */
	get delayed() {
		return this.isDelayed;
	}

	get isDelayed() {
		return this.isWaiting || this.isHindered;
	}

	get isWaiting() {
		return this._waitedTurn >= this.turnsActive;
	}

	get isHindered() {
		return this._hinderedTurn >= this.turnsActive;
	}

	/**
	 * @deprecated Use canWait
	 */
	get delayable() {
		return this.canWait;
	}

	/**
	 * Is waiting possible?
	 */
	get canWait() {
		const hasUnusedAbilities = this.abilities.some((a) => !a.used);
		return !this.isDelayed && this.remainingMove > 0 && hasUnusedAbilities;
	}

	/**
	 * The creature waits. It will have its turn at the end of the round.
	 * The player has decided to delay the creature until the end of the turn.
	 */
	wait(): void {
		if (this.canWait) {
			const game = this.game;

			this._waitedTurn = this.turnsActive;
			this.hint('Delayed', 'msg_effects');
			game.updateQueueDisplay();
			this.deactivate('wait');
		}
	}

	/**
	 * A creature's turn is delayed as part of an attack from another creature.
	 */
	hinder(): void {
		const game = this.game;

		this._hinderedTurn = this.turnsActive;
		this.hint('Delayed', 'msg_effects');
		game.updateQueueDisplay();
	}

	/**
	 * Launch move action query
	 */
	// TODO: type `args` in `QueryMoveOptions`
	queryMove(options?: QueryMoveOptions) {
		const game = this.game;

		if (this.dead) {
			// Creatures can die during their turns from trap effects; make sure this
			// function doesn't do anything
			return;
		}

		// Release any animation freeze that was held by a deferred ability end.
		if (game._deferredQueryMovePending > 0) {
			game._deferredQueryMovePending--;
		}
		if (game._deferredQueryMovePending === 0 && game.animationQueue.length === 0) {
			if (game.multiplayer) {
				game.freezedInput = game.UI.active ? false : true;
			} else {
				game.freezedInput = false;
			}
		}

		// Once Per Damage Abilities recover
		game.creatures.forEach((creature) => {
			//For all Creature
			if (creature) {
				creature.abilities.forEach((ability) => {
					if (game.triggers.oncePerDamageChain.test(ability.getTrigger())) {
						ability.setUsed(false);
					}
				});
			}
		});

		// Clean up any abandoned temporary creatures left over from cancelled summons.
		// Only removing the last element was insufficient when other creatures were
		// added to game.creatures after an orphaned temp, leaving it stranded.
		const tempCreatures = game.creatures.filter((c) => c?.temp);
		tempCreatures.forEach((c) => c.destroy());

		let remainingMove = this.remainingMove;
		// No movement range if unmoveable
		if (!this.stats.moveable) {
			remainingMove = 0;
		}

		const defaultOptions = {
				targeting: false,
				noPath: false,
				isAbility: false,
				ownCreatureHexShade: true,
				range: game.grid.getMovementRange(this.x, this.y, remainingMove, this.size, this.id),
				callback: function (hex: Hex, args) {
					if (hex.x == args.creature.x && hex.y == args.creature.y) {
						// Prevent null movement
						game.activeCreature?.queryMove();
						return;
					}

					if (game.grid.materialize_overlay) {
						const creature = game.retrieveCreatureStats(game.activeCreature.type);
						game.gameEngine
							.tween(game.grid.materialize_overlay)
							.to(
								{
									alpha: 0,
								},
								creature.animation.walk_speed,
								Easing.Linear.None,
							)
							.start();
					}

					// Calculate the path once here so the exact same route is recorded
					// in the gamelog, sent to the other multiplayer client, AND animated
					// locally — one canonical record instead of three independently-built
					// descriptions of the same move. See Creature.moveTo()'s `opts.path`
					// handling and Game.action()'s 'move' case (the same dispatcher used
					// for saved-log replay) for why the applier must not recalculate this.
					const isFlying = args.creature.movementType() === 'flying';
					const movePath = isFlying ? [hex] : args.creature.calculatePath({ x: hex.x, y: hex.y });
					const moveRecord = {
						action: 'move' as const,
						target: {
							x: hex.x,
							y: hex.y,
						},
						path: movePath.map((pathHex) => ({ x: pathHex.x, y: pathHex.y })),
					};
					game.gamelog.add(moveRecord);
					if (game.multiplayer) {
						game.sendMultiplayerMove(moveRecord.target, moveRecord.path);
					}
					game.UI.btnDelay.changeState('disabled');
					args.creature.moveTo(hex, {
						animation: isFlying ? 'fly' : 'walk',
						path: movePath,
						callback: function () {
							game.activeCreature?.queryMove();
						},
					});
				},
			},
			// Overwrite any fields of `defaultOptions` that were provided in `options`
			o =
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				typeof ($j as any)?.extend === 'function'
					? // eslint-disable-next-line @typescript-eslint/no-explicit-any
					  ($j as any).extend(defaultOptions, options)
					: { ...defaultOptions, ...(options || {}) };

		if (!o.isAbility) {
			if (game.UI.selectedAbility != -1) {
				this.hint('Canceled', 'gamehintblack');
			}

			// In test environments jQuery might not be initialized; guard DOM ops
			if (typeof ($j as unknown as { [key: string]: unknown }) === 'function') {
				($j as unknown as (selector: string) => { removeClass: (cls: string) => void })(
					'#abilities .ability',
				).removeClass('active');
			}
			if (game.UI?.selectAbility) {
				game.UI.selectAbility(-1);
			}
			if (game.UI?.updateQueueDisplay) {
				game.UI.updateQueueDisplay();
			}
		}

		game.grid.orderCreatureZ();
		this.facePlayerDefault();
		this.updateHealth();

		// Ghost creatures that visually obstruct the active creature.
		// nextCreature() already called clearAllXray() which only fades out without
		// re-triggering ghostOverlap for the old unit, so it is safe to start the
		// new fade-in immediately.
		game.grid.refreshActiveCreatureXray();
		this.xray(false); // active creature itself must never be xrayed
		if (this.movementType() === 'flying') {
			o.range = game.grid.getFlyingRange(this.x, this.y, remainingMove, this.size, this.id);
		}

		const selectNormal = function (hex, args) {
			if (!game.grid.isRefreshingHoverState) {
				game.grid.redoLastQuery();
			}
			args.creature.tracePath(hex);
		};

		const selectFlying = function (hex, args) {
			if (!game.grid.isRefreshingHoverState) {
				game.grid.redoLastQuery();
			}
			const creature = game.retrieveCreatureStats(game.activeCreature.type);
			game.grid.previewCreature(hex, creature, game.activePlayer);
			args.creature.tracePosition({
				x: hex.x,
				y: hex.y,
				overlayClass: 'creature moveto selected player' + args.creature.team,
			});
		};
		const select = o.noPath || this.movementType() === 'flying' ? selectFlying : selectNormal;

		if (this.noActionPossible) {
			// Bots handle their own skip turn — don't show the human-facing hint/UI
			if (this.player.controller !== 'bot') {
				const buttonElement = game.UI.btnSkipTurn.$button;

				buttonElement.addClass('bounce');
				// In unit tests or headless environments, grid query APIs may be absent
				if (typeof (game.grid as unknown as { querySelf?: unknown })?.querySelf === 'function') {
					game.grid.querySelf({
						fnOnConfirm: function () {
							game.UI.btnSkipTurn.click();
						},
						// eslint-disable-next-line @typescript-eslint/no-empty-function
						fnOnCancel: function () {},
						confirmText: 'Skip turn',
					});
				}
			} else {
				// getMovementRange above calls cleanReachable() which marks all hexes
				// reachable (showing them as outline hexagons). Clean that up since bots
				// don't go through querySelf/queryHexes in this path.
				game.grid.updateDisplay();
				game.grid.forEachHex((hex) => hex.unsetReachable());
			}
		} else {
			// In unit tests or headless environments, guard against missing queryHexes()
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if (typeof (game.grid as any)?.queryHexes === 'function') {
				game.grid.queryHexes({
					fnOnSelect: select,
					fnOnConfirm: o.callback,
					fillHexOnHover: false,
					args: {
						creature: this,
						args: o.args,
					}, // Optional args
					size: this.size,
					flipped: this.player.flipped,

					id: this.id,
					hexes: o.range,
					ownCreatureHexShade: o.ownCreatureHexShade,
					targeting: o.targeting,
				});
			}
		}
	}

	/**
	 * Preview the creature position at the given Hex
	 * @param{Hex} hex - Position
	 */
	previewPosition(hex: Hex) {
		const game = this.game;
		game.grid.allhexes.forEach((gridHex) =>
			gridHex.cleanOverlayVisualState('hover h_player' + this.team),
		);
		if (!game.grid.hexes[hex.y][hex.x].isWalkable(this.size, this.id)) {
			return; // Break if not walkable
		}

		const creat = game.retrieveCreatureStats(game.activeCreature.type);
		game.grid.previewCreature(hex.pos, creat, game.activePlayer);

		this.tracePosition({
			x: hex.x,
			y: hex.y,
			overlayClass: 'hover h_player' + this.team,
		});
	}

	startBounce() {
		this.creatureSprite.elevateHealth(true);
		this.creatureSprite.setHealthBounce(true);
	}

	resetBounce() {
		this.creatureSprite.setHealthBounce(false);
		this.creatureSprite.elevateHealth(false);
	}

	/**
	 * Clean current creature hexagons
	 */
	cleanHex() {
		this.hexagons.forEach((hex) => {
			hex.creature = undefined;
		});
		this.hexagons = [];
	}

	/**
	 * Update the current hexes containing the creature and their display
	 */
	updateHex() {
		const count = this.size;
		let i;

		for (i = 0; i < count; i++) {
			this.hexagons.push(this.game.grid.hexes[this.y][this.x - i]);
		}

		this.hexagons.forEach((hex) => {
			hex.creature = this;
		});
	}

	highlightCurrentHexesAsDashed() {
		const dashedTexture = `hex_dashed_p${this.player.id}`;
		this.hexagons.forEach((hex) => {
			if (hex.display.key !== dashedTexture) {
				hex.display.setTexture(dashedTexture);
			}
		});
	}

	clearDashedOverlayOnHexes() {
		const playerTexture = `hex_p${this.player.id}`;
		this.hexagons.forEach((hex) => {
			if (hex.display.key !== playerTexture) {
				hex.display.setTexture(playerTexture);
			}
		});
	}

	/**
	 * Face creature at given hex
	 * @param{Hex | Creature} facefrom - Hex to face from
	 * @param{Hex | Creature} faceto - Hex to face
	 */
	faceHex(
		faceto: Hex | Creature,
		facefrom?: Hex | Creature,
		ignoreCreaHex?: boolean,
		attackFix?: boolean,
	) {
		if (!facefrom) {
			facefrom = this.player.flipped ? this.hexagons[this.size - 1] : this.hexagons[0];
		}

		if (!facefrom) {
			this.facePlayerDefault();
			return;
		}

		if (
			ignoreCreaHex &&
			faceto instanceof Hex &&
			facefrom instanceof Hex &&
			this.hexagons.indexOf(faceto) != -1 &&
			this.hexagons.indexOf(facefrom) != -1
		) {
			this.facePlayerDefault();
			return;
		}

		if (faceto instanceof Creature) {
			if (faceto === this) {
				this.facePlayerDefault();
				return;
			}
			faceto = faceto.size < 2 ? faceto.hexagons[0] : faceto.hexagons[1];
		}

		if (!faceto) {
			this.facePlayerDefault();
			return;
		}

		if (faceto.x == facefrom.x && faceto.y == facefrom.y) {
			this.facePlayerDefault();
			return;
		}

		if (attackFix && this.size > 1) {
			//only works on 2hex creature targeting the adjacent row
			const flipOffset = this.player.flipped ? 1 : 0;
			if (facefrom.y % 2 === 0) {
				if (faceto.x - flipOffset == facefrom.x) {
					this.facePlayerDefault();
					return;
				}
			} else {
				if (faceto.x + 1 - flipOffset == facefrom.x) {
					this.facePlayerDefault();
					return;
				}
			}
		}

		const flipped = facefrom.y % 2 === 0 ? faceto.x <= facefrom.x : faceto.x < facefrom.x;
		this.creatureSprite.setDir(flipped ? -1 : 1);
	}

	/**
	 * Make creature face the default direction of its player
	 */
	facePlayerDefault() {
		this.creatureSprite.setDir(this.player.flipped ? -1 : 1);
	}

	/**
	 * Move the creature along a calculated path to the given coordinates
	 * @param{Hex} hex - Destination Hex
	 * @param{Object} opts - Optional args object
	 */
	moveTo(hex: Hex, opts) {
		const game = this.game;

		// The active Dark Priest committing to a move has performed an action,
		// so its Plasma Field should no longer be shown just for being active.
		if (game.activeCreature?.id === this.id) {
			this.hideActivePlasmaShield();
		}

		const defaultOpt = {
			callback: function () {
				return true;
			},
			callbackStepIn: function () {
				return true;
			},
			animation: this.movementType() === 'flying' ? 'fly' : 'walk',
			ignoreMovementPoint: false,
			ignorePath: false,
			customMovementPoint: 0,
			overrideSpeed: 0,
			turnAroundOnComplete: true,
		};
		let path;

		opts = $j.extend(defaultOpt, opts);
		const userCallback = opts.callback;
		opts.callback = () => {
			userCallback();
			if (game.activeCreature?.id === this.id) {
				game.UI.checkAbilities();
				game.UI.selectAbility(-1);
			}
			game.channels.creature.emit('movementComplete', { creature: this, hex });
			// @ts-expect-error 2554
			game.onCreatureMove(this, hex); // Trigger
		};

		// Teleportation ignores moveable
		if (this.stats.moveable || opts.animation === 'teleport') {
			const x = hex.x;
			const y = hex.y;

			// In multiplayer, the acting client sends the exact path it already
			// calculated (see Creature.queryMove()) so the receiving client replays
			// that same path instead of re-running pathfinding against its own grid
			// state. Two clients independently calling calculatePath() can walk
			// different (or even unreachable) routes if their grid state has
			// drifted apart even slightly, visibly desyncing where the creature
			// ends up. `opts.path`, when given, is the source of truth.
			if (opts.path && opts.path.length) {
				path = opts.path;
			} else if (opts.ignorePath || opts.animation == 'fly') {
				path = [hex];
			} else {
				path = this.calculatePath({ x, y });
			}

			if (path.length === 0) {
				return; // Break if empty path
			}

			game.grid.xray(new Hex(0, 0, null, game)); // Clean Xray

			this.travelDist = 0;

			game.animations[opts.animation](this, path, opts);
		} else {
			game.log('This creature cannot be moved');
		}
	}

	/**
	 * Trace the path from the current position to the given coordinates
	 * @param{Point} destination: the end of the path.
	 */
	tracePath(destination: Point) {
		const path = this.calculatePath(destination); // Store path in grid to be able to compare it later

		if (path.length === 0) {
			return; // Break if empty path
		}

		// Clean the previous preview footprint before painting the new path.
		// Otherwise previewCreature() can erase penultimate adj hexes that overlap
		// the previous destination after the new path has already been drawn.
		const last = arrayUtils.last(path) as { x: number; y: number };
		const creature = this.game.retrieveCreatureStats(this.game.activeCreature.type);
		this.game.grid.previewCreature(last, creature, this.game.activePlayer);

		path.forEach((item: { x: number; y: number }) => {
			this.tracePosition({
				x: item.x,
				y: item.y,
				displayClass: 'adj',
				drawOverCreatureTiles: false,
			});
		}); // Trace path

		// Highlight final position
		this.tracePosition({
			x: last.x,
			y: last.y,
			overlayClass: 'creature moveto selected player' + this.team,
			drawOverCreatureTiles: false,
		});
	}

	tracePosition(args: TracePositionOptions) {
		const defaultArgs = {
			x: this.x,
			y: this.y,
			overlayClass: '',
			displayClass: '',
			drawOverCreatureTiles: true,
		};
		args = $j.extend(defaultArgs, args);

		for (let i = 0; i < this.size; i++) {
			let canDraw = true;

			if (!args.drawOverCreatureTiles) {
				// then check to ensure this is not a creature tile
				for (let j = 0; j < this.hexagons.length; j++) {
					if (this.hexagons[j].x == args.x - i && this.hexagons[j].y == args.y) {
						canDraw = false;
						break;
					}
				}
			}
			if (canDraw) {
				const hex = this.game.grid.hexes[args.y][args.x - i];
				this.game.grid.cleanHex(hex);
				hex.overlayVisualState(args.overlayClass);
				hex.displayVisualState(args.displayClass);
			}
		}
	}

	/**
	 * @param{Point} destination: the end of the path.
	 * @returns{Point[]} Array containing the path points.
	 */
	calculatePath(destination: Point) {
		const game = this.game;

		return search(
			game.grid.hexes[this.y][this.x],
			game.grid.hexes[destination.y][destination.x],
			this.size,
			this.id,
			this.game.grid,
		); // Calculate path
	}

	/**
	 * Return the first possible position for the creature at the given coordinates
	 * @param{number} x - Integer, Destination coordinates
	 * @param{number} y - Integer, Destination coordinates
	 * @returns{Object} New position taking into acount the size, orientation and obstacle {x,y}
	 */
	calcOffset(x: number, y: number) {
		const game = this.game,
			offset = game.players[this.team].flipped ? this.size - 1 : 0,
			mult = game.players[this.team].flipped ? 1 : -1; // For FLIPPED player

		for (let i = 0; i < this.size; i++) {
			// Try next hexagons to see if they fit
			if (x + offset - i * mult >= game.grid.hexes[y].length || x + offset - i * mult < 0) {
				continue;
			}

			if (game.grid.hexes[y][x + offset - i * mult].isWalkable(this.size, this.id)) {
				x += offset - i * mult;
				break;
			}
		}

		return {
			x: x,
			y: y,
		};
	}

	/**
	 * @returns{number} Initiative value to order the queue
	 */
	getInitiative(): number {
		// To avoid 2 identical initiative
		return this.stats.initiative * 500 - this.id;
	}

	/**
	 * @param{number} distance - Integer, Distance in hexagons
	 * @returns{Hex[]} Array of adjacent hexagons
	 */
	adjacentHexes(distance: number): Hex[] {
		const hash = hashOffsetCoords;
		const closed = new Set<number>(this.hexagons.map(hash));
		const close = (point: Point) => closed.add(hash(point));
		const isClosed = (point: Point) => closed.has(hash(point));
		const isInBounds = (point: Point) => this.game.grid.isInBounds(point);

		let atCurrRadius = this.hexagons;
		let atNextRadius = [];

		const result = [];

		for (let _ = 0; _ < distance; _++) {
			for (const point of atCurrRadius) {
				for (const neighbor of offsetNeighbors(point)) {
					if (isInBounds(neighbor) && !isClosed(neighbor)) {
						atNextRadius.push(neighbor);
						result.push(neighbor);
						close(neighbor);
					}
				}
			}
			atCurrRadius = atNextRadius;
			atNextRadius = [];
		}

		// NOTE: This is the previous implementation's sort order. Kept for consistency.
		// Sort ascending, first by row, then by column.
		result.sort((a, b) => a.x + (a.y << 16) - (b.x + (b.y << 16)));
		return result.map((point) => this.game.grid.hexAt(point.x, point.y));
	}

	/**
	 * @param {number} amount: amount of energy to restore
	 * @return {void}
	 * Restore energy up to the max limit
	 */
	recharge(amount: number, log = true) {
		const before = this.energy;
		this.energy = Math.min(this.stats.energy, this.energy + amount);
		const delta = this.energy - before;

		if (log && delta > 0) {
			this.game.log('%CreatureName' + this.id + '% recovers +' + delta + ' energy');
		}
	}

	/**
	 * Restore endurance to a creature. Will be capped against the creature's maximum
	 * endurance (this.stats.endurance).
	 * @param {*} amount Number of endurance points to restore.
	 */
	restoreEndurance(amount: number, log = true) {
		this.endurance = Math.min(this.stats.endurance, this.endurance + amount);

		if (log) {
			this.game.log('%CreatureName' + this.id + '% recovers +' + amount + ' endurance');
		}
	}

	/**
	 * Restore remaining movement to a creature. Will be capped against the creature's
	 * maximum movement (this.maxMovement).
	 *
	 * @param {*} amount Number of movement points to restore.
	 */
	restoreMovement(amount: number, log = true) {
		this.remainingMove = Math.min(this.maxMovement, this.remainingMove + amount);

		if (log) {
			this.game.log('%CreatureName' + this.id + '% recovers +' + amount + ' movement');
		}
	}

	/**
	 * @param{number} amount - Amount of health point to restore
	 */
	heal(amount: number, isRegrowth = false, log = true) {
		const game = this.game;
		// Cap health point
		amount = Math.min(amount, this.stats.health - this.health);

		if (this.health + amount < 1) {
			amount = this.health - 1; // Cap to 1hp
		}

		this.health += amount;

		// Health display Update
		this.updateHealth(isRegrowth);

		if (amount > 0) {
			if (isRegrowth) {
				this.hint('+' + amount + ' ♥', 'healing');
			} else {
				this.hint('+' + amount, 'healing');
			}

			if (log) {
				game.log('%CreatureName' + this.id + '% recovers +' + amount + ' health');
			}
		} else if (amount === 0) {
			if (isRegrowth) {
				this.hint('♦', 'msg_effects');
			} else {
				this.hint('!', 'msg_effects');
			}
		} else {
			if (isRegrowth) {
				this.hint(amount + ' ♠', 'damage');
			} else {
				this.hint(amount + '', 'damage');
			}

			if (log) {
				game.log('%CreatureName' + this.id + '% loses ' + amount + ' health');
			}
		}

		// @ts-expect-error 2554
		game.onHeal(this, amount);
	}

	/**
	 * @param{Damage} damage - Damage object
	 * @returns{Object} Contains damages dealt and if creature is killed or not
	 * TODO: Once all files in `abilities` are converted to TS, consider a more representative name for `o`
	 */
	takeDamage(
		damage: Damage,
		o?: { isFromTrap?: boolean; ignoreRetaliation?: boolean },
	): { damages?: DamageResult; kill: boolean; damageObj?: Damage } {
		const game = this.game;

		if (this.dead) {
			console.info(`${this.name} (${this.id}) is already dead, aborting takeDamage call.`);
			return { kill: false };
		}

		const defaultOpt = {
			ignoreRetaliation: false,
			isFromTrap: false,
		};

		o = $j.extend(defaultOpt, o);
		// Determine if melee attack
		damage.melee = false;
		this.adjacentHexes(1).forEach((hex) => {
			if (damage.attacker == hex.creature) {
				damage.melee = true;
			}
		});

		damage.target = this;
		damage.isFromTrap = o.isFromTrap;

		// Trigger
		game.onUnderAttack(this, damage);
		game.onAttack(damage.attacker, damage);

		// Calculation
		if (damage.status === '') {
			// Damages
			const dmg = damage.applyDamage();
			const dmgAmount = dmg.total;

			if (!isFinite(dmgAmount)) {
				// Check for Damage Errors
				this.hint('Error', 'damage');
				game.log('Oops something went wrong !');

				return {
					damages: { total: 0 },
					kill: false,
				};
			}

			this.health -= dmgAmount;
			this.health = this.health < 0 ? 0 : this.health; // Cap

			this.addFatigue(dmgAmount);

			// Display
			const nbrDisplayed = dmgAmount ? '-' + dmgAmount : 0;
			this.hint(nbrDisplayed + '', 'damage');

			if (!damage.noLog) {
				game.log('%CreatureName' + this.id + '% is hit : ' + nbrDisplayed + ' health');
			}

			// If Health is empty
			if (this.health <= 0) {
				const deathIntercepted = this.abilities.some(
					(ability) =>
						typeof ability.interceptDeath === 'function' && ability.interceptDeath(damage.attacker),
				);

				if (deathIntercepted) {
					this.updateHealth();
					game.UI.updateFatigue();
					game.UI.checkAbilities();

					if (!o.ignoreRetaliation) {
						// @ts-expect-error 2554
						game.onDamage(this, damage);
					}

					return {
						damages: dmg,
						damageObj: damage,
						kill: false,
					};
				}

				this.die(damage.attacker);

				return {
					damages: dmg,
					damageObj: damage,
					kill: true,
				}; // Killed
			}

			// Effects
			damage.effects.forEach((effect) => {
				this.addEffect(effect);
			});

			// Unfreeze if taking non-zero damage and not a Cryostasis freeze.
			if (dmgAmount > 0 && !this.isInCryostasis()) {
				this.status.frozen = false;
			}

			// Health display Update
			// Note: update health after adding effects as some effects may affect
			// health display
			this.updateHealth();
			game.UI.updateFatigue();
			/* Some of the active creature's abilities may become active/inactive depending
			on new health/endurance values. */
			game.UI.checkAbilities();

			// Trigger
			if (!o.ignoreRetaliation) {
				// @ts-expect-error 2554
				game.onDamage(this, damage);
			}

			return {
				damages: dmg,
				damageObj: damage,
				kill: false,
			}; // Not Killed
		} else {
			if (damage.status == 'Dodged') {
				// If dodged
				if (!damage.noLog) {
					game.log('%CreatureName' + this.id + '% dodged the attack');
				}
			}

			if (damage.status == 'Shielded') {
				// If Shielded
				if (!damage.noLog) {
					game.log('%CreatureName' + this.id + '% shielded the attack');
				}
			}

			if (damage.status == 'Disintegrated') {
				// If Disintegrated
				if (!damage.noLog) {
					game.log('%CreatureName' + this.id + '% has been disintegrated');
				}
				this.die(damage.attacker);
			}

			// Hint
			this.hint(damage.status, 'damage');
		}

		return {
			damageObj: damage,
			kill: false,
		}; // Not killed
	}

	updateHealth(noAnimBar = false) {
		// Dead creatures stay in `game.creatures` and their effects stay in
		// `game.effects`, so a round-start effect teardown can refresh a sprite
		// whose Phaser objects are already freed (see CreatureSprite.destroyed).
		if (this.creatureSprite.destroyed) return;
		const game = this.game;

		if (this == game.activeCreature && !noAnimBar) {
			game.UI.healthBar.animSize(this.health / this.stats.health);
		}

		// Dark Priest plasma shield: shown for inactive priests with plasma, and
		// for the active priest too — until it performs an action and the flag is
		// cleared in deactivate().
		if (this.isDarkPriest()) {
			if (
				this.hasCreaturePlayerGotPlasma() &&
				(this !== game.activeCreature || this._plasmaFieldActiveTurn)
			) {
				this.displayPlasmaShield();
			} else {
				this.displayHealthStats();
			}
		} else {
			this.displayHealthStats();
		}
	}

	displayHealthStats() {
		// Hide (don't destroy) the field so that re-showing it on the next
		// hover/display toggle resumes the animation from where it left off
		// instead of recreating it and resetting the plasma flow.
		this.hidePlasmaShield();
		this.creatureSprite.setHealth(this.health, this.isFrozen() ? 'frozen' : 'health');
	}

	displayPlasmaShield() {
		this.creatureSprite.setHealth(this.player.plasma, 'plasma');

		// Inactive or active (until it acts), a Dark Priest with plasma shows the
		// procedural field.
		if (!this.hasCreaturePlayerGotPlasma()) {
			this.removePlasmaShield();
			return;
		}

		this.showPlasmaShield();
	}

	/**
	 * Hide the Plasma Field that is shown because this Dark Priest is the active
	 * creature. Called the moment the priest performs an action (moving or using
	 * an ability), so the field only stays up until it acts — much like the
	 * active-unit indicator / Delay button collapsing once you commit a turn.
	 * After this, the normal inactive / hover display takes over.
	 */
	hideActivePlasmaShield() {
		if (!this._plasmaFieldActiveTurn) return;
		this._plasmaFieldActiveTurn = false;
		this.removePlasmaShield();
	}

	/** Ensures the procedural Plasma Field visual exists and is visible. */
	private showPlasmaShield() {
		const gameEngine = this.game.gameEngine;
		if (!gameEngine || !this.creatureSprite.grp) {
			return;
		}

		if (!this.plasmaField) {
			const cardboard = this.creatureSprite.sprite;
			const hueShift = PLASMA_FIELD_HUE_BY_COLOR[this.player.color] || 0;

			// On lower-end machines, reduce the plasma field rendering cost by
			// lowering its internal render resolution.
			this._plasmaFieldBaseOffsetX = computeCardboardCenterOffset(gameEngine, cardboard);
			const offsetXMirror = (cardboard.scaleX < 0 ? -1 : 1) * this._plasmaFieldBaseOffsetX;

			const opts: Record<string, unknown> = {
				parent: this.creatureSprite.grp,
				hueShift,
				creature: this,
			};
			if (detectWeakHardware()) {
				// 4-core (and below) machines: keep the field at a reduced
				// internal resolution. 2-or-fewer cores use renderScale 4 (1/4
				// res) for the biggest fill-rate saving; other weak hardware
				// (3-4 cores) uses 2 (1/2 res) which stays smooth on the small
				// ~700x512 game screen.
				opts.renderScale = detectVeryWeakHardware() ? 4 : 2;
			}

			this.plasmaField = new PlasmaField(
				gameEngine,
				cardboard.x + offsetXMirror,
				cardboard.y - PLASMA_FIELD_OFFSET_Y,
				// The field draws its own shield surface, so it needs the texture
				// manager the match is using rather than the adapter it renders through.
				{ ...opts, surfaceSource: { textures: this.game.Phaser?.textures ?? null } },
			);

			// Keep the field centred on the priest without recreating it. The hook
			// outlives the field it tracks, so it is unregistered on teardown —
			// otherwise every shield re-show added another permanently-running
			// per-frame closure.
			const positionHook = () => {
				if (this.plasmaField) {
					const dir = this.creatureSprite.sprite.scaleX < 0 ? -1 : 1;
					this.plasmaField.positionTo(
						this.creatureSprite.sprite,
						dir * this._plasmaFieldBaseOffsetX,
						PLASMA_FIELD_OFFSET_Y,
					);
					// Line weight tracks remaining plasma, so a well-stocked priest
					// reads as a fat, bright field and a nearly-spent one as thin
					// wisps. Updated here rather than on show, because plasma is
					// spent mid-turn and the hook already runs every frame.
					this.plasmaField.setPlasmaFraction(this.getPlasmaFraction());
				}
			};
			this._plasmaFieldPositionHook = positionHook;
			this.creatureSprite.addPostUpdateHook(positionHook);
		}

		this.plasmaField.setVisible(true);
	}

	/** Hide the field without tearing it down, so it can be reused (no reset). */
	private hidePlasmaShield() {
		if (this.plasmaField) {
			this.plasmaField.setVisible(false);
		}
	}

	/**
	 * Removes and frees the procedural Plasma Field visual, if present.
	 * When a block burst is currently playing, the removal is deferred until
	 * the burst finishes so the player actually gets to see the block flash.
	 * Call with `immediate = true` to tear the field down right away (used on
	 * creature death / destroy where a deferred cleanup would leak visuals).
	 */
	removePlasmaShield(immediate = false) {
		if (!this.plasmaField) return;
		const field = this.plasmaField;

		if (!immediate && field.burstPowerVisible > 0) {
			// Don't overwrite existing onBurstEnd callback
			if (!field.onBurstEnd) {
				field.onBurstEnd = () => this.removePlasmaShield(true);
			}
			return;
		}

		// Drop the per-frame centring hook before the field goes away: it is
		// registered on the sprite (not the field), so tearing down the field
		// would otherwise leave it running forever.
		if (this._plasmaFieldPositionHook) {
			this.creatureSprite.removePostUpdateHook(this._plasmaFieldPositionHook);
			this._plasmaFieldPositionHook = null;
		}

		field.onBurstEnd = null;
		field.destroy();
		this.plasmaField = null;
	}

	/**
	 * Triggers the short burst flash used when the shield counters an attack.
	 * The field is (re)created if it doesn't currently exist, so the flash
	 * always plays — even on the very last plasma point that depletes plasma
	 * to 0 in the same frame. After the burst, if plasma is now 0, the field
	 * is taken down via onBurstEnd.
	 */
	burstPlasmaField() {
		if (!this.plasmaField && this.isDarkPriest()) {
			this.showPlasmaShield();
		}
		const field = this.plasmaField;
		if (!field) return;

		field.burst();
		if (!this.hasCreaturePlayerGotPlasma()) {
			field.onBurstEnd = () => this.removePlasmaShield(true);
		}
	}

	hasCreaturePlayerGotPlasma() {
		return this.player.plasma > 0;
	}

	/**
	 * This creature's player's plasma as a fraction of the pool they allocated,
	 * for the plasma field's line weight.
	 *
	 * Falls back to a full tank when the allocation is unknown or zero, so the
	 * field never renders as a hairline because of a missing config value.
	 */
	getPlasmaFraction(): number {
		// `plasma_amount` is attached to the Game instance from the game-setup
		// form rather than declared on the class, so it is read through a cast
		// and treated as optional. Same defensive access as `Player`'s own
		// initialiser.
		const max = (this.game as unknown as { plasma_amount?: number }).plasma_amount;
		if (typeof max !== 'number' || !(max > 0)) {
			return 1;
		}
		return Math.max(0, Math.min(1, this.player.plasma / max));
	}

	addFatigue(dmgAmount: number) {
		if (!this.stats.fatigueImmunity) {
			this.endurance -= dmgAmount;
			this.endurance = this.endurance < 0 ? 0 : this.endurance; // Cap
		}

		this.game.UI.updateFatigue();
	}

	addEffect(
		effect: Effect,
		specialString?: string,
		specialHint?: string,
		disableLog = false,
		disableHint = false,
	) {
		const game = this.game;

		if (!effect.stackable && this.findEffect(effect.name).length !== 0) {
			return false;
		}

		if (this.effects.includes(effect)) {
			return false;
		}

		effect.target = this;
		this.effects.push(effect);

		game.onEffectAttach(this, effect);

		this.updateAlteration();

		if (effect.name !== '') {
			if (!disableHint) {
				if (specialHint || effect.specialHint) {
					this.hint(specialHint, 'msg_effects');
				} else {
					this.hint(effect.name, 'msg_effects');
				}
			}

			if (!disableLog) {
				if (specialString) {
					game.log(specialString);
				} else {
					game.log('%CreatureName' + this.id + '% is affected by ' + effect.name);
				}
			}
		}
	}

	/** replaceEffect
	 * Add effect, but if the effect is already attached, replace it with the new
	 * effect.
	 * Note that for stackable effects, this is the same as addEffect()
	 */
	replaceEffect(effectToAdd: Effect) {
		if (!effectToAdd.stackable && this.findEffect(effectToAdd.name).length !== 0) {
			this.removeEffect(effectToAdd.name);
		}

		this.addEffect(effectToAdd);
	}

	/** removeEffect
	 * Remove an effect by name
	 */
	removeEffect(effectName: string) {
		const effectToRemove = this.effects.find((effect) => effect.name === effectName);

		if (!effectToRemove) {
			return;
		}

		effectToRemove.deleteEffect();
	}

	hint(text: string, hintType: CreatureHintType) {
		this.creatureSprite.hint(text, hintType);
	}

	clearHints(hintTypes: CreatureHintType[] = ['confirm', 'no_action']) {
		this.creatureSprite.clearHints(hintTypes);
	}

	stopNoActionHintBounce() {
		this.creatureSprite.stopNoActionHintBounce();
	}

	fadeOutNoActionHints() {
		this.creatureSprite.fadeOutNoActionHints();
	}

	/**
	 * Update the stats taking into account the effects' alteration
	 */
	updateAlteration() {
		this.stats = { ...this.baseStats };

		const buffDebuffArray = [...this.effects, ...this.dropCollection];

		buffDebuffArray.forEach((buff) => {
			$j.each(buff.alterations, (key, value) => {
				if (typeof value === 'string') {
					// Multiplication Buff
					if (value.match(/\*/)) {
						this.stats[key] = eval(this.stats[key] + value);
					}

					// Division Debuff
					if (value.match(/\//)) {
						this.stats[key] = eval(this.stats[key] + value);
					}
				}

				// Usual Buff/Debuff
				if (typeof value == 'number') {
					this.stats[key] += value;
				}
				if (key == 'movement' && !(buff instanceof Drop)) {
					// Only restore movement points for effects, not drops
					// Drops have their own explicit restoration logic in drop.ts
					this.remainingMove += value;
				}

				// Boolean Buff/Debuff
				if (typeof value == 'boolean') {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(this.stats as any)[key] = value;
				}
			});
		});

		// Maximum stat pools cannot be lower than 1.
		this.stats.health = Math.max(this.stats.health, 1);
		this.stats.endurance = Math.max(this.stats.endurance, 1);
		this.stats.energy = Math.max(this.stats.energy, 1);
		this.stats.movement = Math.max(this.stats.movement, 1);

		// These stats cannot exceed their maximum values.
		this.health = Math.min(this.health, this.stats.health);
		this.endurance = Math.min(this.endurance, this.stats.endurance);
		this.energy = Math.min(this.energy, this.stats.energy);
		// A pool the creature can no longer bank (ability lost / un-upgraded) is
		// dropped before capping this turn's movement, which includes it.
		this.movementPool = Math.min(this.movementPool, this.stashedMovementCap());
		this.remainingMove = Math.min(this.remainingMove, this.maxMovement);
	}

	/**
	 * Play kill animation. Remove creature from queue and from hexes.
	 * @param{Creature | {player:Player}} killerCreature - Killer of this creature
	 * @param{boolean} remote - True when this death is being applied because the
	 * other multiplayer client authoritatively reported it (see the
	 * 'creature-died' message in Game.handleLobbyMessage) rather than computed
	 * locally. Suppresses re-broadcasting to avoid an echo loop.
	 */
	die(killerCreature: Creature | { player: Player }, remote = false) {
		const game = this.game;

		this.dead = true;

		this.removePlasmaShield(true);

		// Triggers
		// @ts-expect-error 2554
		game.onCreatureDeath(this);

		// BRB state: Gumble's upgraded Gooey Body intercepts death
		if (this._brbActive && this._brbState) {
			this._brbActive = false;
			this._brbSpent = true; // prevent Gooey Body re-triggering on follow-up death
			this.dead = false;
			this._brbState.killer = killerCreature;

			// If the goo trap is destroyed while Gumble is in BRB state (e.g. another
			// trap overwrites it), Gumble dies immediately with full score/queue update.
			// The destroyer (the creature whose trap caused the overwrite) becomes the killer.
			this._brbState.gooTrap.onDestroyFn = (destroyer?: Creature) => {
				if (!this._brbState) return; // already resolved (revived or died)
				const savedState = this._brbState;
				this._brbState = null;
				this.die(destroyer ?? savedState.killer, remote);
			};

			// Clear the hex first so the trap spot is immediately walkable
			// and pathfinding/queue-display sees the correct state.
			this.cleanHex();

			// Play melt animation — Gumble appears to die but the trap will
			// resurrect him. No score, no 'is dead' log. Queue avatar shows BRB.
			const brbAnimOpts = {
				callback: () => {
					game.updateQueueDisplay();
					game.grid.updateDisplay();
				},
				flipped: killerCreature instanceof Creature ? this.pos.x - killerCreature.pos.x < 0 : false,
			};
			game.animations.melt(this, brbAnimOpts);
			game.log('%CreatureName' + this.id + '% will be right back...');
			game.updateQueueDisplay();
			game.grid.updateDisplay();
			if (game.activeCreature === this) {
				game.nextCreature();
				return;
			}
			game.activeCreature?.queryMove();
			return;
		}

		game.log('%CreatureName' + this.id + '% is dead');
		this.killer = killerCreature.player;
		const isDeny = this.killer.flipped == this.player.flipped;

		// Make death authoritative over the network instead of trusting the two
		// clients' independent damage/effect computations to always agree on the
		// outcome. Gated the same way as nextCreature()'s turn-update broadcast:
		// only the client whose player controls the currently active creature (the
		// one whose action caused this) is the source of truth, so both clients
		// don't race to report the same death. `remote` (this death being applied
		// because of an incoming 'creature-died' message) always suppresses
		// re-broadcasting to avoid an echo loop.
		if (
			!remote &&
			game.multiplayer &&
			game.lobby &&
			game.activeCreature &&
			game.activeCreature.player?.controller !== 'bot' &&
			game.lobby.isMyTurn()
		) {
			game.lobby.sendAction({
				type: 'creature-died',
				creatureId: this.id,
				killerId: killerCreature instanceof Creature ? killerCreature.id : undefined,
				playerId: game.lobby.getLocalPlayer()?.playerId || '',
			});
		}

		// Drop item
		if (game.unitDrops == 1 && this.drop) {
			const offsetX = this.player.flipped ? this.x - this.size + 1 : this.x;
			const { name, ...alterations } = this.drop;
			new Drop(name, alterations, offsetX, this.y, game);
			// If a creature is already standing on the drop hex (e.g. in the BRB scenario
			// where the goo trap was overwritten and Gumble dies under them), give them
			// the drop immediately rather than waiting for movement.
			const dropHex = game.hexAt(offsetX, this.y);
			if (dropHex) {
				const occupant = dropHex.creature;
				if (occupant && occupant !== this && !occupant.dead) {
					occupant.pickupDrop();
				}
			}
		}

		if (!game.firstKill && !isDeny) {
			// First Kill
			this.killer.score.push({
				type: 'firstKill',
			});
			game.firstKill = true;
		}

		if (this.isDarkPriest()) {
			// If Dark Priest
			if (isDeny) {
				// TEAM KILL (DENY)
				this.killer.score.push({
					type: 'deny',
					creature: this,
				});
			} else {
				// Humiliation
				this.killer.score.push({
					type: 'humiliation',
					player: this.team,
				});
			}
		}

		if (!this.undead) {
			// Only if not undead
			if (isDeny) {
				// TEAM KILL (DENY)
				this.killer.score.push({
					type: 'deny',
					creature: this,
				});
			} else {
				// KILL
				this.killer.score.push({
					type: 'kill',
					creature: this,
				});
			}
		}

		if (this.player.isAnnihilated()) {
			// Remove humiliation as annihilation is an upgrade
			const total = this.killer.score.length;
			for (let i = 0; i < total; i++) {
				const s = this.killer.score[i];
				if (s.type == 'humiliation') {
					if (s.player == this.team) {
						this.killer.score.splice(i, 1);
					}

					break;
				}
			}
			// ANNIHILATION
			this.killer.score.push({
				type: 'annihilation',
				player: this.team,
			});
		}

		if (this.isDarkPriest()) {
			this.player.deactivate(); // Here because of score calculation
		}

		// Kill animation
		const opts = {
			callback: () => {
				this.destroy();
			},
			flipped: false,
		};

		// Check whether or not to flip the animation
		if (killerCreature instanceof Creature) {
			if (this.pos.x - killerCreature.pos.x < 0) {
				opts.flipped = true;
			}
		}

		const customDeathAnimation = (this as CreatureRuntimeFlags).deathAnimationType;
		if (customDeathAnimation === 'shatterDown') {
			game.animations.shatterDown(this, opts);
		} else if (customDeathAnimation === 'melt') {
			game.animations.melt(this, opts);
		} else {
			game.animations.death(this, opts);
		}
		this.cleanHex();

		game.updateQueueDisplay();
		game.grid.updateDisplay();

		if (game.activeCreature === this) {
			game.nextCreature();
			return;
		} // End turn if current active creature die

		// As hex occupation changes, path must be recalculated for the current creature not the dying one
		game.activeCreature?.queryMove();
	}

	isFatigued() {
		return this.endurance === 0;
	}

	isFragile() {
		return this.stats.endurance === 1;
	}

	/**
	 * Shortcut convenience function to grid.getHexMap
	 */
	getHexMap(map: AugmentedMatrix, invertFlipped: boolean) {
		const x = (this.player.flipped ? !invertFlipped : invertFlipped)
			? this.x + 1 - this.size
			: this.x;
		return this.game.grid.getHexMap(
			x,
			this.y - map.origin[1],
			0 - map.origin[0],
			this.player.flipped ? !invertFlipped : invertFlipped,
			map,
		);
	}

	findEffect(name) {
		const ret = [];

		this.effects.forEach((effect) => {
			if (effect.name == name) {
				ret.push(effect);
			}
		});

		return ret;
	}

	// Make units transparent
	xray(enable: boolean, referenceCreature?: Creature | Creature[]) {
		this.creatureSprite.xray(enable, referenceCreature);
	}

	clearXrayImmediately() {
		this.creatureSprite.clearXrayImmediately();
	}

	get isXrayed(): boolean {
		return this.creatureSprite?.isXrayed ?? false;
	}

	pickupDrop() {
		getPointFacade()
			.getDropsAt(this)
			.forEach((drop) => {
				if (!drop.pickedUp) {
					drop.pickup(this);
					drop.pickedUp = true; // Prevent multiple pickups
				}
			});
	}

	/**
	 * Get movement type for this creature
	 */
	movementType(): string {
		const totalAbilities = this.abilities.length;

		// If the creature has an ability that modifies movement type, use that,
		// otherwise use the creature's base movement type
		for (let i = 0; i < totalAbilities; i++) {
			if (typeof this.abilities[i].movementType === 'function') {
				return this.abilities[i].movementType();
			}
		}

		return this._movementType;
	}

	/**
	 * Total movement available for this turn: the creature's own movement plus
	 * anything banked in `this.movementPool`. This is the ceiling `this.remainingMove`
	 * respects.
	 */
	get maxMovement(): number {
		return this.stats.movement + this.movementPool;
	}

	/**
	 * Maximum movement points an ability of this creature allows to be banked
	 * between turns. 0 when no ability stores unused movement.
	 */
	stashedMovementCap(): number {
		// If the creature has an ability that stores movement, that ability owns the
		// cap, otherwise nothing can be banked.
		for (const ability of this.abilities) {
			if (typeof ability.stashedMovementCap === 'function') {
				return Math.max(0, ability.stashedMovementCap());
			}
		}

		return 0;
	}

	/**
	 * Bank the movement left over at the end of a turn so it counts towards next
	 * turn's movement, then end this turn's movement.
	 *
	 * Only the leftover is banked — the banked points themselves are never banked
	 * again, they are spent first. Whatever is left at the end of a turn simply
	 * becomes the new pool, capped by `stashedMovementCap()`, which also means
	 * stashing cannot be farmed by delaying a turn.
	 */
	stashMovement(): void {
		this.movementPool = Math.min(this.stashedMovementCap(), Math.max(this.remainingMove, 0));
		this.remainingMove = 0;
	}

	/**
	 * Is this unit a Dark Priest?
	 */
	isDarkPriest(): boolean {
		return this.type === '--';
	}

	/**
	 * Does the creature have the Frozen status? @see status.frozen
	 */
	isFrozen(): boolean {
		return this.status.frozen;
	}

	/**
	 * Does the creature have the Cryostasis status? @see status.cryostasis
	 */
	isInCryostasis(): boolean {
		return this.isFrozen() && this.status.cryostasis;
	}

	/**
	 * Same as the "Frozen" status, but with a different name.
	 *
	 * TODO: Refactor to a generic "skip turn" status that can be customised.
	 */
	isDizzy(): boolean {
		return this.status.dizzy;
	}

	/**
	 * Freeze a creature, skipping its next turn. @see status.frozen
	 */
	freeze(cryostasis = false) {
		this.status.frozen = true;

		if (cryostasis) {
			this.status.cryostasis = true;
		}

		// Update the health box under the creature cardboard with frozen effect.
		this.updateHealth();
		// Show frozen fatigue text effect in queue.
		this.game.UI.updateFatigue();

		this.game.channels.creature.emit('frozen', { creature: this, cryostasis });
	}

	get fatigueText(): string {
		let result = '';
		if (this._brbState) {
			const occupant = this._brbState.gooTrap?.hex?.creature;
			const text = occupant && occupant !== this ? 'AFK' : 'BRB';
			this.#fatigueText = text;
			return text;
		} else if (this.player.hasLost) {
			result = 'Dazzled';
		} else if (this.isFrozen()) {
			result = this.isInCryostasis() ? 'Cryostasis' : 'Frozen';
		} else if (this.isDizzy()) {
			result = 'Dizzy';
		} else if (this.materializationSickness) {
			result = 'Sickened';
		} else if (this.protectedFromFatigue || this.stats.fatigueImmunity) {
			result = 'Protected';
		} else if (this.isFragile()) {
			result = 'Fragile';
			// Display message if the creature has first become fragile

			// TODO: This isn't necessarily the moment the creature has
			// become fragile. The code will run twice if, e.g.,
			// the creature is fragile, then fragile and dizzy, then fragile
			if (this.#fatigueText !== result) {
				this.game.log('%CreatureName' + this.id + '% has become fragile');
			}
		} else if (this.isFatigued()) {
			result = 'Fatigued';
		} else {
			result = this.endurance + '/' + this.stats.endurance;
		}

		if (this.isDarkPriest()) {
			// If Dark Priest
			this.abilities[0].require(); // Update protectedFromFatigue
		}

		this.#fatigueText = result;
		return result;
	}

	destroy() {
		this.removePlasmaShield(true);
		this.creatureSprite.destroy();
		// NOTE: If this was a temp creature remove it from game.creatures.
		// Dead creatures are supposed to stay in game.creatures.
		// We null out the slot rather than filtering (which would shift indices and
		// break the game.creatures[id] lookup used throughout the codebase).
		if (this.temp) {
			this.game.creatures[this.id] = undefined;
		}
	}
}

/**
 * Per-hint bookkeeping: the type tag and the three tweens that drive it.
 *
 * Phaser 2 CE gave every game object a `DataManager` and this subsystem hung
 * all of its state off `hint.data.*`. Phaser 4 has no equivalent, and the
 * engine facade had been answering `data` with an untyped bag, so nothing
 * checked these names and every read was `any`. A `WeakMap` keyed by the hint
 * itself is the native-phaser-4 replacement: entries die with the element, and
 * the shape is declared once rather than inferred at 114 call sites.
 */
type HintState = {
	/** `null` until the element is registered; see {@link hintState}. */
	hintType: CreatureHintType | 'confirm_deleted';
	tweenAlpha: any | null;
	tweenPos: any | null;
	tweenBounce: any | null;
	/** Resting y, captured on first bounce so a stop returns the hint to it. */
	baseY?: number;
	/** `confirm` hints that must not animate into place, e.g. skip turn. */
	skipTurnStatic: boolean;
};

const hintStates = new WeakMap<object, HintState>();

/** Reads the state for a hint element, if it has ever been registered. */
function peekHintState(hint: object): HintState | undefined {
	return hintStates.get(hint);
}

/**
 * Reads the state for a hint element, registering a blank one on first use.
 *
 * Every hint element the code creates is registered as it is built, so this
 * only ever fills in for the two paths that deliberately clear all three
 * tweens at once: `hint()` and the skip-turn confirm branch.
 */
function hintState(hint: object): HintState {
	let state = hintStates.get(hint);
	if (!state) {
		state = {
			hintType: 'confirm_deleted',
			tweenAlpha: null,
			tweenPos: null,
			tweenBounce: null,
			skipTurnStatic: false,
		};
		hintStates.set(hint, state);
	}
	return state;
}

class CreatureSprite {
	/**
	 * Whether a sprite is still parked on Phaser's placeholder texture.
	 *
	 * Phaser substitutes a 32x32 "image ready" texture when the requested one is
	 * not resident, and a sprite created against it keeps sampling it forever:
	 * registering the real texture later does not re-resolve an existing sprite.
	 * So the load callback below has to notice and swap it.
	 */
	private _isOnPlaceholderTexture(): boolean {
		return this._sprite?.key === MISSING_TEXTURE_KEY;
	}

	private _creature: Creature;
	private _group: any;
	private _sprite: any;
	private _hintGrp: any;

	private _healthIndicatorGroup: any;
	private _healthIndicatorSprite: any;
	private _healthIndicatorText: any;
	private _healthIndicatorTween: any | null;
	private _noActionHintElements: any[] = [];
	private _noActionHintGroup: any | null = null;
	private _noActionHintTween: any | null = null;
	private _healthBounceOffset = 0; // y-offset driven by the bounce tween
	private _healthUiGroup: any; // elevated layer for active/hovered indicators
	private _healthInUiGroup = false; // whether the indicator is currently elevated

	private _gameEngine: GameEngine;
	private _frameInfo: { originX: number; originY: number };
	private _creatureSize: number;
	private _creatureTeam: PlayerID;
	private _dir: 1 | -1 = 1;

	private _isXray = false;
	get isXrayed(): boolean {
		return this._isXray;
	}
	private _xrayAlpha = 0; // current effect intensity (0 = off, 1 = full)
	get xrayAlpha(): number {
		return this._xrayAlpha;
	}
	private _xrayTargetAlpha = 0; // target intensity for fade animation
	private _xrayBmd: CanvasSurface | null = null;
	private _originalTextureKey: string;
	/** Cardboard pixel rows for the obstructor, built once per xray session. */
	private _xrayOriginalAlpha: Uint8ClampedArray | null = null;
	/** Cardboard silhouettes for the refs, snapped once per xray session. */
	private _xrayRefAlpha: {
		size: number;
		entries: Array<{
			rgba: Uint8ClampedArray;
			width: number;
			height: number;
			xrayDepth: number;
		} | null>;
	} | null = null;
	/** Union of ref-creature cardboard silhouettes, in obstructor bitmap pixels. */
	private _xrayMaskAlpha: Uint8Array | null = null;
	private _xrayRefCreatures: Creature[] = []; // all ref creatures whose shape we cut out

	private _postUpdateHooks: Array<() => void> = [];

	/**
	 * True once the Phaser objects owned by this sprite have been torn down.
	 * Dead creatures stay in `game.creatures` and their effects stay in
	 * `game.effects`, so per-frame and per-round callbacks (tickXray,
	 * updateHealth) can still arrive after `destroy()` — every one of them must
	 * bail out instead of touching freed Phaser objects, which in Phaser 4 crash
	 * on `this.data`/`this.scene` access.
	 */
	private _destroyed = false;

	get destroyed(): boolean {
		return this._destroyed;
	}

	constructor(creature: Creature) {
		const { game, player, type, team, display, size, id, health } = creature;
		const dir = player.flipped ? -1 : 1;
		const gameEngine = game.gameEngine;

		this._creature = creature;
		this._gameEngine = gameEngine;
		this._creatureSize = size;
		this._creatureTeam = team;
		this._frameInfo = { originX: display['offset-x'], originY: display['offset-y'] };

		const group: any = gameEngine.add.group(game.grid.creatureGroup, 'creatureGrp_' + id);
		group.alpha = 0;

		const isDarkPriest = type === '--';

		// Adding sprite
		const spriteKey = isDarkPriest ? getDarkPriestCardboardKey(creature.player) : creature.name;
		const sprite = group.create(0, 0, spriteKey);
		sprite.setOrigin(0.5, 1);
		// Placed by `setDir()` below, once the sprite and the hint group are
		// both reachable — see `_place()` for the offset maths.

		// A temp creature is the placement placeholder the Dark Priest shows while
		// the player picks a hex: it sits at a fixed placeholder hex and is hidden
		// with `sprite.alpha = 0`. That hides the cardboard only -- the glow
		// overlays and smoke are separate sprites, so they went on rendering and
		// left a lit cardboard ghost sitting near the caster until the real unit
		// replaced the temp. A hidden unit gets no FX; the materialised creature
		// builds its own at its real hex.
		if (creature.name === 'Infernal' && !creature.temp) {
			game.animations.initInfernalCardboardEffect(creature, sprite);
		}

		// Hint Group
		const hintGrp = gameEngine.add.group(group, 'creatureHintGrp_' + id);
		hintGrp.x = 0.5 * HEX_WIDTH_PX * size;
		// Default hint group position above cardboard (will be corrected in _place()
		// when actual texture loads). Phaser 2 used -sprite.texture.height + 5 which
		// worked because textures were preloaded; Phaser 4 loads on-demand so we
		// estimate based on size.
		const estimatedHeight = size === 1 ? 160 : 220;
		hintGrp.y = -estimatedHeight + 5;

		const healthIndicatorGroup = gameEngine.add.group(group, 'creatureHealthGrp_' + id);

		const healthIndicatorX = player.flipped ? 19 : 19 + HEX_WIDTH_PX * (size - 1);
		const healthIndicatorY = 49;
		const healthIndicatorSprite = healthIndicatorGroup.create(
			healthIndicatorX,
			healthIndicatorY,
			'p' + team + '_health',
		);
		// Phaser 4 sprites default to origin (0.5, 0.5) — centred on the
		// coordinates — but the indicator positions below were tuned for
		// Phaser 2's top-left (0, 0) default. Pin the sprite to top-left so
		// the health/plasma text lands in the centre of the pill.
		//
		// Setting the anchor alone is not enough: Phaser 4 keeps the rendered
		// top-left put and shifts x/y by half the texture, which would slide the
		// pill half a pill-width (26px) west of the text centred on it. Re-apply
		// the intended top-left. See Hex#pinTopLeft for the same fix
		// on the hex artwork.
		healthIndicatorSprite.setOrigin(0, 0);
		healthIndicatorSprite.x = healthIndicatorX;
		healthIndicatorSprite.y = healthIndicatorY;

		const healthIndicatorText = gameEngine.add.text(
			player.flipped ? HEX_WIDTH_PX * 0.5 : HEX_WIDTH_PX * (size - 0.5),
			60,
			// `health` is a number and `setHealth` owns the real value; the
			// placeholder only has to be renderable. Stringify it here rather than
			// casting: the cast let Phaser coerce it implicitly, and this is the
			// same laundered cast that let a CanvasSurface reach `add.sprite` as a
			// texture key and silently fall back to the missing-texture placeholder.
			String(health),
			{
				font: 'bold 15pt Play',
				color: '#fff',
				align: 'center',
				stroke: '#000',
				strokeThickness: 6,
			},
			healthIndicatorGroup,
		);
		healthIndicatorText.setOrigin(0.5, 0.5);
		healthIndicatorGroup.visible = false;

		this._group = group;
		this._sprite = sprite;

		this._hintGrp = hintGrp;

		this._healthIndicatorGroup = healthIndicatorGroup;
		this._healthIndicatorSprite = healthIndicatorSprite;
		this._healthIndicatorText = healthIndicatorText;
		this._healthIndicatorTween = undefined;
		this._healthUiGroup = game.grid.healthIndicatorUiGroup;

		this._originalTextureKey = spriteKey;

		// Phaser 4 containers have no `update()` tick — `phaserUpdate()` drives
		// the fade/cutout below via `tickXray()`. Keep the historic `_group.update`
		// override (tests and any legacy callers may still invoke it) but make
		// it a no-op rather than delegating: Phaser still calls `_group.update()`
		// every step, so delegating ticked the Infernal effect a second time per
		// frame. The effect advances `uTime` from the frame delta, so the double
		// tick ran its pulse and smoke at double speed.
		const groupHandle = this._group as { update?: unknown };
		const _groupUpdate =
			typeof groupHandle.update === 'function'
				? (groupHandle.update as () => void).bind(this._group)
				: () => undefined;
		this._group.update = () => {
			_groupUpdate();
		};

		this.setHex(creature.hexagons[size - 1]);
		this.setDir(dir);
		this._bindCardboardWhenReady();
	}

	// NOTE: This is the old API exposed by Creature.
	// Kept for compatibility, but usage should be phased out.
	// TODO: Prefer using CreatureSprite methods and remove these when possible.
	get grp() {
		return this._group;
	}
	get sprite() {
		return this._sprite;
	}

	/** Registers a per-frame hook run from the group update (after tweens). */
	addPostUpdateHook(fn: () => void): void {
		this._postUpdateHooks.push(fn);
	}

	/**
	 * Unregisters a hook added by {@link addPostUpdateHook}.
	 *
	 * Hooks run every frame and were previously push-only, so anything that
	 * re-registered on teardown (the Plasma Field hook re-adds itself whenever
	 * the shield is re-shown) grew the array without bound and kept running
	 * after the thing it tracked was gone.
	 */
	removePostUpdateHook(fn: () => void): void {
		const index = this._postUpdateHooks.indexOf(fn);
		if (index !== -1) {
			this._postUpdateHooks.splice(index, 1);
		}
	}

	/**
	 * Advances the xray fade and redraws the cutout so it tracks movement.
	 * Called once per Phaser frame from `Game.phaserUpdate()`; the `_group.update`
	 * override above delegates here too for legacy callers.
	 */
	tickXray(): void {
		if (this._destroyed) return;
		this._creature.game.animations?.tickInfernalCardboardEffect?.(this._creature);
		const XRAY_FADE_RATE = 0.08; // ~160 ms fade at 60 fps
		// Animate xray alpha toward target
		if (this._xrayAlpha < this._xrayTargetAlpha) {
			this._xrayAlpha = Math.min(this._xrayTargetAlpha, this._xrayAlpha + XRAY_FADE_RATE);
		} else if (this._xrayAlpha > this._xrayTargetAlpha) {
			this._xrayAlpha = Math.max(this._xrayTargetAlpha, this._xrayAlpha - XRAY_FADE_RATE);
		}
		// Sync health indicator world position when it lives in the elevated UI group
		if (this._healthInUiGroup) {
			this._healthIndicatorGroup.x = this._group.x;
			this._healthIndicatorGroup.y = this._group.y + this._healthBounceOffset;
		}
		// Fade health indicator group in sync with the xray sprite effect.
		// The health group is a separate Phaser object rendered on top of the
		// sprite, so canvas-surface tricks can't hide it — we must set its
		// alpha directly so the reference creature's badge shows through.
		//
		// This is the only place the badge's opacity is written. Anything else
		// that sets it fights this fade: see `_finalizeXrayOff`.
		const hiAlpha = 1.0 - (1.0 - 0.2) * this._xrayAlpha;
		this._healthIndicatorGroup.alpha = hiAlpha;
		if (this._xrayBmd && this._xrayRefCreatures.length > 0) {
			if (this._xrayAlpha <= 0 && this._xrayTargetAlpha === 0) {
				// Fade-out complete — restore original texture
				this._finalizeXrayOff();
			} else if (!this._safeDrawXray(this._xrayRefCreatures, this._xrayBmd)) {
				// Keep the original cardboard when a redraw can't produce
				// pixels (missing source, blank mask) instead of stranding the
				// sprite on a blank bitmap. The xray request stays live so the
				// next frame can retry — a reference's cardboard may not have
				// finished loading. Tearing the whole effect down here instead
				// is what made a faded badge pop to full opacity on every hover
				// step, because `HexGrid.xray()` re-requests the xray for each
				// hex the cursor crosses.
				this._restoreOriginalTexture();
			}
		}

		// Run per-frame hooks registered by effects attached to this creature
		// (e.g. keeping the Plasma Field visual centered on the Dark Priest).
		for (let i = 0; i < this._postUpdateHooks.length; i++) {
			this._postUpdateHooks[i]();
		}
	}

	// TODO: Refactor
	// This currently has one user.
	// Refactoring into some combination of left, right, top, bottom, centerX, centerY would be welcome.
	get legacyProjectileEmissionPoint() {
		return { x: this._group.x, y: this._group.y };
	}

	private _promisifyTween(
		target: object,
		tweenProperties: Record<string, number>,
		durationMS = 1000,
		easing = Easing.Linear.None,
	): Promise<CreatureSprite> {
		const tween = this._gameEngine.tween(target).to(tweenProperties, durationMS, easing);
		const promise: Promise<CreatureSprite> = new Promise((resolve) => {
			tween.onComplete.add(() => resolve(this));
		});
		tween.start();
		return promise;
	}

	setAlpha(a: number, durationMS = 0): Promise<CreatureSprite> {
		if (durationMS === 0 || this._group.alpha === a) {
			this._group.alpha = a;
			return new Promise((resolve) => {
				resolve(this);
			});
		}
		return this._promisifyTween(this._group, { alpha: a }, durationMS);
	}

	setAngle(a: number, durationMS = 0): Promise<CreatureSprite> {
		if (durationMS === 0 || this._group.angle === a) {
			this._group.angle = a;
			return new Promise((resolve) => {
				resolve(this);
			});
		} else {
			return this._promisifyTween(this._group, { angle: a }, durationMS);
		}
	}

	setHex(h: Hex, durationMS = 0): Promise<CreatureSprite> {
		return this.setPx(h.displayPos, durationMS);
	}

	setPx(pos: { x: number; y: number }, durationMS = 0): Promise<CreatureSprite> {
		if (durationMS === 0) {
			this._group.setPosition(pos.x, pos.y);
			return new Promise((resolve) => {
				resolve(this);
			});
		} else {
			return this._promisifyTween(this._group, pos, durationMS);
		}
	}

	setDir(dir: 1 | -1) {
		this._dir = dir;
		this._sprite.setScale(dir, 1);
		this._place();
		this._healthIndicatorSprite.x = dir === -1 ? 19 : 19 + HEX_WIDTH_PX * (this._creatureSize - 1);
		this._healthIndicatorText.x =
			dir === -1 ? HEX_WIDTH_PX * 0.5 : HEX_WIDTH_PX * (this._creatureSize - 0.5);
	}

	/**
	 * Places the cardboard inside its group, and the hint group above it.
	 *
	 * The hex artwork is *not* concentric with its hit area: the base `hex`
	 * texture is drawn with its top-left on the hit point (see
	 * Hex#pinTopLeft), so the visible centre of a hex sits half a hex-width
	 * east of `displayPos.x`. The creature group, by contrast, is placed on
	 * `displayPos.x`, hence the half-texture term below — it re-centres the
	 * unit on the hex *artwork*, it is not a double count.
	 *
	 * Every term is read off the texture's own size, so this has to be re-run
	 * whenever that size changes — see `_bindCardboardWhenReady()`.
	 */
	private _place(): void {
		const originX =
			this._frameInfo.originX +
			(this._creature.isDarkPriest() ? getDarkPriestDisplayOffsetX(this._creature.player) : 0);
		// Frame size, not source size: this positions the cardboard relative to the
		// hex artwork, and `texture.width` is the whole source image.
		const { width, height } = getFrameSize(this._sprite);
		this._sprite.x =
			(this._dir === 1 ? originX : HEX_WIDTH_PX * this._creatureSize - width - originX) + width / 2;
		this._sprite.y = this._frameInfo.originY + height;
		// Hints (skip turn, no action possible, …) hang just above the cardboard.
		this._hintGrp.y = -height + 5;
	}

	/**
	 * Rebinds the cardboard once its on-demand download lands.
	 *
	 * Cardboards are fetched the first time a unit is shown rather than at match
	 * start, so a creature is regularly constructed while its texture is still
	 * in flight — always on the client that replays a materialization, since it
	 * has no placement preview to warm the fetch. Phaser resolves the missing
	 * key to its 32×32 `__MISSING` placeholder and never re-resolves an
	 * existing sprite, which left the unit invisible *and* offset by the
	 * placeholder's size (see `_place()`) until some unrelated code path
	 * happened to call `setTexture` again — the xray teardown at the start of
	 * Abolished's Bonfire Spring teleport, for one.
	 */
	private _bindCardboardWhenReady(): void {
		const spriteKey = this._originalTextureKey;
		if (isTextureReady(spriteKey)) {
			return;
		}
		ensureCardboard(spriteKey, () => {
			// The unit may have died, or been replaced by its materialized twin,
			// while its cardboard was still downloading.
			if (!this._group?.parent) {
				return;
			}
			// Only the placeholder is worth swapping: a sprite parked on an xray
			// bitmap is restored by `_finalizeXrayOff()` instead.
			if (this._isOnPlaceholderTexture()) {
				this._sprite.setTexture(spriteKey);
			}
			this._place();
		});
	}

	xray(enable: boolean, referenceCreature?: Creature | Creature[]) {
		if (this._destroyed) return;
		if (!enable && !this._isXray && this._xrayTargetAlpha === 0) return;
		if (enable && referenceCreature) {
			const nextRefCreatures = Array.isArray(referenceCreature)
				? referenceCreature
				: [referenceCreature];
			// Test liveness with `_xrayTargetAlpha`, not `_isXray`. `HexGrid.xray()`
			// opens every hover by clearing the xray on every creature and then
			// re-requesting it for the ones still obscured, so `_isXray` is false by
			// the time the same reference set comes back round and the memo below
			// never hit. Each miss cost a full cardboard pixel snapshot per
			// reference plus a canvas redraw — dozens of those per cursor sweep.
			const hasSameReferences =
				this._xrayTargetAlpha > 0 &&
				this._xrayRefCreatures.length === nextRefCreatures.length &&
				this._xrayRefCreatures.every((reference, index) => reference === nextRefCreatures[index]);
			if (hasSameReferences) {
				return;
			}
			this._isXray = true;
			this._xrayTargetAlpha = 1;
			// Replace the active hover reference instead of accumulating old ones.
			// Re-snap both the obstructor and the refs: a rebuilt bitmap is only
			// correct when every silhouette comes from the pre-swap cardboards.
			this._xrayMaskAlpha = null;
			this._xrayRefCreatures = nextRefCreatures.slice();
			this._buildXrayTexture(this._xrayRefCreatures);
		} else if (enable) {
			// Ignore legacy calls that try to enable xray without a reference target.
			// The pixel-mask implementation needs a reference creature silhouette;
			// treating this as "off" would clear valid active/hover xray states.
			return;
		} else {
			this._isXray = false;
			this._xrayTargetAlpha = 0;
			// Update hook fades out then calls _finalizeXrayOff automatically
		}
	}

	clearXrayImmediately() {
		this._isXray = false;
		this._clearXrayTexture();
	}

	/** Immediately snaps xray alpha to 0 and frees all resources. */
	private _clearXrayTexture() {
		this._xrayAlpha = 0;
		this._xrayTargetAlpha = 0;
		this._finalizeXrayOff();
	}

	/**
	 * Swaps the sprite back to the untouched cardboard.
	 *
	 * Separate from {@link _finalizeXrayOff} because restoring the artwork is
	 * also the right response to a single failed redraw: the cutout is retried
	 * on the next frame, but the sprite must not sit on a blank bitmap in the
	 * meantime.
	 */
	private _restoreOriginalTexture() {
		if (this._destroyed) {
			return;
		}
		this._sprite.setTexture(this._originalTextureKey);
	}

	/** Restores the original texture and frees all xray canvas resources. */
	private _finalizeXrayOff() {
		if (this._destroyed) {
			this._freeXrayState();
			return;
		}
		// The health indicator's opacity is derived from `_xrayAlpha` every
		// frame in `tickXray()`. Writing it here fought that fade: `_finalizeXrayOff`
		// is reachable while an xray request is still live (see `tickXray`), so it
		// slammed the faded badge to full opacity for one frame before the next
		// `tickXray()` dragged it back down. Hovering across the board re-triggers
		// that every step, which is the flicker.
		this._xrayRefCreatures = [];
		this._xrayOriginalAlpha = null;
		this._xrayRefAlpha = null;
		this._xrayMaskAlpha = null;
		this._restoreOriginalTexture();
	}

	/**
	 * Releases the xray bitmaps without touching any Phaser object. Safe to
	 * call after destroy, where the sprite's scene is already gone.
	 */
	private _freeXrayState() {
		this._xrayAlpha = 0;
		this._xrayTargetAlpha = 0;
		this._isXray = false;
		this._xrayRefCreatures = [];
		this._xrayOriginalAlpha = null;
		this._xrayRefAlpha = null;
		this._xrayMaskAlpha = null;
		this._postUpdateHooks.length = 0;
		if (this._xrayBmd) {
			this._xrayBmd.destroy();
			this._xrayBmd = null;
		}
	}

	private _buildXrayTexture(refCreatures: Creature[]) {
		// Frame size: the xray bitmap is sized to the cardboard it replaces, and the
		// snapshot below is compared against it.
		const { width: otw, height: oth } = getFrameSize(this._sprite);
		if (!(otw > 0) || !(oth > 0)) {
			return;
		}

		// Snapshot the obstructor's cardboard pixels BEFORE swapping the texture
		// to the xray surface. After loadTexture(surfaceKey), resolving through
		// the live sprite would self-sample the xray canvas and blank the redraw.
		const original = this._snapshotCardboardPixels(this._sprite, this._originalTextureKey);
		if (!original) {
			return;
		}
		// The snapshot is at native cardboard size; if a stale bitmap from a
		// different-size texture lingers, drop it so dimensions always match.
		if (original.width !== otw || original.height !== oth) {
			return;
		}
		const refEntries: Array<{
			rgba: Uint8ClampedArray;
			width: number;
			height: number;
			xrayDepth: number;
		} | null> = [];
		for (const refCreature of refCreatures) {
			const refSprite = (refCreature as Creature)?.sprite as any;
			// Trap/drop reveal markers are `{sprite, grp}` stand-ins without a
			// `Creature` behind them; use the sprite's own key so the trap art
			// resolves instead of the obstructor's texture.
			const refKey =
				typeof (refCreature as { name?: unknown })?.name === 'string'
					? ((refCreature as { name: string }).name as string)
					: typeof refSprite?.key === 'string'
					? (refSprite.key as string)
					: undefined;
			const snapshot = this._snapshotCardboardPixels(refSprite, refKey);
			if (!snapshot) {
				refEntries.push(null);
				continue;
			}
			const depthValue = Number(
				(refCreature as unknown as { grp?: { depth?: unknown } })?.grp?.depth,
			);
			refEntries.push({
				rgba: snapshot.rgba,
				width: snapshot.width,
				height: snapshot.height,
				xrayDepth: Number.isFinite(depthValue) ? depthValue : 0,
			});
		}
		if (!refEntries.some((entry) => entry !== null)) {
			return;
		}
		this._xrayOriginalAlpha = original.rgba;
		this._xrayRefAlpha = { size: refCreatures.length, entries: refEntries };
		this._xrayMaskAlpha = null;

		let bmd = this._xrayBmd;
		if (!bmd || bmd.width !== otw || bmd.height !== oth) {
			if (bmd) {
				bmd.destroy();
			}
			bmd = createGameCanvasSurface(this._creature.game, otw, oth);
		}
		this._xrayBmd = bmd;
		this._xrayRefCreatures = refCreatures.slice(); // copy to avoid external mutation

		if (!this._safeDrawXray(this._xrayRefCreatures, bmd)) {
			return;
		}
		this._sprite.setTexture(bmd.key);
	}

	private _resolveFrameSourceRect(
		sprite: any,
		fallbackW: number,
		fallbackH: number,
	): { sx: number; sy: number; sw: number; sh: number } | null {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const texture: any = sprite?.texture as any;
		if (!texture) {
			return null;
		}
		// `makeTextureView` answers both `crop` and `frame` from the live
		// Phaser 4 `Frame`; read whichever spelling is present.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const frame: any = texture.frame ?? texture.crop ?? null;
		// Phaser 4 Canvas path draws `frame.source.image` at
		// `(canvasData.x, canvasData.y)` with size `(cutWidth, cutHeight)`.
		// The legacy `{x, y, width, height}` fallback below assumed the full
		// source image, which misplaces creatures when the cardboard frame is
		// trimmed/atlas-packed; prefer the cut rect that the renderer samples.
		const cutX =
			typeof frame?.cutX === 'number'
				? frame.cutX
				: typeof frame?.canvasData?.x === 'number'
				? frame.canvasData.x
				: undefined;
		const cutY =
			typeof frame?.cutY === 'number'
				? frame.cutY
				: typeof frame?.canvasData?.y === 'number'
				? frame.canvasData.y
				: undefined;
		const cutW =
			typeof frame?.cutWidth === 'number'
				? frame.cutWidth
				: typeof frame?.canvasData?.width === 'number'
				? frame.canvasData.width
				: undefined;
		const cutH =
			typeof frame?.cutHeight === 'number'
				? frame.cutHeight
				: typeof frame?.canvasData?.height === 'number'
				? frame.canvasData.height
				: undefined;
		if (
			typeof cutX === 'number' &&
			typeof cutY === 'number' &&
			typeof cutW === 'number' &&
			typeof cutH === 'number' &&
			cutW > 0 &&
			cutH > 0
		) {
			return { sx: cutX, sy: cutY, sw: cutW, sh: cutH };
		}
		const sx = typeof frame?.x === 'number' ? frame.x : 0;
		const sy = typeof frame?.y === 'number' ? frame.y : 0;
		const sw =
			typeof frame?.width === 'number' && frame.width > 0
				? frame.width
				: fallbackW > 0
				? fallbackW
				: 0;
		const sh =
			typeof frame?.height === 'number' && frame.height > 0
				? frame.height
				: fallbackH > 0
				? fallbackH
				: 0;
		if (sw <= 0 || sh <= 0) {
			return null;
		}
		return { sx, sy, sw, sh };
	}

	/**
	 * Draw the sprite's current texture frame from its base image source.
	 * Handles atlases/cropped textures by using frame coordinates.
	 */
	private _drawSpriteFrame(
		ctx: CanvasRenderingContext2D,
		sprite: any,
		src: CanvasImageSource,
		dx: number,
		dy: number,
		dw: number,
		dh: number,
	): boolean {
		if (!this._isDrawableImageSource(src) || dw <= 0 || dh <= 0) {
			return false;
		}

		const rect = this._resolveFrameSourceRect(sprite, dw, dh);
		if (!rect) {
			return false;
		}

		ctx.drawImage(src, rect.sx, rect.sy, rect.sw, rect.sh, dx, dy, dw, dh);
		return true;
	}

	private _isDrawableImageSource(src: unknown): src is CanvasImageSource {
		if (!src) {
			return false;
		}
		// Phaser 4 `TextureSource` wrappers carry the pixels under `.image`,
		// but a CanvasTexture's entry can also be an `HTMLCanvasElement`
		// itself, which has no `.image`. Only recurse when the property is
		// present on the object.
		if (
			typeof src === 'object' &&
			'image' in (src as Record<string, unknown>) &&
			(src as { image?: unknown }).image !== undefined
		) {
			return this._isDrawableImageSource((src as { image?: unknown }).image);
		}
		if (
			typeof src === 'object' &&
			'source' in (src as Record<string, unknown>) &&
			(src as { source?: unknown }).source !== undefined
		) {
			const inner = (src as { source?: unknown }).source;
			if (inner && inner !== src && typeof inner === 'object') {
				return this._isDrawableImageSource(inner);
			}
		}

		if (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) {
			return true;
		}
		if (typeof SVGImageElement !== 'undefined' && src instanceof SVGImageElement) {
			return true;
		}
		if (typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) {
			return true;
		}
		if (typeof HTMLVideoElement !== 'undefined' && src instanceof HTMLVideoElement) {
			return true;
		}
		if (typeof OffscreenCanvas !== 'undefined' && src instanceof OffscreenCanvas) {
			return true;
		}
		if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) {
			return true;
		}
		const maybeVideoFrame =
			typeof window !== 'undefined'
				? (window as unknown as Record<string, unknown>).VideoFrame
				: undefined;
		if (
			typeof maybeVideoFrame === 'function' &&
			src instanceof (maybeVideoFrame as typeof Function)
		) {
			return true;
		}

		return false;
	}

	private _resolveSpriteDrawSource(sprite: any, cacheKey?: string): CanvasImageSource | null {
		// Prefer the game-engine texture cache (the full cardboard pixels);
		// fall back to the live Phaser texture chain. The facade must go last:
		// once xrayed, its `baseTexture` view answers the xray bitmap itself,
		// which would self-sample and blank the redraw.
		const key = cacheKey ?? this._originalTextureKey ?? sprite?.key;
		if (typeof key === 'string') {
			try {
				const cached = this._gameEngine.cache.getImage(key) as unknown;
				if (this._isDrawableImageSource(cached)) {
					return cached as CanvasImageSource;
				}
			} catch {
				// Cache miss — fall through to the texture chain below.
			}
		}
		const raw = (sprite?.__unwrapped ?? sprite) as
			| {
					texture?: { source?: unknown[]; getSourceImage?: (frame?: string) => unknown };
					frame?: { name?: string };
			  }
			| undefined;
		if (raw?.texture && typeof raw.texture.getSourceImage === 'function') {
			try {
				const fromApi = raw.texture.getSourceImage(raw.frame?.name) as unknown;
				if (this._isDrawableImageSource(fromApi)) {
					return fromApi as CanvasImageSource;
				}
			} catch {
				// Fall through to the structural candidates below.
			}
		}
		const texture = sprite?.texture as
			| {
					baseTexture?: { source?: unknown; image?: unknown };
					source?: unknown;
			  }
			| undefined;
		// Phaser 4 exposes the pixels as `Texture.source[i].image`
		// (`TextureSource.image`), while the facade's `baseTexture` view
		// answers `Texture.source[0]` (the `TextureSource` wrapper). Accept
		// both so the cardboard can be resolved either through the facade or
		// a raw game object.
		const sources = Array.isArray((raw?.texture as { source?: unknown })?.source)
			? ((raw.texture as { source: unknown[] }).source as unknown[])
			: [];
		const candidates = [
			...sources.map((entry) => (entry as { image?: unknown })?.image ?? entry),
			texture?.baseTexture?.image,
			texture?.baseTexture?.source,
			texture?.source,
		];
		for (const candidate of candidates) {
			const inner =
				candidate &&
				typeof candidate === 'object' &&
				'image' in (candidate as Record<string, unknown>)
					? (candidate as { image?: unknown }).image
					: candidate;
			if (this._isDrawableImageSource(inner)) {
				return inner;
			}
			if (this._isDrawableImageSource(candidate)) {
				return candidate;
			}
		}
		return null;
	}

	/**
	 * Blits a unit cardboard into an offscreen canvas at its native texture
	 * size and returns the RGBA rows plus the canvas. The alpha channel is the
	 * xray mask source: the surface trick samples the *drawn pixels*
	 * (transparent background stays transparent), not the sprite's AABB, so the
	 * see-through cutout follows the unit silhouette instead of a rectangle.
	 */
	private _snapshotCardboardPixels(
		sprite: any,
		cacheKey?: string,
	): { canvas: HTMLCanvasElement; rgba: Uint8ClampedArray; width: number; height: number } | null {
		const src = this._resolveSpriteDrawSource(sprite, cacheKey);
		if (!this._isDrawableImageSource(src)) {
			return null;
		}
		const rect = this._resolveFrameSourceRect(sprite, 0, 0);
		if (!rect || rect.sw <= 0 || rect.sh <= 0) {
			return null;
		}
		const width = Math.round(rect.sw);
		const height = Math.round(rect.sh);
		if (width <= 0 || height <= 0) {
			return null;
		}
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) {
			return null;
		}
		try {
			ctx.clearRect(0, 0, width, height);
			ctx.drawImage(src, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, width, height);
			const rgba = ctx.getImageData(0, 0, width, height).data;
			return { canvas, rgba, width, height };
		} catch {
			return null;
		}
	}

	/**
	 * Redraws the xray canvas surface in-place using the current creature positions.
	 * Called once on initial build and then every frame so the cutout tracks movement.
	 *
	 * The mask is the UNION of all refCreatures shapes:
	 *   - Pixels covered by any ref creature : XRAY_OVERLAP_OPACITY alpha (see-through)
	 *   - All other pixels                   : 1.0 alpha (fully opaque)
	 *
	 * Returns false when nothing drawable was produced, so callers can keep the
	 * original cardboard instead of swapping in a blank bitmap.
	 */
	private _safeDrawXray(refCreatures: Creature[], bmd: any): boolean {
		return this._drawXrayBmd(refCreatures, bmd);
	}

	private _drawXrayBmd(refCreatures: Creature[], bmd: any): boolean {
		const oSprite = this._sprite;
		const oGroup = this._group;
		const otw = bmd.width;
		const oth = bmd.height;
		const unwrapSprite = (handle: any) => (handle?.__unwrapped ?? handle) as any;
		const hasLiveSceneObject = (handle: any) => {
			const raw = unwrapSprite(handle);
			return Boolean(raw && raw.scene && raw.texture && raw.frame);
		};
		// Phaser 4 dropped Phaser 2's `worldTransform`; its presence was a
		// pre-migration aliveness check that is now always falsy, so every
		// draw silently returned and the sprite kept its stale/blank bitmap.
		if (!hasLiveSceneObject(oSprite)) {
			return false;
		}
		if (!this._xrayOriginalAlpha || this._xrayOriginalAlpha.length !== otw * oth * 4) {
			return false;
		}
		if (!this._xrayRefAlpha || this._xrayRefAlpha.size !== refCreatures.length) {
			return false;
		}
		const ctx = bmd?.context as CanvasRenderingContext2D | undefined;
		if (!ctx) {
			return false;
		}

		// Like the Phaser 2 original, position comes from the local sprite
		// transform, not `getBounds()` (which is world-space and, post-migration,
		// snaps to the opaque-pixel box instead of the full cardboard). Both
		// live under the same `display` parent, so the parent terms cancel and
		// only the relative group/sprite offsets remain.
		const anchorX = Number(oSprite.anchor?.x ?? 0.5);
		const anchorY = Number(oSprite.anchor?.y ?? 1);
		const oLeft = Number(oGroup.x ?? 0) + Number(oSprite.x ?? 0) - otw * anchorX;
		const oTop = Number(oGroup.y ?? 0) + Number(oSprite.y ?? 0) - oth * anchorY;

		// Union of ref silhouettes in obstructor bitmap pixels, rebuilt every
		// frame so the cutout tracks movement. Reuse the buffer across frames.
		// The union stores the winning (lowest-row) ref index + 1 per pixel so
		// the compositor below can sample that unit's cardboard for the blend.
		if (!this._xrayMaskAlpha || this._xrayMaskAlpha.length !== otw * oth) {
			this._xrayMaskAlpha = new Uint8Array(otw * oth);
		} else {
			this._xrayMaskAlpha.fill(0);
		}
		const union = this._xrayMaskAlpha;
		let drewAnyRef = false;

		// Back rows paint first; nearer (lower-row, higher-depth) refs overwrite
		// them so each cutout pixel blends exactly one unit — the one the viewer
		// would actually see there.
		const order = refCreatures.map((_, index) => index);
		const depthOf = (index: number) => this._xrayRefAlpha?.entries[index]?.xrayDepth ?? 0;
		order.sort((a, b) => depthOf(a) - depthOf(b));

		for (const i of order) {
			const refCreature = refCreatures[i];
			const refSprite = (refCreature as Creature)?.sprite as any;
			if (!hasLiveSceneObject(refSprite)) {
				continue;
			}
			const cached = this._xrayRefAlpha.entries[i];
			if (!cached) {
				continue;
			}
			const refGrp = ((refCreature as Creature)?.grp ?? this._creature.game.grid.creatureGroup) as {
				x?: unknown;
				y?: unknown;
			};
			const refAnchorX = Number(refSprite.anchor?.x ?? 0.5);
			const refAnchorY = Number(refSprite.anchor?.y ?? 1);
			const rLeft = Number(refGrp?.x ?? 0) + Number(refSprite.x ?? 0) - cached.width * refAnchorX;
			const rTop = Number(refGrp?.y ?? 0) + Number(refSprite.y ?? 0) - cached.height * refAnchorY;
			// Bitmap pixels map 1:1 onto the local transform (same cardboard at
			// native size), so only the relative group/sprite offset matters.
			const offX = Math.round(rLeft - oLeft);
			const offY = Math.round(rTop - oTop);
			const oFlipped = Number(oSprite.scale?.x ?? 1) < 0;
			const rFlipped = Number(refSprite.scale?.x ?? 1) < 0;
			const { rgba, width: rw, height: rh } = cached;
			for (let y = 0; y < rh; y++) {
				const dstY = y + offY;
				if (dstY < 0 || dstY >= oth) continue;
				for (let x = 0; x < rw; x++) {
					// Cardboard edges are anti-aliased: weight the cutout by the
					// ref pixel's own alpha so soft fringes blend instead of
					// stamping a hard rectangle.
					const refA = rgba[(y * rw + x) * 4 + 3];
					if (refA <= 0) continue;
					// The ref's own texture column lands at `offX + srcX` on screen;
					// only the ref's own mirror matters here. The obstructor's mirror
					// is applied by the renderer, so the destination column is the
					// one whose rendered position lands on the ref.
					const srcX = rFlipped ? rw - 1 - x : x;
					const dstX = (oFlipped ? otw - 1 - (srcX + offX) : srcX + offX) | 0;
					if (dstX < 0 || dstX >= otw) continue;
					union[dstY * otw + dstX] = i + 1;
					drewAnyRef = true;
				}
			}
		}
		if (!drewAnyRef) {
			return false;
		}

		const XRAY_OVERLAP_OPACITY = 0.2;
		const overlapAlpha = Math.round(255 * (1.0 - (1.0 - XRAY_OVERLAP_OPACITY) * this._xrayAlpha));

		const out = ctx.createImageData(otw, oth);
		const src = this._xrayOriginalAlpha;
		const dst = out.data;
		// The bitmap is written in the obstructor's own texture space: the
		// renderer mirrors it through `sprite.scaleX`, so the cardboard
		// snapshot is copied 1:1. Pre-mirroring it here would flip a flipped
		// (blue) unit's cardboard a second time and it would face backwards
		// for as long as it stays xrayed.
		const oFlipped = Number(oSprite.scale?.x ?? 1) < 0;
		// Cache the winning ref's placement once per frame: the union pass
		// above already resolved overlaps, so the compositor must reuse the
		// same offsets instead of re-deriving them per pixel.
		const refPlacement = refCreatures.map((refCreature, refIndex) => {
			const entry = this._xrayRefAlpha?.entries[refIndex] ?? null;
			const refSprite = (refCreature as Creature)?.sprite as any;
			if (!entry || !refSprite) return null;
			const refGrp = ((refCreature as Creature)?.grp ?? this._creature.game.grid.creatureGroup) as {
				x?: unknown;
				y?: unknown;
			};
			const refAnchorX = Number(refSprite?.anchor?.x ?? 0.5);
			const refAnchorY = Number(refSprite?.anchor?.y ?? 1);
			const rLeft = Number(refGrp?.x ?? 0) + Number(refSprite?.x ?? 0) - entry.width * refAnchorX;
			const rTop = Number(refGrp?.y ?? 0) + Number(refSprite?.y ?? 0) - entry.height * refAnchorY;
			return {
				entry,
				offX: Math.round(rLeft - oLeft),
				offY: Math.round(rTop - oTop),
				flipped: Number(refSprite?.scale?.x ?? 1) < 0,
			};
		});
		for (let y = 0; y < oth; y++) {
			for (let x = 0; x < otw; x++) {
				const refIndex = union[y * otw + x] - 1;
				const s = (y * otw + x) * 4;
				const d = (y * otw + x) * 4;
				const a = src[s + 3];
				const placed = refIndex >= 0 ? refPlacement[refIndex] ?? null : null;
				if (a <= 0 || !placed) {
					dst[d] = src[s];
					dst[d + 1] = src[s + 1];
					dst[d + 2] = src[s + 2];
					dst[d + 3] = a;
					continue;
				}
				// Map the output pixel back into the winning ref's cardboard so
				// its silhouette can be multiplied over the obstructor.
				// `x` is the obstructor's texture column, so the matching point
				// on screen is the same one the union pass resolved; a flipped
				// ref reads that point back out of its own mirrored cardboard.
				const refEntry = placed.entry;
				const unobX = oFlipped ? otw - 1 - x : x;
				let rx = unobX - placed.offX;
				if (placed.flipped) rx = refEntry.width - 1 - rx;
				const ry = y - placed.offY;
				const refOff =
					rx >= 0 && rx < refEntry.width && ry >= 0 && ry < refEntry.height
						? (ry * refEntry.width + rx) * 4
						: -1;
				const blendT = this._xrayAlpha;
				const invT = 1 - blendT;
				const fadedA = Math.round((a * overlapAlpha) / 255);
				if (refOff < 0 || refEntry.rgba[refOff + 3] <= 0) {
					dst[d] = src[s];
					dst[d + 1] = src[s + 1];
					dst[d + 2] = src[s + 2];
					dst[d + 3] = fadedA;
					continue;
				}
				// Overlay composite: the revealed unit's cardboard modulates the
				// faded obstructor instead of punching a flat translucent hole.
				// Multiply turned every semi-transparent shadow pixel (black,
				// low alpha) into solid black regardless of its alpha, so the
				// active unit's shadow stamped an awkward dark box. Overlay
				// keeps midtones and weights the effect by the ref pixel's own
				// alpha, so faint shadows/highlighter washes barely tint while
				// opaque body pixels still read through.
				const mr = refEntry.rgba[refOff] / 255;
				const mg = refEntry.rgba[refOff + 1] / 255;
				const mb = refEntry.rgba[refOff + 2] / 255;
				const ma = refEntry.rgba[refOff + 3] / 255;
				const t = blendT * ma;
				const it = 1 - t;
				const overlayChannel = (base: number, blend: number) => {
					const b = base / 255;
					const l = blend / 255;
					const o = b <= 0.5 ? 2 * b * l : 1 - 2 * (1 - b) * (1 - l);
					return Math.round(o * 255);
				};
				const ovR = overlayChannel(src[s], refEntry.rgba[refOff]);
				const ovG = overlayChannel(src[s + 1], refEntry.rgba[refOff + 1]);
				const ovB = overlayChannel(src[s + 2], refEntry.rgba[refOff + 2]);
				dst[d] = Math.round(src[s] * it + ovR * t);
				dst[d + 1] = Math.round(src[s + 1] * it + ovG * t);
				dst[d + 2] = Math.round(src[s + 2] * it + ovB * t);
				dst[d + 3] = Math.round(a * it + fadedA * t);
			}
		}
		ctx.clearRect(0, 0, otw, oth);
		ctx.putImageData(out, 0, 0);

		bmd.commit();
		return true;
	}

	setHealth(number: number | string, type: HealthBubbleType) {
		if (this._destroyed) return;
		// Support both Phaser Text API and test doubles without setText()
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const textObj: any = (this as any)._healthIndicatorText;
		if (textObj && typeof textObj.setText === 'function') {
			textObj.setText(String(number));
		} else if (textObj) {
			textObj.text = String(number);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const spriteObj: any = (this as any)._healthIndicatorSprite;
		if (spriteObj && typeof spriteObj.setTexture === 'function') {
			spriteObj.setTexture(`p${this._creatureTeam}_${type}`);
		}
	}

	showHealth(enable: boolean) {
		if (this._destroyed) return;
		this._healthIndicatorGroup.visible = enable;
	}

	/**
	 * Reparent the health indicator into (or out of) the top-most UI group so it
	 * renders above all creature sprites. Call with true when the creature becomes
	 * active or hovered; false when it returns to normal.
	 */
	elevateHealth(enable: boolean) {
		if (this._destroyed) return;
		if (enable && !this._healthInUiGroup) {
			this._healthUiGroup.add(this._healthIndicatorGroup);
			this._healthIndicatorGroup.x = this._group.x;
			this._healthIndicatorGroup.y = this._group.y + this._healthBounceOffset;
			this._healthInUiGroup = true;
		} else if (!enable && this._healthInUiGroup) {
			this._group.add(this._healthIndicatorGroup);
			this._healthIndicatorGroup.x = 0;
			this._healthIndicatorGroup.y = 0;
			this._healthInUiGroup = false;
		}
	}

	setHealthBounce(enable: boolean) {
		if (enable) {
			const bounceHeight = 10;
			const durationMS = 350;

			if (this._healthIndicatorTween && this._healthIndicatorTween.isRunning) {
				return;
			}

			if (!this._healthIndicatorTween || !this._healthIndicatorTween.isRunning) {
				const bounceTgt = { offset: -bounceHeight };
				const bounceSrc = { offset: 0 };
				this._healthBounceOffset = 0;

				this._healthIndicatorTween = this._gameEngine
					.tween(bounceSrc)
					.to(bounceTgt, durationMS, Easing.Quadratic.InOut, true)
					.yoyo(true)
					.repeat(-1);
				this._healthIndicatorTween.onUpdateCallback(() => {
					this._healthBounceOffset = bounceSrc.offset;
				});
			}
		} else {
			if (this._healthIndicatorTween && this._healthIndicatorTween.isRunning) {
				this._healthIndicatorTween.stop();
				this._healthBounceOffset = 0;
			}
		}
	}

	getPos() {
		return this._group.position;
	}

	private _enableSkipTurnInput(sprite: any) {
		sprite.setInteractive();
		setHandCursor(sprite, true);
		onPointerDown(sprite, () => {
			if (this._creature.noActionPossible) {
				// Clear flag and fade out before click so cleanup queryMove doesn't
				// re-run querySelf and spawn a second marker mid-fade.
				this._creature.noActionPossible = false;
				this.fadeOutNoActionHints();
				this._creature.game.UI.btnSkipTurn.click();
			}
		});
	}

	private isNoActionHintType(hintType: string): boolean {
		return hintType === 'no_action' || hintType === 'no_action_bg' || hintType === 'no_action_icon';
	}

	private setSkipButtonNoActionVisibility(hidden: boolean) {
		void hidden;
	}

	private restartNoActionHintBounce() {
		if (this._noActionHintElements.length > 0) {
			this._noActionHintElements = this._noActionHintElements.filter((hint) => hint.active);
			this._noActionHintElements.forEach((hint) => {
				if (typeof hintState(hint).baseY !== 'number') {
					hintState(hint).baseY = hint.y;
				}

				if (hintState(hint).tweenBounce) {
					return;
				}

				const bounceSrc = { offset: 0 };
				const bounceTgt = { offset: -10 };
				hint.y = hintState(hint).baseY;
				hintState(hint).tweenBounce = this._gameEngine
					.tween(bounceSrc)
					.to(bounceTgt, 350, Easing.Quadratic.InOut, true)
					.yoyo(true)
					.repeat(-1);
				hintState(hint).tweenBounce.onUpdateCallback(() => {
					if (!hint.active) {
						return;
					}
					hint.y = hintState(hint).baseY + bounceSrc.offset;
				});
			});
			return;
		}

		if (!this._noActionHintGroup || !this._noActionHintGroup.active) {
			return;
		}

		if (this._noActionHintTween && this._noActionHintTween.isRunning) {
			return;
		}

		const bounceHeight = 10;
		const durationMS = 350;
		const bounceSrc = { offset: 0 };
		const bounceTgt = { offset: -bounceHeight };
		this._noActionHintGroup.y = 0;

		this._noActionHintTween = this._gameEngine
			.tween(bounceSrc)
			.to(bounceTgt, durationMS, Easing.Quadratic.InOut, true)
			.yoyo(true)
			.repeat(-1);
		this._noActionHintTween.onUpdateCallback(() => {
			if (!this._noActionHintGroup || !this._noActionHintGroup.active) {
				return;
			}
			this._noActionHintGroup.y = bounceSrc.offset;
		});
	}

	private destroyNoActionHintGroup() {
		if (this._noActionHintTween) {
			this._noActionHintTween.stop();
			this._noActionHintTween = null;
		}

		if (this._noActionHintGroup && this._noActionHintGroup.active) {
			this._noActionHintGroup.destroy(true);
		}
		this._noActionHintGroup = null;
	}

	hint(text: string, hintType: CreatureHintType) {
		const tooltipSpeed = 250;
		const tooltipDisplaySpeed = 500;
		const tooltipTransition = Easing.Linear.None;
		// Keep no-action hint bounce synced with the health indicator bounce feel.
		const noActionBounceHeight = 10;
		const noActionBounceSpeed = 350;
		const startNoActionBounce = (hintElement: any) => {
			if (hintState(hintElement).tweenBounce && hintState(hintElement).tweenBounce.isRunning) {
				return;
			}

			if (typeof hintState(hintElement).baseY !== 'number') {
				hintState(hintElement).baseY = hintElement.y;
			}

			hintElement.y = hintState(hintElement).baseY;
			const bounceSrc = { offset: 0 };
			const bounceTgt = { offset: -noActionBounceHeight };

			hintState(hintElement).tweenBounce = this._gameEngine
				.tween(bounceSrc)
				.to(bounceTgt, noActionBounceSpeed, Easing.Quadratic.InOut, true)
				.yoyo(true)
				.repeat(-1);
			hintState(hintElement).tweenBounce.onUpdateCallback(() => {
				hintElement.y = hintState(hintElement).baseY + bounceSrc.offset;
			});
		};

		const hintColor: Record<CreatureHintType, { color: string; stroke: string }> = {
			damage: {
				color: '#ff0000',
				stroke: '#000000',
			},
			confirm: {
				color: '#ffffff',
				stroke: '#000000',
			},
			gamehintblack: {
				color: '#ffffff',
				stroke: '#000000',
			},
			healing: {
				color: '#00ff00',
				stroke: '#000000',
			},
			msg_effects: {
				color: '#ffff00',
				stroke: '#000000',
			},
			creature_name: {
				color: '#ffffff',
				stroke: '#AAAAAA',
			},
			no_action: {
				color: '#ffffff',
				stroke: '#000000',
			},
			no_action_icon: {
				color: '#ffffff',
				stroke: '#000000',
			},
			no_action_bg: {
				color: '#ffffff',
				stroke: '#000000',
			},
		};

		const style = {
			...{
				font: 'bold 20pt Play',
				color: '#ff0000',
				align: 'center',
				stroke: '#000000',
				strokeThickness: 2,
			},
			...(hintColor.hasOwnProperty(hintType) ? hintColor[hintType] : {}),
		};

		const isSkipTurnConfirm = hintType === 'confirm' && text === 'Skip turn';
		if (isSkipTurnConfirm) {
			const existingSkipHints: any[] = [];
			let hasSkipTurnLabel = false;
			this._hintGrp.forEach(
				(hint: any) => {
					const state = peekHintState(hint);
					if (!hint.active || !state) {
						return;
					}

					if (state.hintType !== 'confirm' && !this.isNoActionHintType(state.hintType)) {
						return;
					}

					existingSkipHints.push(hint);
					if (hint.type === 'Text' && hint.text === 'Skip turn') {
						hasSkipTurnLabel = true;
					}
				},
				this,
				true,
			);

			if (existingSkipHints.length > 0 && hasSkipTurnLabel) {
				this._noActionHintElements = [];
				existingSkipHints.forEach((hint) => {
					if (hintState(hint).tweenBounce) {
						hintState(hint).tweenBounce.stop();
						hintState(hint).tweenBounce = null;
					}
					if (hintState(hint).tweenPos) {
						hintState(hint).tweenPos.stop();
						hintState(hint).tweenPos = null;
					}
					if (hintState(hint).tweenAlpha) {
						hintState(hint).tweenAlpha.stop();
						hintState(hint).tweenAlpha = null;
					}
					hint.alpha = 1;
					hintState(hint).hintType = 'confirm';
					hintState(hint).skipTurnStatic = true;
				});
				return;
			}
		}

		if (hintType === 'no_action') {
			const existingConfirmHints: any[] = [];
			this._hintGrp.forEach(
				(hint: any) => {
					if (!hint.active || hintState(hint).hintType !== 'confirm') {
						return;
					}

					existingConfirmHints.push(hint);
				},
				this,
				true,
			);

			if (existingConfirmHints.length > 0) {
				this.destroyNoActionHintGroup();
				this._noActionHintElements = [];

				existingConfirmHints.forEach((hint) => {
					if (hintState(hint).tweenPos) {
						hintState(hint).tweenPos.stop();
						hintState(hint).tweenPos = null;
					}
					if (hintState(hint).tweenAlpha) {
						hintState(hint).tweenAlpha.stop();
						hintState(hint).tweenAlpha = null;
					}
					hint.alpha = 1;

					// Phaser 4 replaced `instanceof Phaser.Text` with the native
					// game object `type`, which the engine handle forwards.
					if (hint.type === 'Text') {
						hintState(hint).hintType = 'no_action';
					} else if (hint.key === 'skip') {
						hintState(hint).hintType = 'no_action_icon';
					} else {
						hintState(hint).hintType = 'no_action_bg';
					}

					this._noActionHintElements.push(hint);
				});

				this.restartNoActionHintBounce();
				return;
			}

			if (this._noActionHintElements.some((hint) => hint.active)) {
				this.restartNoActionHintBounce();
				return;
			}

			this.clearHints(['confirm', 'no_action']);
			this.destroyNoActionHintGroup();

			const frame = this._gameEngine.add.sprite(0, 50, 'frame', undefined, this._hintGrp);
			const frameBackground = createGameCanvasSurface(
				this._creature.game,
				frame.width,
				frame.height,
			);
			frameBackground.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
			frameBackground.ctx.fillRect(0, 0, frameBackground.width, frameBackground.height);
			// Commit the wash before drawing the artwork over it: `drawTexture`
			// commits too, but it returns early without committing when the source
			// texture is missing, and the wash would then never reach the GPU.
			frameBackground.commit();
			frameBackground.drawTexture('frame', 0, 0);
			frame.destroy();

			const noActionFrame = this._gameEngine.add.sprite(
				0,
				50,
				frameBackground.key,
				undefined,
				this._hintGrp,
			);
			noActionFrame.setOrigin(0.5, 0.175);
			noActionFrame.setScale(0.75);
			noActionFrame.alpha = 0;
			noActionFrame.visible = true;
			hintState(noActionFrame).hintType = 'no_action_bg';
			hintState(noActionFrame).tweenAlpha = null;
			hintState(noActionFrame).tweenPos = null;
			hintState(noActionFrame).tweenBounce = null;
			this._gameEngine
				.tween(noActionFrame)
				.to({ alpha: 1 }, tooltipSpeed, tooltipTransition)
				.start();
			this._enableSkipTurnInput(noActionFrame);

			const noActionIcon = this._gameEngine.add.sprite(0, 29, 'skip', undefined, this._hintGrp);
			noActionIcon.setOrigin(0.5, 0.745);
			noActionIcon.setScale(0.15);
			noActionIcon.alpha = 0;
			noActionIcon.visible = true;
			hintState(noActionIcon).hintType = 'no_action_icon';
			hintState(noActionIcon).tweenAlpha = null;
			hintState(noActionIcon).tweenPos = null;
			hintState(noActionIcon).tweenBounce = null;
			this._gameEngine
				.tween(noActionIcon)
				.to({ alpha: 1 }, tooltipSpeed, tooltipTransition)
				.start();
			this._enableSkipTurnInput(noActionIcon);

			const noActionText = this._gameEngine.add.text(0, 50, text, style, this._hintGrp);
			noActionText.setOrigin(0.5, 0.5);
			noActionText.alpha = 0;
			hintState(noActionText).hintType = 'no_action';
			hintState(noActionText).tweenAlpha = null;
			hintState(noActionText).tweenPos = null;
			hintState(noActionText).tweenBounce = null;
			this._gameEngine
				.tween(noActionText)
				.to({ alpha: 1 }, tooltipSpeed, tooltipTransition)
				.start();

			this._noActionHintElements = [noActionFrame, noActionIcon, noActionText];

			this._hintGrp.forEach(
				(hint: any) => {
					const index = this._hintGrp.total - this._hintGrp.getIndex(hint) - 1;
					const offset = -50 * index;
					const state = hintState(hint);

					if (state.tweenBounce) {
						state.tweenBounce.stop();
						state.tweenBounce = null;
					}

					if (state.tweenPos) {
						state.tweenPos.stop();
						state.tweenPos = null;
					}

					hint.x = 0;

					if (this.isNoActionHintType(state.hintType)) {
						hint.y = offset;
						startNoActionBounce(hint);
						return;
					}

					state.tweenPos = this._gameEngine
						.tween(hint)
						.to({ y: offset }, tooltipSpeed, tooltipTransition)
						.start();
				},
				this,
				true,
			);
			this.restartNoActionHintBounce();
			return;
		}

		// Remove constant element
		// Animation length reduced from 250 to 100 to prevent animation overlap
		this._hintGrp.forEach(
			(hint: any) => {
				const state = peekHintState(hint);
				if (!state || (state.hintType !== 'confirm' && !this.isNoActionHintType(state.hintType))) {
					return;
				}

				if (state.tweenBounce) {
					state.tweenBounce.stop();
					state.tweenBounce = null;
				}

				state.hintType = 'confirm_deleted';
				state.tweenAlpha = this._gameEngine
					.tween(hint)
					.to({ alpha: 0 }, 100, tooltipTransition)
					.start();
				state.tweenAlpha.onComplete.add(() => hint.destroy());
			},
			this,
			true,
		);

		const hint = this._gameEngine.add.text(0, 50, text, style, this._hintGrp);
		hint.setOrigin(0.5, 0.5);

		hint.alpha = isSkipTurnConfirm ? 1 : 0;
		hintState(hint).hintType = hintType;
		hintState(hint).tweenAlpha = null;
		hintState(hint).tweenPos = null;
		hintState(hint).tweenBounce = null;
		hintState(hint).skipTurnStatic = isSkipTurnConfirm;

		if (hintType === 'confirm') {
			if (!isSkipTurnConfirm) {
				hintState(hint).tweenAlpha = this._gameEngine
					.tween(hint)
					.to({ alpha: 1 }, tooltipSpeed, tooltipTransition)
					.start();
			}
		} else {
			hintState(hint).tweenAlpha = this._gameEngine
				.tween(hint)
				.to({ alpha: 1 }, tooltipSpeed, tooltipTransition)
				.to({ alpha: 1 }, tooltipDisplaySpeed, tooltipTransition)
				.to({ alpha: 0 }, tooltipSpeed, tooltipTransition)
				.start();
			hintState(hint).tweenAlpha.onComplete.add(() => hint.destroy());
		}

		if (hintType === 'confirm') {
			// Add "Skip turn" frame
			const frame = this._gameEngine.add.sprite(0, 50, 'frame', undefined, this._hintGrp);
			const frameBackground = createGameCanvasSurface(
				this._creature.game,
				frame.width,
				frame.height,
			);
			frameBackground.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
			frameBackground.ctx.fillRect(0, 0, frameBackground.width, frameBackground.height);
			// Commit the wash before drawing the artwork over it: `drawTexture`
			// commits too, but it returns early without committing when the source
			// texture is missing, and the wash would then never reach the GPU.
			frameBackground.commit();
			frameBackground.drawTexture('frame', 0, 0);
			// Destroy the temporary frame sprite after using it as a texture source
			// to prevent it from lingering in the upper-left corner of the canvas
			frame.destroy();
			const combinedSprite = this._gameEngine.add.sprite(
				0,
				50,
				frameBackground.key,
				undefined,
				this._hintGrp,
			);
			combinedSprite.setOrigin(0.5, 0.175);
			combinedSprite.setScale(0.75);
			combinedSprite.alpha = isSkipTurnConfirm ? 1 : 0;
			combinedSprite.visible = true;
			hintState(combinedSprite).hintType = hintType;
			hintState(combinedSprite).tweenAlpha = null;
			hintState(combinedSprite).tweenPos = null;
			hintState(combinedSprite).tweenBounce = null;
			hintState(combinedSprite).skipTurnStatic = isSkipTurnConfirm;
			if (!isSkipTurnConfirm) {
				this._gameEngine
					.tween(combinedSprite)
					.to({ alpha: 1 }, tooltipSpeed, tooltipTransition)
					.start();
			}
			this._enableSkipTurnInput(combinedSprite);

			// Add "Skip turn" icon
			const skipTurnIcon = this._gameEngine.add.sprite(0, 29, 'skip', undefined, this._hintGrp);
			skipTurnIcon.setOrigin(0.5, 0.745);
			skipTurnIcon.setScale(0.15);
			skipTurnIcon.alpha = isSkipTurnConfirm ? 1 : 0;
			skipTurnIcon.visible = true;
			hintState(skipTurnIcon).hintType = hintType;
			hintState(skipTurnIcon).tweenAlpha = null;
			hintState(skipTurnIcon).tweenPos = null;
			hintState(skipTurnIcon).tweenBounce = null;
			hintState(skipTurnIcon).skipTurnStatic = isSkipTurnConfirm;
			if (!isSkipTurnConfirm) {
				this._gameEngine
					.tween(skipTurnIcon)
					.to({ alpha: 1 }, tooltipSpeed, tooltipTransition)
					.start();
			}
			this._enableSkipTurnInput(skipTurnIcon);
		}

		// Stacking
		this._hintGrp.forEach(
			(hint: any) => {
				const index = this._hintGrp.total - this._hintGrp.getIndex(hint) - 1;
				const offset = -50 * index;
				const state = hintState(hint);

				if (state.tweenBounce) {
					state.tweenBounce.stop();
					state.tweenBounce = null;
				}

				if (state.tweenPos) {
					state.tweenPos.stop();
					state.tweenPos = null;
				}

				hint.x = 0;

				if (state.hintType === 'no_action') {
					this.setSkipButtonNoActionVisibility(true);
					// Keep no-action hints stable on first show: place immediately, then bounce.
					hint.y = offset;
					startNoActionBounce(hint);
					return;
				}

				if (state.skipTurnStatic) {
					hint.y = offset;
					return;
				}

				state.tweenPos = this._gameEngine
					.tween(hint)
					.to({ y: offset }, tooltipSpeed, tooltipTransition)
					.start();
			},
			this,
			true,
		);
	}

	stopNoActionHintBounce() {
		this._noActionHintElements.forEach((hint) => {
			const state = peekHintState(hint);
			if (!hint.active || !state) {
				return;
			}

			if (state.tweenBounce) {
				state.tweenBounce.stop();
				state.tweenBounce = null;
			}

			if (typeof state.baseY === 'number') {
				hint.y = state.baseY;
			}
		});
		this._noActionHintElements = this._noActionHintElements.filter((hint) => hint.active);

		if (this._noActionHintTween) {
			this._noActionHintTween.stop();
			this._noActionHintTween = null;
		}
		if (this._noActionHintGroup && this._noActionHintGroup.active) {
			this._noActionHintGroup.y = 0;
		}
	}

	fadeOutNoActionHints() {
		const tooltipSpeed = 250;
		const tooltipTransition = Easing.Linear.None;
		const noActionHints = this._noActionHintElements.filter((hint) => hint.active);
		this._noActionHintElements = [];

		// Tag as deleted immediately so any concurrent hint('Skip turn','confirm') call
		// (e.g. from cleanup queryMove on turn-end) does not detect these as live hints
		// and spawn a second marker on top of the fading one.
		noActionHints.forEach((hint) => {
			const state = peekHintState(hint);
			if (state) {
				state.hintType = 'confirm_deleted';
			}
		});

		noActionHints.forEach((hint) => {
			if (!peekHintState(hint)) {
				return;
			}

			if (hintState(hint).tweenBounce) {
				hintState(hint).tweenBounce.stop();
				hintState(hint).tweenBounce = null;
			}
			if (hintState(hint).tweenPos) {
				hintState(hint).tweenPos.stop();
				hintState(hint).tweenPos = null;
			}
			if (hintState(hint).tweenAlpha) {
				hintState(hint).tweenAlpha.stop();
				hintState(hint).tweenAlpha = null;
			}

			const targetY = hint.y - 30;
			hintState(hint).tweenPos = this._gameEngine
				.tween(hint)
				.to({ y: targetY }, tooltipSpeed, tooltipTransition)
				.start();

			hintState(hint).tweenAlpha = this._gameEngine
				.tween(hint)
				.to({ alpha: 0 }, tooltipSpeed, tooltipTransition)
				.start();
			hintState(hint).tweenAlpha.onComplete.add(() => {
				if (hint.active) {
					hint.destroy();
				}
			});
		});

		if (this._noActionHintTween) {
			this._noActionHintTween.stop();
			this._noActionHintTween = null;
		}
		if (this._noActionHintGroup && this._noActionHintGroup.active) {
			const group = this._noActionHintGroup;
			this._noActionHintGroup = null;

			this._gameEngine
				.tween(group)
				.to({ y: group.y - 30 }, tooltipSpeed, tooltipTransition)
				.start();
			const fadeTween = this._gameEngine
				.tween(group)
				.to({ alpha: 0 }, tooltipSpeed, tooltipTransition)
				.start();
			fadeTween.onComplete.add(() => group.destroy(true));
		}
	}

	clearHints(hintTypes: CreatureHintType[] = ['confirm', 'no_action']) {
		const tooltipTransition = Easing.Linear.None;
		if (hintTypes.includes('no_action')) {
			this._noActionHintElements = [];
			this.destroyNoActionHintGroup();
		}

		this._hintGrp.forEach(
			(hint: any) => {
				// An element with no recorded type was never one of ours (the group
				// also holds the health/frame sprites), so it is not ours to clear.
				const state = peekHintState(hint);
				if (!state || !state.hintType) {
					return;
				}

				// An earlier clear already tagged this one and started its fade.
				// Re-tagging it would orphan that tween and let the element be
				// destroyed twice.
				if (state.hintType === 'confirm_deleted') {
					return;
				}

				const isNoAction = this.isNoActionHintType(state.hintType);
				if (
					!hintTypes.includes(state.hintType) &&
					!(isNoAction && hintTypes.includes('no_action'))
				) {
					return;
				}

				state.hintType = 'confirm_deleted';
				if (state.tweenBounce) {
					state.tweenBounce.stop();
					state.tweenBounce = null;
				}
				if (state.tweenAlpha) {
					state.tweenAlpha.stop();
				}
				state.tweenAlpha = this._gameEngine
					.tween(hint)
					.to({ alpha: 0 }, 100, tooltipTransition)
					.start();
				state.tweenAlpha.onComplete.add(() => hint.destroy());
			},
			this,
			true,
		);
	}

	destroy() {
		if (this._destroyed) return;
		this._destroyed = true;
		this._freeXrayState();
		this._creature.game.animations.disposeInfernalCardboardEffect(this._creature);
		this._healthIndicatorTween?.stop();
		this._noActionHintTween?.stop();
		// A hover reparents the health bar out of the creature group and into the
		// elevated UI layer, so it is no longer covered by the container teardown
		// below and has to be released explicitly.
		if (this._healthInUiGroup) {
			this._healthUiGroup?.remove(this._healthIndicatorGroup, true);
			this._healthInUiGroup = false;
		}
		// Phaser 2's `removeChild` only detached the container, leaving the
		// cardboard, the hint group and their tweens alive with no owner — the
		// wall's sprite outlived the wall. `remove(child, true)` destroys the
		// whole subtree instead.
		this._group.parent?.removeChild(this._group, true);
	}
}

export type CreatureHintType =
	| 'confirm'
	| 'damage'
	| 'gamehintblack'
	| 'healing'
	| 'msg_effects'
	| 'creature_name'
	| 'no_action'
	/**
	 * The two satellites of a `no_action` hint. They are separate elements in the
	 * hint group so they can be faded and bounced independently, so each needs
	 * its own tag even though {@link CreatureSprite.isNoActionHintType} treats all
	 * three alike.
	 */
	| 'no_action_icon'
	| 'no_action_bg';

type HealthBubbleType = 'plasma' | 'frozen' | 'health';
