import type Game from '../game';
import type { Hex } from '../utility/hex';
import { HEX_HEIGHT_PX, HEX_WIDTH_PX } from '../utility/const';
import { Easing } from '../utility/easing';
import { getDepthAtBand } from '../game-display/layer';
import { spawnProjectileVertigoTrail } from '../vertigo';

export function animateBoomerang(
	game: Game,
	start: Hex,
	hexes: Hex[],
	onHit: (hex: Hex) => void,
	onComplete: () => void,
	vertigo = false,
): void {
	if (!hexes.length || game.replayMode === 'load') {
		hexes.forEach(onHit);
		onComplete();
		return;
	}

	const tip = hexes.reduce((farthest, hex) =>
		Math.abs(hex.displayPos.x - start.displayPos.x) >
		Math.abs(farthest.displayPos.x - start.displayPos.x)
			? hex
			: farthest,
	);
	const startX = start.displayPos.x + HEX_WIDTH_PX / 2;
	const startY = start.displayPos.y - 20;
	const endX = tip.displayPos.x + HEX_WIDTH_PX / 2;
	const direction = endX > startX ? 1 : -1;
	const radiusX = Math.abs(endX - startX) / 2;
	const radiusY = HEX_HEIGHT_PX * 0.75;
	// Match each hex's column to an orbital phase; drain crossed phases even after a skipped frame.
	const events = hexes
		.map((hex) => {
			const x = hex.displayPos.x + HEX_WIDTH_PX / 2;
			const fraction = Math.max(0, Math.min(1, (x - startX) / (endX - startX)));
			const angle = Math.acos(1 - 2 * fraction);
			const phase = hex.y > start.y ? 2 * Math.PI - angle : angle;
			return { hex, progress: phase / (2 * Math.PI) };
		})
		.sort((a, b) => a.progress - b.progress);
	const sprite = game.gameEngine.add.sprite(
		startX,
		startY,
		'Headless - Boomerang',
		undefined,
		game.grid.creatureGroup,
	);
	sprite.setOrigin(0.5, 0.5);
	sprite.setDepth(getDepthAtBand(99, 'EFFECT_OVER_UNITS'));
	const flight = { progress: 0 };
	let nextHit = 0;
	const update = () => {
		const angle = flight.progress * 2 * Math.PI;
		sprite.x = startX + direction * radiusX * (1 - Math.cos(angle));
		sprite.y = startY - radiusY * Math.sin(angle);
		sprite.angle = direction * flight.progress * 1440;
		while (nextHit < events.length && events[nextHit].progress <= flight.progress) {
			onHit(events[nextHit++].hex);
		}
	};
	const duration = 1100;
	const tween = game.gameEngine.tween(flight).to({ progress: 1 }, duration, Easing.Linear.None);
	tween.onUpdateCallback(update);
	tween.onComplete.addOnce(() => {
		flight.progress = 1;
		update();
		sprite.destroy();
		onComplete();
	});
	tween.start();
	if (vertigo) {
		spawnProjectileVertigoTrail(game, sprite, sprite, sprite, duration, 0, 0, true);
	}
}
