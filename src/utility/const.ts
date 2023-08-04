import { Point } from './pointfacade';

export const HEX_WIDTH_PX = 90;
export const HEX_HEIGHT_PX = (HEX_WIDTH_PX / Math.sqrt(3)) * 2 * 0.75;

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
