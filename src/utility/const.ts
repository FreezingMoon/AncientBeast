import { Point } from './pointfacade';

export const HEX_WIDTH_PX = 90;
export const HEX_HEIGHT_PX = (HEX_WIDTH_PX / Math.sqrt(3)) * 2 * 0.75;
export function offsetCoordsToPx(point: Point) {
	return {
		x: (point.y % 2 === 0 ? point.x + 0.5 : point.x) * HEX_WIDTH_PX,
		y: point.y * HEX_HEIGHT_PX,
	};
}
