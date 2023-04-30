import { Creature } from '../creature';
import { Drop } from '../drops';
import { Trap } from './trap';

type Point = {
	x: number;
	y: number;
};

type PointFacadeConfig = {
	getCreatures: () => Creature[];
	getCreaturePassablePoints: (creature: Creature) => Point[];
	getCreatureBlockedPoints: (creature: Creature) => Point[];

	getTraps: () => Trap[];
	getTrapPassablePoints: (trap: Trap) => Point[];
	getTrapBlockedPoints: (trap: Trap) => Point[];

	getDrops: () => Drop[];
	getDropPassablePoints: (drop: Drop) => Point[];
	getDropBlockedPoints: (drop: Drop) => Point[];
};

class PointSet {
	s: Set<string>;

	constructor(s: Set<string>) {
		this.s = s;
	}

	has(point: Point | number, y = 0) {
		const point_ = normalize(point, y);
		return this.s.has(hash(point_));
	}
}

export class PointFacade {
	private config: PointFacadeConfig;

	constructor(config: PointFacadeConfig) {
		if (!canBuild(config)) {
			/**
			 * NOTE: This isn't absolutely necessary with TS, but the caller
			 * is currently in a JS file, so we'll check the config object
			 * and throw if incomplete.
			 */
			throw new Error(
				'PointMapBuilder is not fully configured. \nMissing: \n' +
					getMissingConfigRequirements(config).join('\n'),
			);
		}
		this.config = config;
	}

	getBlockedSet(): PointSet {
		const blockedSet = new Set<string>();
		for (const c of this.config.getCreatures()) {
			for (const point of this.config.getCreatureBlockedPoints(c)) {
				blockedSet.add(hash(point));
			}
		}
		for (const t of this.config.getTraps()) {
			for (const point of this.config.getTrapBlockedPoints(t)) {
				blockedSet.add(hash(point));
			}
		}
		for (const d of this.config.getDrops()) {
			for (const point of this.config.getDropBlockedPoints(d)) {
				blockedSet.add(hash(point));
			}
		}
		return new PointSet(blockedSet);
	}

	isBlocked(point: Point | number, y = 0) {
		const point_ = normalize(point, y);
		return this.getBlockedSet().has(point_);
	}

	getCreaturesAt(point: Point | number, y = 0) {
		const point_: Point = normalize(point, y);
		const config = this.config;
		return config
			.getCreatures()
			.filter(
				(c) =>
					hasPoint(point_, config.getCreatureBlockedPoints(c)) ||
					hasPoint(point_, config.getCreaturePassablePoints(c)),
			);
	}

	getTrapsAt(point: Point | number, y = 0) {
		const point_: Point = normalize(point, y);
		const config = this.config;
		return config
			.getTraps()
			.filter(
				(t) =>
					hasPoint(point_, config.getTrapBlockedPoints(t)) ||
					hasPoint(point_, config.getTrapPassablePoints(t)),
			);
	}

	getDropsAt(point: Point | number, y = 0) {
		const point_: Point = normalize(point, y);
		const config = this.config;
		return config
			.getDrops()
			.filter(
				(d) =>
					hasPoint(point_, config.getDropBlockedPoints(d)) ||
					hasPoint(point_, config.getDropPassablePoints(d)),
			);
	}
}

export function hash(point: Point) {
	return `(${point.x},${point.y})`;
}

function hasPoint(point: Point, arr: Point[]) {
	return arr.map((point) => hash(point)).includes(hash(point));
}

function getMissingConfigRequirements(config: PointFacadeConfig): string[] {
	const missing: string[] = [];
	if (!config.getCreatures) {
		missing.push('getCreatures() => Creature[]');
	}
	if (!config.getCreaturePassablePoints) {
		missing.push('getCreaturePassablePoints(creature:Creature) => Point[]');
	}
	if (!config.getCreatureBlockedPoints) {
		missing.push('getCreatureBlockedPoints(creature:Creature) => Point[]');
	}

	if (!config.getTraps) {
		missing.push('getTraps() => Trap[]');
	}
	if (!config.getTrapPassablePoints) {
		missing.push('getTrapPassablePoints(trap:Trap) => Point[]');
	}
	if (!config.getTrapBlockedPoints) {
		missing.push('getTrapBlockedPoints(trap:Trap) => Point[]');
	}

	if (!config.getDrops) {
		missing.push('getDrops() => Drop[]');
	}
	if (!config.getDropPassablePoints) {
		missing.push('getDropPassablePoints(drop:Drop) => Point[]');
	}
	if (!config.getDropBlockedPoints) {
		missing.push('getDropBlockedPoints(drop:Drop) => Point[]');
	}

	return missing;
}

function canBuild(config: PointFacadeConfig) {
	return getMissingConfigRequirements(config).length === 0;
}

function normalize(point: Point | number, y = 0): Point {
	return typeof point === 'number' ? { x: point, y } : point;
}
