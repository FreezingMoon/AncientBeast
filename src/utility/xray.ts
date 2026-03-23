import * as Const from './const';

type Bounds = {
	left: number;
	right: number;
	top: number;
	bottom: number;
};

type HexLike = {
	y: number;
	displayPos: { x: number; y: number };
	width?: number;
	height?: number;
};

type CreatureLike = {
	id?: number;
	y: number;
	grp?: { x: number; y: number };
	sprite?: {
		x: number;
		y: number;
		width?: number;
		height?: number;
		texture?: { width?: number; height?: number };
	};
};

function rectanglesIntersect(a: Bounds, b: Bounds): boolean {
	return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function getHexXrayProbeBounds(hex: HexLike): Bounds {
	const width = hex.width ?? Const.HEX_WIDTH_PX;
	const height = hex.height ?? Const.HEX_HEIGHT_PX;

	return {
		left: hex.displayPos.x + 8,
		right: hex.displayPos.x + width - 8,
		top: hex.displayPos.y + 6,
		bottom: hex.displayPos.y + height + 12,
	};
}

export function getCreatureSpriteBounds(creature: CreatureLike): Bounds | null {
	const group = creature.grp;
	const sprite = creature.sprite;
	if (!group || !sprite) {
		return null;
	}

	const textureWidth = sprite.texture?.width ?? 0;
	const textureHeight = sprite.texture?.height ?? 0;
	const width = Math.abs(sprite.width ?? textureWidth);
	const height = Math.abs(sprite.height ?? textureHeight);

	if (!width || !height) {
		return null;
	}

	const centerX = group.x + sprite.x;
	const bottomY = group.y + sprite.y;

	return {
		left: centerX - width / 2,
		right: centerX + width / 2,
		top: bottomY - height,
		bottom: bottomY,
	};
}

export function collectScreenSpaceXrayCandidates(
	hex: HexLike,
	targetCreature: CreatureLike | undefined,
	creatures: Array<CreatureLike | null | undefined>,
): CreatureLike[] {
	const probeBounds = getHexXrayProbeBounds(hex);
	const candidates: CreatureLike[] = [];
	const seen = new Set<number | CreatureLike>();

	creatures.forEach((creature) => {
		if (!creature || creature === targetCreature) {
			return;
		}
		if (creature.y < hex.y) {
			return;
		}

		const bounds = getCreatureSpriteBounds(creature);
		if (!bounds || !rectanglesIntersect(probeBounds, bounds)) {
			return;
		}

		const key = creature.id ?? creature;
		if (seen.has(key)) {
			return;
		}
		seen.add(key);
		candidates.push(creature);
	});

	return candidates;
}
