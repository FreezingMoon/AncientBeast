export const DISRUPTOR_SCAN_LINE_HEIGHT = 14;

export function disruptorFlicker(timeSeconds: number): number {
	const pulse = 0.5 + 0.5 * Math.sin(timeSeconds * 24);
	return 0.35 + 0.65 * pulse * pulse;
}

export function invertedDisruptorLuminance(red: number, green: number, blue: number): number {
	return 255 - Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722);
}

export function disruptorScanStrip(row: number, height: number, timeSeconds: number) {
	const top = Math.max(0, Math.min(height, Math.floor(row - DISRUPTOR_SCAN_LINE_HEIGHT / 2)));
	return {
		top,
		bottom: row < height ? Math.min(height, top + DISRUPTOR_SCAN_LINE_HEIGHT) : top,
		alpha: 0.75 + disruptorFlicker(timeSeconds) * 0.25,
	};
}

export function drawDisruptorRipple(
	context: CanvasRenderingContext2D,
	source: CanvasImageSource,
	width: number,
	height: number,
	scanRow: number,
	time: number,
	previousBounds: { top: number; bottom: number } | null,
): { top: number; bottom: number } {
	const firstRow = Math.max(0, Math.floor(scanRow - 30));
	const lastRow = Math.min(height, Math.ceil(scanRow + 70));
	const clearTop = previousBounds ? Math.min(previousBounds.top, firstRow) : firstRow;
	const clearBottom = previousBounds ? Math.max(previousBounds.bottom, lastRow) : lastRow;
	context.clearRect(0, clearTop, width, clearBottom - clearTop);
	for (let sourceRow = firstRow; sourceRow < lastRow; sourceRow += 2) {
		const bandHeight = Math.min(2, lastRow - sourceRow);
		const rowCenter = sourceRow + bandHeight / 2;
		const distance = rowCenter - scanRow;
		const influence =
			distance >= 0 ? Math.exp(-(((distance - 14) / 24) ** 2)) : 0.4 * Math.exp(distance / 12);
		const displacement =
			influence *
			(9 * Math.sin(rowCenter * 0.24 - time * 7) + 2 * Math.sin(rowCenter * 0.1 + time * 4));
		const verticalDisplacement = influence * 2.5 * Math.sin(rowCenter * 0.32 - time * 5);
		context.globalAlpha = 0.85 * influence;
		context.drawImage(
			source,
			0,
			sourceRow,
			width,
			bandHeight,
			displacement,
			sourceRow + verticalDisplacement,
			width,
			bandHeight,
		);
	}
	context.globalAlpha = 1;
	return { top: firstRow, bottom: lastRow };
}
