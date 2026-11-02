/* eslint-disable @typescript-eslint/no-explicit-any */
import * as version from '../utility/version';

/**
 * Game Snapshot Database Schema v6
 *
 * This is a versioned, data-only snapshot format. Match state that cannot be
 * rehydrated without runtime callbacks is rejected rather than silently omitted.
 *
 * Version history:
 * v1: Initial release (basic creatures, players, traps, drops, effects)
 * v2: Complete state - all creature fields, trap effects, effect owner/target resolution,
 *     plasma, time pools, meta powers, queue state, ability cooldowns, etc.
 * v3: Preserve drop modifiers, trap owners, active plasma fields, and stable score/BRB references.
 * v4: Add runtime-safety metadata and refuse snapshots containing unrehydratable behavior.
 * v5: Identify registered effect/trap behaviors so supported callbacks can be rehydrated.
 * v6: Preserve registered, data-backed queue events.
 */

const SEPARATOR = '||';
const PREFIX = `Ancient Beast ${version.full} GameSnapshot v6 | Generated on `;

export const SNAPSHOT_VERSION = 6;

export class SnapshotCompatibilityError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SnapshotCompatibilityError';
	}
}

/**
 * Validate that a snapshot can be restored by this build without guessing.
 */
export function validateSnapshot(snapshot: any): any {
	if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
		throw new Error('Invalid game snapshot: expected an object.');
	}
	if (snapshot.version !== SNAPSHOT_VERSION) {
		throw new SnapshotCompatibilityError(
			`Snapshot version ${
				snapshot.version ?? 'unknown'
			} cannot guarantee match-faithful restoration. ` +
				`Only version ${SNAPSHOT_VERSION} snapshots are supported; save a new snapshot from the current game.`,
		);
	}
	if (
		snapshot.runtimeSafety?.version !== 1 ||
		!Array.isArray(snapshot.queuedEvents) ||
		snapshot.runtimeSafety.pendingQueueEvents !== snapshot.queuedEvents.length ||
		snapshot.runtimeSafety.activeAnimations !== false ||
		snapshot.runtimeSafety.deferredQueryMoves !== 0
	) {
		throw new SnapshotCompatibilityError(
			'Snapshot is missing the runtime-safety guarantees required for faithful restoration.',
		);
	}
	if (
		!Array.isArray(snapshot.effects) ||
		snapshot.effects.some(
			(effect: any) =>
				typeof effect.runtimeCallbacks !== 'boolean' ||
				(effect.runtimeCallbacks && typeof effect.snapshotBehaviorId !== 'string') ||
				(effect.ownerType === 'hex' &&
					(!Number.isInteger(effect.ownerX) || !Number.isInteger(effect.ownerY))) ||
				(effect.targetType === 'hex' &&
					(!Number.isInteger(effect.targetX) || !Number.isInteger(effect.targetY))),
		) ||
		!Array.isArray(snapshot.traps) ||
		snapshot.traps.some(
			(trap: any) =>
				typeof trap.onDestroyCallback !== 'boolean' ||
				(trap.onDestroyCallback && typeof trap.snapshotBehaviorId !== 'string'),
		) ||
		!Array.isArray(snapshot.queue) ||
		snapshot.queue.some((id: unknown) => !Number.isInteger(id)) ||
		snapshot.queuedEvents.some(
			(event: any) =>
				typeof event.id !== 'string' ||
				typeof event.snapshotBehaviorId !== 'string' ||
				!Number.isInteger(event.turn) ||
				!Number.isFinite(event.initiative) ||
				typeof event.title !== 'string' ||
				typeof event.data !== 'object' ||
				event.data === null ||
				Array.isArray(event.data),
		)
	) {
		throw new SnapshotCompatibilityError(
			'Snapshot contains runtime behavior that cannot be restored safely.',
		);
	}
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
	triggeredThisChain?: boolean;
	_strikes?: Record<number, number>;
	_lastTargetId?: number;
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
	killer: number | null;
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
	oldHealth: number;
	plasmaFieldActiveTurn: boolean;
	endurance: number;
	energy: number;
	oldEnergy: number;
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
	dropCollection: { name: string; alterations: Record<string, any> }[];
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
	owner: number;
	onDestroyCallback: boolean;
	snapshotBehaviorId?: string;
	snapshotBehaviorData?: Record<string, unknown>;
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
	trigger: string;
	creationTurn: number;
	turnLifetime: number;
	deleteTrigger: string;
	stackable: boolean;
	deleteOnOwnerDeath: boolean;
	isDeleted: boolean;
	attacker: number | null;
	triggeredThisChain: boolean;
	alterations: Record<string, any>;
	specialHint: string;
	// owner/target are resolved back to creature/trap ids at load time.
	ownerType: 'creature' | 'trap' | 'hex';
	ownerId: number | null;
	ownerX?: number;
	ownerY?: number;
	targetType: 'creature' | 'trap' | 'hex';
	targetId: number | null;
	targetX?: number;
	targetY?: number;
	runtimeCallbacks: boolean;
	snapshotBehaviorId?: string;
	snapshotBehaviorData?: Record<string, unknown>;
};

export type QueueEventSnapshot = {
	id: string;
	snapshotBehaviorId: string;
	turn: number;
	initiative: number;
	delayed?: boolean;
	title: string;
	data: Record<string, unknown>;
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
	version: number;
	runtimeSafety: {
		version: 1;
		pendingQueueEvents: number;
		activeAnimations: false;
		deferredQueryMoves: 0;
	};
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
	plasmaAmount?: number;
	// Entities
	players: PlayerSnapshot[];
	creatures: CreatureSnapshot[];
	traps: TrapSnapshot[];
	drops: DropSnapshot[];
	effects: EffectSnapshot[];
	queue: number[];
	queuedEvents: QueueEventSnapshot[];
};

function getYearMonthDayStr(): string {
	return new Date().toISOString().slice(0, 10);
}

export class GameSnapshotSerializer {
	static stringify(snapshot: GameSnapshot): string {
		const ancestors: object[] = [];
		const json = JSON.stringify(snapshot, function (key, value) {
			if (key === 'sourceCreature') {
				return {};
			}
			if (value && typeof value === 'object') {
				// Skip Phaser objects (they have toJSON that may throw)
				if (
					value.anims !== undefined ||
					value.scene !== undefined ||
					value.textures !== undefined
				) {
					return '[Phaser]';
				}
				while (ancestors.length && ancestors[ancestors.length - 1] !== this) {
					ancestors.pop();
				}
				if (ancestors.includes(value)) {
					return '[Circular]';
				}
				ancestors.push(value);
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
		return validateSnapshot(snapshot);
	}

	static isSnapshotString(str: string): boolean {
		return str.startsWith('Ancient Beast') && str.includes('GameSnapshot');
	}
}
