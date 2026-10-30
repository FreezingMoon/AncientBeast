/* eslint-disable @typescript-eslint/no-explicit-any */
import * as version from '../utility/version';

/**
 * Game Snapshot Database Schema v2
 *
 * This is a COMPLETE database snapshot of the game state.
 * Every field that affects gameplay MUST be here.
 * When adding new game elements, ADD THEM HERE FIRST.
 *
 * Version history:
 * v1: Initial release (basic creatures, players, traps, drops, effects)
 * v2: Complete state - all creature fields, trap effects, effect owner/target resolution,
 *     plasma, time pools, meta powers, queue state, ability cooldowns, etc.
 */

const SEPARATOR = '||';
const PREFIX = `Ancient Beast ${version.full} GameSnapshot v2 | Generated on `;

export const SNAPSHOT_VERSION = 2;

/**
 * Migration function type for upgrading snapshots
 */
export type SnapshotMigration = (snapshot: any) => any;

/**
 * Migration registry - add migrations here when schema changes
 */
export const SNAPSHOT_MIGRATIONS: Record<number, SnapshotMigration> = {
	// 1 -> 2: Add missing fields, fix effect owner/target resolution
	2: (snapshot) => {
		// Ensure all creatures have complete fields
		if (snapshot.creatures) {
			snapshot.creatures.forEach((c: any) => {
				// Ensure all creature fields exist with defaults
				c._waitedTurn = c._waitedTurn ?? 0;
				c.isDelayed = c.isDelayed ?? false;
				c.isDelayedInNextQueue = c.isDelayedInNextQueue ?? false;
				c._afterimages = c._afterimages ?? false;
				c._summonCreaturesWithMaterializationSickness =
					c._summonCreaturesWithMaterializationSickness ?? false;
				c.materializationSickness = c.materializationSickness ?? false;
				c.noActionPossible = c.noActionPossible ?? false;
				c._afterimages = c._afterimages ?? false;
				c._summonCreaturesWithMaterializationSickness =
					c._summonCreaturesWithMaterializationSickness ?? false;
				c.accumulatedTeleportRange = c.accumulatedTeleportRange ?? 0;
				c._brbActive = c._brbActive ?? false;
				c._brbState = c._brbState ?? null;
				c._brbSpent = c._brbSpent ?? false;
				c._lastBurningSpiritDamage = c._lastBurningSpiritDamage ?? null;
				c._bonfireSpringCount = c._bonfireSpringCount ?? 0;
				c.accumulatedTeleportRange = c.accumulatedTeleportRange ?? 0;
				c._brbActive = c._brbActive ?? false;
				c._brbState = c._brbState ?? null;
				c._brbSpent = c._brbSpent ?? false;
				c._lastBurningSpiritDamage = c._lastBurningSpiritDamage ?? null;
				c._bonfireSpringCount = c._bonfireSpringCount ?? 0;
				c.travelDist = c.travelDist ?? 0;
				c.protectedFromFatigue = c.protectedFromFatigue ?? false;
				c.turnsActive = c.turnsActive ?? 0;
				c.materializationSickness = c.materializationSickness ?? false;
				c.noActionPossible = c.noActionPossible ?? false;
				c.accumulatedTeleportRange = c.accumulatedTeleportRange ?? 0;
				c._brbActive = c._brbActive ?? false;
				c._brbState = c._brbState ?? null;
				c._brbSpent = c._brbSpent ?? false;
				c._lastBurningSpiritDamage = c._lastBurningSpiritDamage ?? null;
				c._bonfireSpringCount = c._bonfireSpringCount ?? 0;
				c.protectedFromFatigue = c.protectedFromFatigue ?? false;
				c.turnsActive = c.turnsActive ?? 0;
				c.materializationSickness = c.materializationSickness ?? false;
				c.noActionPossible = c.noActionPossible ?? false;
				c.accumulatedTeleportRange = c.accumulatedTeleportRange ?? 0;
				c._brbActive = c._brbActive ?? false;
				c._brbState = c._brbState ?? null;
				c._brbSpent = c._brbSpent ?? false;
				c._lastBurningSpiritDamage = c._lastBurningSpiritDamage ?? null;
				c._bonfireSpringCount = c._bonfireSpringCount ?? 0;
				c.travelDist = c.travelDist ?? 0;
				c.protectedFromFatigue = c.protectedFromFatigue ?? false;
				c.turnsActive = c.turnsActive ?? 0;
				c.materializationSickness = c.materializationSickness ?? false;
				c.noActionPossible = c.noActionPossible ?? false;
				c.accumulatedTeleportRange = c.accumulatedTeleportRange ?? 0;
				c._brbActive = c._brbActive ?? false;
				c._brbState = c._brbState ?? null;
				c._brbSpent = c._brbSpent ?? false;
				c._lastBurningSpiritDamage = c._lastBurningSpiritDamage ?? null;
				c._bonfireSpringCount = c._bonfireSpringCount ?? 0;
				c.status = c.status ?? { frozen: false, cryostasis: false, dizzy: false };
				c.baseStats = c.baseStats ?? {};
				c.stats = c.stats ?? {};
				c.abilities = c.abilities ?? [];
				c.effects = c.effects ?? [];
				c.dropCollection = c.dropCollection ?? [];
				c._waitedTurn = c._waitedTurn ?? 0;
				c.isDelayed = c.isDelayed ?? false;
				c.isDelayedInNextQueue = c.isDelayedInNextQueue ?? false;
				c._afterimages = c._afterimages ?? false;
				c._summonCreaturesWithMaterializationSickness =
					c._summonCreaturesWithMaterializationSickness ?? false;
			});
		}

		// Ensure effects have proper owner/target resolution fields
		if (snapshot.effects) {
			snapshot.effects.forEach((e: any) => {
				e.ownerType = e.ownerType ?? 'creature';
				e.ownerId = e.ownerId ?? null;
				e.targetType = e.targetType ?? 'creature';
				e.targetId = e.targetId ?? null;
				e.specialHint = e.specialHint ?? '';
				e.alterations = e.alterations ?? {};
				e.attacker = e.attacker ?? null;
				e.isDeleted = e.isDeleted ?? false;
				e.stackable = e.stackable ?? false;
				e.deleteOnOwnerDeath = e.deleteOnOwnerDeath ?? false;
				e.deleteTrigger = e.deleteTrigger ?? 'turnEnd';
				e.stackable = e.stackable ?? false;
				e.deleteOnOwnerDeath = e.deleteOnOwnerDeath ?? false;
			});
		}

		// Ensure traps have all fields
		if (snapshot.traps) {
			snapshot.traps.forEach((t: any) => {
				t.creationTurn = t.creationTurn ?? 0;
				t.turnLifetime = t.turnLifetime ?? 0;
				t.fullTurnLifetime = t.fullTurnLifetime ?? false;
				t.ownerCreature = t.ownerCreature ?? undefined;
				t.destroyOnActivate = t.destroyOnActivate ?? false;
				t.typeOver = t.typeOver ?? false;
				t.destroyAnimation = t.destroyAnimation ?? '';
				t.effects = t.effects ?? [];
			});
		}

		// Ensure drops have all fields
		if (snapshot.drops) {
			snapshot.drops.forEach((d: any) => {
				d.alterations = d.alterations ?? {};
				d.pickedUp = d.pickedUp ?? false;
			});
		}

		// Ensure players have all fields
		if (snapshot.players) {
			snapshot.players.forEach((p: any) => {
				p.plasma = p.plasma ?? 0;
				p.flipped = p.flipped ?? false;
				p.hasLost = p.hasLost ?? false;
				p.hasFled = p.hasFled ?? false;
				p.bonusTimePool = p.bonusTimePool ?? 0;
				p.totalTimePool = p.totalTimePool ?? 0;
				p.startTime = p.startTime ?? new Date().toISOString();
				p.summonCreaturesWithMaterializationSickness =
					p.summonCreaturesWithMaterializationSickness ?? false;
				p.score = p.score ?? [];
			});
		}

		// Ensure global game state
		snapshot.turn = snapshot.turn ?? 1;
		snapshot.round = snapshot.round ?? 0;
		snapshot.fastForward = snapshot.fastForward ?? false;
		snapshot.gameState = snapshot.gameState ?? 'playing';
		snapshot.activeCreatureId = snapshot.activeCreatureId ?? null;
		snapshot.playersReady = snapshot.playersReady ?? false;
		snapshot.turnThrottle = snapshot.turnThrottle ?? false;
		snapshot.bloodCount = snapshot.bloodCount ?? 0;
		snapshot.trapId = snapshot.trapId ?? 0;
		snapshot.effectId = snapshot.effectId ?? 0;
		snapshot.dropId = snapshot.dropId ?? 0;
		snapshot.metaPowersState = snapshot.metaPowersState ?? {
			executeMonster: false,
			resetCooldowns: false,
			disableMaterializationSickness: false,
			infiniteEnergy: false,
		};
		snapshot.configData = snapshot.configData ?? {};
		snapshot.availableCreatures = snapshot.availableCreatures ?? [];
		snapshot.lastSummonedType = snapshot.lastSummonedType ?? null;
		snapshot.queue = snapshot.queue ?? [];
		snapshot.turn = snapshot.turn ?? 1;
		snapshot.round = snapshot.round ?? 0;
		snapshot.bloodCount = snapshot.bloodCount ?? 0;
		snapshot.trapId = snapshot.trapId ?? 0;
		snapshot.effectId = snapshot.effectId ?? 0;
		snapshot.dropId = snapshot.dropId ?? 0;
		snapshot.metaPowersState = snapshot.metaPowersState ?? {
			executeMonster: false,
			resetCooldowns: false,
			disableMaterializationSickness: false,
			infiniteEnergy: false,
		};
		snapshot.configData = snapshot.configData ?? {};
		snapshot.availableCreatures = snapshot.availableCreatures ?? [];
		snapshot.lastSummonedType = snapshot.lastSummonedType ?? null;
		snapshot.queue = snapshot.queue ?? [];
		snapshot.turn = snapshot.turn ?? 1;
		snapshot.round = snapshot.round ?? 0;
		snapshot.bloodCount = snapshot.bloodCount ?? 0;
		snapshot.trapId = snapshot.trapId ?? 0;
		snapshot.effectId = snapshot.effectId ?? 0;
		snapshot.dropId = snapshot.dropId ?? 0;
		snapshot.metaPowersState = snapshot.metaPowersState ?? {
			executeMonster: false,
			resetCooldowns: false,
			disableMaterializationSickness: false,
			infiniteEnergy: false,
		};
		snapshot.configData = snapshot.configData ?? {};
		snapshot.availableCreatures = snapshot.availableCreatures ?? [];
		snapshot.lastSummonedType = snapshot.lastSummonedType ?? null;
		snapshot.queue = snapshot.queue ?? [];
	},
};

/**
 * Apply migrations to bring snapshot to current version
 */
export function migrateSnapshot(snapshot: any): any {
	let currentVersion = snapshot.version || 1;
	while (currentVersion < SNAPSHOT_VERSION) {
		const migration = SNAPSHOT_MIGRATIONS[currentVersion + 1];
		if (migration) {
			snapshot = migration(snapshot);
			currentVersion++;
		} else {
			break;
		}
	}
	snapshot.version = SNAPSHOT_VERSION;
	return snapshot;
}

export type AbilitySnapshot = {
	id: number;
	used: boolean;
	priority: number;
	timesUsed: number;
	timesUsedThisTurn: number;
	token: number;
	upgraded: boolean;
	trigger?: string;
};

export type CreatureSnapshot = {
	// Identity
	id: number;
	type: string;
	name: string;
	// Position
	x: number;
	y: number;
	// Team
	team: number;
	// State
	temp: boolean;
	dead: boolean;
	// Queue state
	hasWait: boolean;
	travelDist: number;
	protectedFromFatigue: boolean;
	_waitedTurn: number;
	_hinderedTurn: number;
	_nextGameTurnActive: number;
	turnsActive: number;
	materializationSickness: boolean;
	noActionPossible: boolean;
	// Stats
	health: number;
	endurance: number;
	energy: number;
	remainingMove: number;
	movementPool: number;
	accumulatedTeleportRange: number;
	// BRB state
	_brbActive: boolean;
	_brbState: { killer: any; gooTrap: any } | null;
	_brbSpent: boolean;
	_lastBurningSpiritDamage: any;
	_bonfireSpringCount: number | undefined;
	// Status
	status: { frozen: boolean; cryostasis: boolean; dizzy: boolean };
	// Stats
	baseStats: Record<string, any>;
	stats: Record<string, any>;
	// Abilities
	abilities: AbilitySnapshot[];
	// Effects
	effects: number[]; // effect ids owned by this creature
	// Drops
	dropCollection: string[]; // drop names collected
	// Additional state
	isDelayed: boolean;
	isDelayedInNextQueue: boolean;
	_afterimages: boolean;
	_summonCreaturesWithMaterializationSickness: boolean;
};

export type TrapSnapshot = {
	id: number;
	x: number;
	y: number;
	type: string;
	name: string;
	creationTurn: number;
	turnLifetime: number;
	fullTurnLifetime: boolean;
	ownerCreature: number | undefined;
	destroyOnActivate: boolean;
	typeOver: boolean;
	destroyAnimation: string;
	effects: number[]; // effect ids owned by this trap
};

export type DropSnapshot = {
	id: number;
	name: string;
	x: number;
	y: number;
	alterations: Record<string, any>;
	pickedUp: boolean;
};

export type EffectSnapshot = {
	id: number;
	name: string;
	creationTurn: number;
	turnLifetime: number;
	deleteTrigger: string;
	stackable: boolean;
	deleteOnOwnerDeath: boolean;
	isDeleted: boolean;
	attacker: number | null;
	alterations: Record<string, any>;
	specialHint: string;
	// owner/target are resolved back to creature/trap ids at load time.
	ownerType: 'creature' | 'trap' | 'hex';
	ownerId: number | null;
	targetType: 'creature' | 'trap' | 'hex';
	targetId: number | null;
};

export type PlayerSnapshot = {
	id: number;
	controller: string;
	color: string;
	plasma: number;
	flipped: boolean;
	hasLost: boolean;
	hasFled: boolean;
	bonusTimePool: number;
	totalTimePool: number;
	startTime: string; // ISO string
	summonCreaturesWithMaterializationSickness: boolean;
	score: any[];
};

export type GameSnapshot = {
	// Schema version for migrations
	version: string;
	// Metadata
	date: string;
	// Game state
	turn: number;
	round: number;
	fastForward: boolean;
	gameState: string;
	activeCreatureId: number | null;
	playersReady: boolean;
	turnThrottle: boolean;
	// Counters
	bloodCount: number;
	trapId: number;
	effectId: number;
	dropId: number;
	// Meta powers
	metaPowersState: {
		executeMonster: boolean;
		resetCooldowns: boolean;
		disableMaterializationSickness: boolean;
		infiniteEnergy: boolean;
	};
	// Config
	configData: Record<string, any>;
	availableCreatures: string[];
	lastSummonedType: string | null;
	// Entities
	players: PlayerSnapshot[];
	creatures: CreatureSnapshot[];
	traps: TrapSnapshot[];
	drops: DropSnapshot[];
	effects: EffectSnapshot[];
	queue: number[];
};

function getYearMonthDayStr(): string {
	return new Date().toISOString().slice(0, 10);
}

export class GameSnapshotSerializer {
	static stringify(snapshot: GameSnapshot): string {
		const seen = new WeakSet<object>();
		const json = JSON.stringify(snapshot, (_key, value) => {
			// Some abilities stash a `sourceCreature` circular reference on
			// damage/effect records; drop it like the gamelog replacer does.
			if (value && typeof value === 'object') {
				if (value.sourceCreature !== undefined) {
					return { ...value, sourceCreature: {} };
				}
				// Skip Phaser objects (they have toJSON that may throw)
				if (
					value.anims !== undefined ||
					value.scene !== undefined ||
					value.textures !== undefined
				) {
					return '[Phaser]';
				}
				if (seen.has(value)) {
					return '[Circular]';
				}
				seen.add(value);
			}
			return value;
		});
		// Use UTF-8 safe base64 encoding (btoa only handles Latin1)
		const utf8Json = encodeURIComponent(json);
		const base64 = btoa(
			utf8Json.replace(/%([0-9A-F]{2})/g, (_match, p1) => String.fromCharCode(parseInt(p1, 16))),
		);
		return `${PREFIX}${getYearMonthDayStr()} ${SEPARATOR}${base64}`;
	}

	static from(str: string): GameSnapshot {
		const parts = str.split(SEPARATOR);
		const payload = parts.length > 1 ? parts[parts.length - 1] : parts[0];
		// Decode UTF-8 safe base64
		const binary = atob(payload);
		const utf8Json = binary
			.split('')
			.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
			.join('');
		const json = decodeURIComponent(utf8Json);
		const snapshot = JSON.parse(json);
		// Apply migrations
		return migrateSnapshot(snapshot);
	}

	static isSnapshotString(str: string): boolean {
		return str.startsWith('Ancient Beast') && str.includes('GameSnapshot');
	}
}
