import type { Hex } from './hex';

type HexGridLike = {
	hexes: Array<Array<Hex | undefined>>;
};

export function getQueryFootprintHexes(
	grid: HexGridLike,
	hex: Hex,
	size = 1,
	flipped = false,
	id = 0,
): Hex[] {
	if (!hex || size < 1) {
		return [];
	}

	const row = grid.hexes[hex.y];
	if (!row) {
		return [];
	}

	let x = hex.x;
	const offset = flipped ? size - 1 : 0;
	const mult = flipped ? 1 : -1;

	for (let i = 0; i < size; i++) {
		const candidateX = x + offset - i * mult;
		const candidate = row[candidateX];
		if (!candidate) {
			continue;
		}

		if (candidate.isWalkable(size, id)) {
			x += offset - i * mult;
			break;
		}
	}

	const footprint: Hex[] = [];
	for (let i = 0; i < size; i++) {
		const occupiedHex = row[x - i];
		if (occupiedHex) {
			footprint.push(occupiedHex);
		}
	}

	return footprint;
}
