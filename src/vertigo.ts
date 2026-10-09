import type Game from './game';
import type { Creature } from './creature';
import type { SpriteHandle } from './engine/types';
import { Easing } from './utility/easing';

/**
 * The afterimage trail ("vertigo"): a unit that moves leaves
 * fading cardboard copies of itself behind it along the path,
 * each born where the unit was when the copy was spawned and
 * eased up and out over a short life.
 *
 * Two ways onto the trail:
 *  - a unit flagged `afterimages: true` in `data/units.ts`
 *    (the Scavenger's flight, the Impaler's charge) trails on
 *    its own every move, and moves a fifth faster for it;
 *  - an ability that moves a creature — a dash, a drag, a
 *    knockback — passes `afterimages: true` in its move options
 *    and the moved creature trails for that move only.
 */

/**
 * Movement speed boost for afterimage units, as a share of the
 * base pace. A unit that trails afterimages moves this much
 * faster than its cardboard's own speed — the trail is the
 * point of the effect, so it comes with the speed to make it.
 *
 * Only the unit's own movement is boosted: ability-driven moves
 * (knockbacks, drags) tune their own speeds and keep them.
 */
export const AFTERIMAGE_SPEED_BOOST = 0.2;

/**
 * How long one afterimage lingers, in ms. Long enough to read
 * as a trail behind the crossing, short enough to clear well
 * before the unit's next move.
 */
export const AFTERIMAGE_LIFETIME_MS = 420;

/**
 * Spacing between afterimages along a move, in ms of
 * movement. One every 50ms gives a dense trail — around
 * a fifth more afterimages than a per-hex sampling —
 * without stacking sprites: each lives
 * {@link AFTERIMAGE_LIFETIME_MS}, so only a handful
 * are on screen at once.
 */
export const AFTERIMAGE_INTERVAL_MS = 50;

/**
 * Peak opacity of an afterimage — faint enough to read as an
 * echo rather than a second unit.
 */
export const AFTERIMAGE_ALPHA = 0.4;

/**
 * How far an afterimage rises over its life, in px. The drift
 * is what makes the trail read as flight rather than a shadow.
 */
export const AFTERIMAGE_RISE_PX = 12;

/**
 * Spawn the afterimage trail for a move of `durationMS`.
 *
 * A move is one (or, for a walk, a chain of) straight
 * tween(s), so the afterimages are sampled off the unit's
 * live position on the scene clock: each is a copy of the
 * cardboard, flipped the way the unit moves, born where the
 * unit was when it was spawned and eased up and out over
 * {@link AFTERIMAGE_LIFETIME_MS}. Afterimages ride the
 * unit's own depth band so the trail sorts with it, and
 * destroy themselves on completion — a fading echo, not a
 * second unit.
 */
export function spawnAfterimageTrail(game: Game, creature: Creature, durationMS: number): void {
	const engine = game.gameEngine;
	const creatureSprite = creature.creatureSprite;
	const cardboard = creatureSprite?.sprite;
	const group = creatureSprite?.grp;
	if (!cardboard || !group || creatureSprite?.destroyed) {
		return;
	}

	const textureKey = cardboard.key;
	const dir = cardboard.scaleX < 0 ? -1 : 1;

	// One afterimage per interval of the move, with a floor
	// so even a one-hex hop leaves a readable echo.
	const afterimageCount = Math.max(3, Math.ceil(durationMS / AFTERIMAGE_INTERVAL_MS));

	for (let i = 0; i < afterimageCount; i++) {
		const delay = i * AFTERIMAGE_INTERVAL_MS;
		engine.time.add(delay, () => {
			// A dead or torn-down unit leaves no further afterimages.
			if (creature.dead || creatureSprite.destroyed) {
				return;
			}

			const afterimageX = group.x + cardboard.x;
			const afterimageY = group.y + cardboard.y;
			const afterimage = engine.add.sprite(
				afterimageX,
				afterimageY,
				textureKey,
				undefined,
				game.grid.creatureGroup,
			);
			afterimage.setOrigin(0.5, 1);
			afterimage.setScale(dir, 1);
			afterimage.alpha = AFTERIMAGE_ALPHA;
			// A fresh sprite sits at depth 0, behind the whole
			// board; riding the unit's band keeps the trail
			// sorting with it.
			if (typeof group.depth === 'number') {
				afterimage.setDepth(group.depth + 0.01);
			}

			engine
				.tween(afterimage)
				.to(
					{ alpha: 0, y: afterimageY - AFTERIMAGE_RISE_PX },
					AFTERIMAGE_LIFETIME_MS,
					Easing.Sinusoidal.Out,
					true,
				)
				.onComplete.add(() => {
					afterimage.destroy();
				});
		});
	}
}

/**
 * Spawn a vertigo trail for a projectile sprite.
 *
 * The projectile travels in a straight line from startPos to endPos
 * over `durationMS`. Afterimages are sampled along this path at
 * regular intervals, each a copy of the projectile sprite that fades
 * out and rises slightly.
 *
 * @param game The game instance
 * @param sprite The projectile sprite to trail
 * @param startPos Starting position {x, y}
 * @param endPos Ending position {x, y}
 * @param durationMS Duration of the projectile flight in ms
 * @param rotation Rotation of the projectile (in radians)
 */
export function spawnProjectileVertigoTrail(
	game: Game,
	sprite: SpriteHandle,
	startPos: { x: number; y: number },
	endPos: { x: number; y: number },
	durationMS: number,
	rotation: number,
): void {
	const engine = game.gameEngine;
	const textureKey = sprite.texture.key;

	// One afterimage per interval, minimum 3 for short flights
	const afterimageCount = Math.max(3, Math.ceil(durationMS / AFTERIMAGE_INTERVAL_MS));

	for (let i = 0; i < afterimageCount; i++) {
		const delay = i * AFTERIMAGE_INTERVAL_MS;
		engine.time.add(delay, () => {
			if (!sprite.exists) {
				return;
			}

			// Interpolate position along the projectile's path
			const t = Math.min(delay / durationMS, 1);
			const afterimageX = startPos.x + (endPos.x - startPos.x) * t;
			const afterimageY = startPos.y + (endPos.y - startPos.y) * t;

			const afterimage = engine.add.sprite(
				afterimageX,
				afterimageY,
				textureKey,
				undefined,
				game.grid.creatureGroup,
			);
			afterimage.setOrigin(0.5, 0.5);
			afterimage.rotation = rotation;
			afterimage.alpha = AFTERIMAGE_ALPHA;

			// Match projectile's depth
			if (typeof sprite.depth === 'number') {
				afterimage.setDepth(sprite.depth - 0.01);
			}

			engine
				.tween(afterimage)
				.to(
					{ alpha: 0, y: afterimageY - AFTERIMAGE_RISE_PX },
					AFTERIMAGE_LIFETIME_MS,
					Easing.Sinusoidal.Out,
					true,
				)
				.onComplete.add(() => {
					afterimage.destroy();
				});
		});
	}
}
