import type { Creature } from '../creature';
import type Game from '../game';
import type { SpriteHandle } from '../engine/types';
import { createGameCanvasSurface } from '../game-display/canvas-surface';
import { getFrameSize } from '../game-display/texture';

const OUTLINE_STYLE = { color: 'rgba(80, 255, 25, 0.9)', blur: 3, alpha: 0.9 };
const AURA_STYLE = { color: 'rgba(80, 255, 25, 0.9)', blur: 20, alpha: 0.78 };

export type ContagionVisual = {
	setContagious: () => void;
	remove: () => void;
};

function syncVisual(
	visual: SpriteHandle,
	cardboard: SpriteHandle,
	width: number,
	height: number,
	padding: number,
	alpha: number,
): void {
	const originX = cardboard.anchor.x;
	const originY = cardboard.anchor.y;
	visual.anchor.set(
		(padding + originX * width) / (width + padding * 2),
		(padding + originY * height) / (height + padding * 2),
	);
	visual.x = cardboard.x;
	visual.y = cardboard.y;
	visual.scale.set(cardboard.scale.x, cardboard.scale.y);
	visual.rotation = cardboard.rotation;
	visual.alpha = cardboard.alpha * alpha;
}

export function attachContagionVisual(game: Game, creature: Creature): ContagionVisual {
	const textures = game.Phaser?.textures;
	if (!textures) return { setContagious: () => undefined, remove: () => undefined };

	const cardboard = creature.sprite;
	const textureKey = cardboard.key;
	const texture = textures.get(textureKey);
	if (!texture || textureKey === '__MISSING' || !texture.getSourceImage()) {
		return { setContagious: () => undefined, remove: () => undefined };
	}

	const engine = game.gameEngine;
	const { width, height } = getFrameSize(cardboard);
	const padding = 24;
	const surface = createGameCanvasSurface(game, width + padding * 2, height + padding * 2);
	const ctx = surface.ctx;
	const visual = engine.add.sprite(0, 0, surface.key, undefined, creature.grp);
	let style = OUTLINE_STYLE;
	const render = () => {
		ctx.clearRect(0, 0, surface.width, surface.height);
		ctx.shadowColor = style.color;
		ctx.shadowBlur = style.blur;
		surface.drawTexture(textureKey, padding, padding);
		ctx.shadowBlur = 0;
		ctx.globalCompositeOperation = 'destination-out';
		surface.drawTexture(textureKey, padding, padding);
		ctx.globalCompositeOperation = 'source-over';
		surface.commit();
	};
	render();
	const sync = () => syncVisual(visual, cardboard, width, height, padding, style.alpha);
	sync();
	creature.creatureSprite.addPostUpdateHook(sync);

	return {
		setContagious: () => {
			style = AURA_STYLE;
			render();
			sync();
		},
		remove: () => {
			creature.creatureSprite.removePostUpdateHook(sync);
			visual.destroy();
			surface.destroy();
		},
	};
}
