/*
 * Ancient Beast Chain Lightning — the chain.
 *
 * The Impaler's fourth ability does not hit one target: it arcs
 * from unit to unit, and every hop is one {@link ChainLightningBolt}.
 * This module turns an ordered list of casualties — creatures or
 * plain points — into that sequence of bolts, staggered so each hop
 * ignites a fraction of a `travelMs` after the last one, which is
 * what reads as the strike jumping down the chain.
 *
 * The game passes creatures; their cardboards' centres are read off
 * the sprite anchors (the cardboard's origin is its bottom-centre,
 * so its mid-body sits half a texture above the anchor). A caster
 * can be passed as a plain point anchored elsewhere — the Impaler's
 * chain sparks off its nose tip, see {@link creatureNoseTip}. The
 * tuning harness passes plain points. Both reach the same bolt
 * renderer.
 */

import { Creature } from '../../creature';
import { after, type Timer } from '../../timing/clock';
import type { GameEngine, GroupHandle } from '../../engine/types';
import type { SurfaceSource } from '../../game-display/canvas-surface';
import { getFrameSize } from '../../game-display/texture';
import { chainLightningLook, type ChainLightningLook, type LightningPoint } from './look';
import { ChainLightningBolt } from './bolt';

export interface ChainLightningOptions {
	/** Group the bolts parent to — the board's creature group in-game. */
	parent?: GroupHandle;
	/** Where the bolt surfaces register their textures. */
	surfaceSource?: SurfaceSource;
	/** Depth for the bolt sprites, e.g. the over-units effect band. */
	depth?: number;
	look?: Partial<ChainLightningLook>;
	/** Random source, injectable for deterministic tests. */
	random?: () => number;
	/**
	 * How much of a hop's travel time elapses before the next hop
	 * ignites, as a fraction of `travelMs`.
	 *
	 * Below 1 the hops overlap, so the chain reads as one continuous
	 * strike running down the line; 1 makes each hop wait for the
	 * last to finish its arc.
	 */
	hopOverlap?: number;
	/**
	 * Fires when a hop ignites.
	 *
	 * `hopIndex` is the hop that just started (0 is caster to first
	 * target), `to` is the point it strikes — the creature the
	 * player should see react.
	 */
	onHop?: (hopIndex: number, from: LightningPoint, to: LightningPoint) => void;
	/** Fires when the last hop's trail has faded. */
	onEnd?: () => void;
}

/** A live chain; `destroy()` tears down every hop still in flight. */
export interface ChainLightningHandle {
	destroy(): void;
}

/**
 * A creature's mid-body centre, in the creature group's space.
 *
 * The cardboard sprite is anchored at its bottom-centre
 * (`setOrigin(0.5, 1)`), so the centre of the body — where a
 * bolt should connect — is half a texture height above the
 * anchor.
 */
export function creatureCenter(creature: Creature): LightningPoint {
	const sprite = creature.sprite;
	const grp = creature.grp;
	const height = Number(sprite?.height) || 0;
	return {
		x: (grp?.x ?? 0) + (sprite?.x ?? 0),
		y: (grp?.y ?? 0) + (sprite?.y ?? 0) - height * 0.5,
	};
}

/**
 * The tip of a creature's nose — the top pixel of the edge the unit
 * faces — in the creature group's space.
 *
 * The cardboard is mirrored with `scaleX` to face left or right
 * (`setDir`), so the nose sits on the sprite's right edge while the
 * unit faces right, and on its left edge while it faces left. The
 * cardboard's anchor is its bottom-centre, so the nose sits a full
 * frame height above that anchor.
 */
export function creatureNoseTip(creature: Creature): LightningPoint {
	const sprite = creature.sprite;
	const grp = creature.grp;
	const { width, height } = getFrameSize(sprite);
	const facing = (sprite?.scaleX ?? 1) < 0 ? -1 : 1;
	return {
		x: (grp?.x ?? 0) + (sprite?.x ?? 0) + (facing * width) / 2,
		y: (grp?.y ?? 0) + (sprite?.y ?? 0) - height,
	};
}

function toPoint(entry: Creature | LightningPoint): LightningPoint {
	if (entry instanceof Creature) {
		return creatureCenter(entry);
	}
	return { x: Number(entry.x) || 0, y: Number(entry.y) || 0 };
}

/**
 * Fire chain lightning down an ordered chain of targets.
 *
 * `chain` is the full path in strike order: the caster first, then
 * every target the lightning jumped to. Each consecutive pair is one
 * bolt. Returns `null` when there is nothing to draw (no engine, or
 * a chain shorter than two points) — callers can ignore the result.
 */
export function spawnChainLightning(
	engine: GameEngine | null | undefined,
	chain: Array<Creature | LightningPoint>,
	options: ChainLightningOptions = {},
): ChainLightningHandle | null {
	if (!engine || chain.length < 2) {
		return null;
	}

	const points = chain.map(toPoint);
	const look = chainLightningLook(options.look);
	const random = options.random ?? Math.random;
	const hopOverlap = options.hopOverlap ?? 0.8;

	let destroyed = false;
	let pendingHops = points.length - 1;
	const timers: Timer[] = [];
	const bolts: ChainLightningBolt[] = [];

	const hopDone = () => {
		pendingHops--;
		if (pendingHops <= 0 && !destroyed) {
			options.onEnd?.();
		}
	};

	for (let i = 0; i < points.length - 1; i++) {
		const from = points[i];
		const to = points[i + 1];
		const delay = Math.round(i * look.travelMs * hopOverlap);
		timers.push(
			after(delay, () => {
				if (destroyed) {
					return;
				}
				const bolt = new ChainLightningBolt(engine, from, to, {
					parent: options.parent,
					surfaceSource: options.surfaceSource,
					depth: options.depth,
					look: options.look,
					random,
					onEnd: hopDone,
				});
				bolts.push(bolt);
				options.onHop?.(i, from, to);
				bolt.start();
			}),
		);
	}

	return {
		destroy() {
			if (destroyed) {
				return;
			}
			destroyed = true;
			// Hops that have not fired yet are cancelled outright;
			// the ones on screen are torn down mid-flight.
			for (const timer of timers) {
				timer.stop();
			}
			for (const bolt of bolts) {
				bolt.destroy();
			}
			timers.length = 0;
			bolts.length = 0;
		},
	};
}
