import { Point } from './pointfacade';

// Stat constants
export const PRIMARY_STATS = [
	'health',
	'regrowth',
	'endurance',
	'energy',
	'meditation',
	'initiative',
	'offense',
	'defense',
	'movement',
] as const;

export const MASTERY_STATS = [
	'pierce',
	'slash',
	'crush',
	'shock',
	'burn',
	'frost',
	'poison',
	'sonic',
	'mental',
] as const;

export const ALL_STATS = [...PRIMARY_STATS, ...MASTERY_STATS] as const;

export const HEX_WIDTH_PX = 90;
export const HEX_HEIGHT_PX = (HEX_WIDTH_PX / Math.sqrt(3)) * 2 * 0.75;

/**
 * Opacity of the ghost cardboard drawn on a hex a unit may be placed on.
 *
 * The ghost is a static hold: nothing tweens it, so sliding the cursor from
 * one hex to the next can never leave the preview caught mid-fade. Confirming
 * the placement hands this same value to the materializing unit, which fades up
 * to full opacity while the ghost fades out.
 */
export const GHOST_PREVIEW_ALPHA = 0.3;

export function offsetCoordsToPx(point: Point) {
	return {
		x: (point.y % 2 === 0 ? point.x + 0.5 : point.x) * HEX_WIDTH_PX,
		y: point.y * HEX_HEIGHT_PX,
	};
}

const n2_16 = Math.pow(2, 16);

function isValid(point: Point) {
	return 0 <= point.x && point.x < n2_16 && 0 <= point.y && point.y < n2_16;
}

export function offsetNeighbors(point: Point): Point[] {
	// NOTE: returns neighbors in clockwise order starting at 3 o'clock.
	if (point.y % 2 === 0) {
		return [
			{ x: point.x + 1, y: point.y },
			{ x: point.x + 1, y: point.y + 1 },
			{ x: point.x, y: point.y + 1 },
			{ x: point.x - 1, y: point.y },
			{ x: point.x, y: point.y - 1 },
			{ x: point.x + 1, y: point.y - 1 },
		].filter(isValid);
	} else {
		return [
			{ x: point.x + 1, y: point.y },
			{ x: point.x, y: point.y + 1 },
			{ x: point.x - 1, y: point.y + 1 },
			{ x: point.x - 1, y: point.y },
			{ x: point.x - 1, y: point.y - 1 },
			{ x: point.x, y: point.y - 1 },
		].filter(isValid);
	}
}

export function hashOffsetCoords(point: Point) {
	return (point.x << 16) ^ point.y;
}
