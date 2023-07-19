import { Point } from './pointfacade';

export const HEX_WIDTH_PX = 90;
export const HEX_HEIGHT_PX = (HEX_WIDTH_PX / Math.sqrt(3)) * 2 * 0.75 * 0.75;
export function offsetCoordsToPx(point: Point) {
	// NOTE: Rounding lets callers use this function with non-whole numbers
	// in order to include offsets. This is offered as a possiblity, but
	// know that offset hex grid coordinates are a little bonkers. Make
	// sure to double check your output in the game.
	// Pass whole numbers and adjust pixel positions after if running into problems.
	const row = Math.round(point.y);
	return {
		x: (row % 2 === 0 ? point.x + 0.5 : point.x) * HEX_WIDTH_PX,
		y: point.y * HEX_HEIGHT_PX,
	};
}
