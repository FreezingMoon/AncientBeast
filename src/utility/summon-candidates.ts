import type Game from '../game';
import type { CreatureType } from '../data/types';

type SummonCandidatesOptions = {
	excludeTypes?: readonly CreatureType[] | ReadonlySet<CreatureType>;
	requireAffordable?: boolean;
	plasma?: number;
	includeSecret?: boolean;
};

function toExcludeSet(excludeTypes?: readonly CreatureType[] | ReadonlySet<CreatureType>) {
	if (!excludeTypes) {
		return new Set<CreatureType>();
	}

	if (excludeTypes instanceof Set) {
		return excludeTypes;
	}

	return new Set(excludeTypes);
}

export function getSummonCandidates(
	game: Game,
	availableCreatures: readonly CreatureType[],
	options: SummonCandidatesOptions = {},
) {
	const excludeTypes = toExcludeSet(options.excludeTypes);
	const includeSecret = options.includeSecret === true;

	return availableCreatures.filter((type) => {
		if (excludeTypes.has(type)) {
			return false;
		}

		const stats = game.retrieveCreatureStats(type);
		if (!stats) {
			return false;
		}

		if (!includeSecret && stats.playable !== true) {
			return false;
		}

		if (options.requireAffordable) {
			const level = Number.parseInt(type.substring(1, 2), 10);
			const cost = level + Number(stats.size ?? 0);
			if (cost > (options.plasma ?? 0)) {
				return false;
			}
		}

		return true;
	});
}

function getPlasmaCost(game: Game, type: CreatureType) {
	const level = Number.parseInt(type.substring(1, 2), 10);
	const stats = game.retrieveCreatureStats(type);

	return level + Number(stats?.size ?? 0);
}

function hasAffordableCandidate(game: Game, candidates: readonly CreatureType[], plasma: number) {
	return candidates.some((type) => getPlasmaCost(game, type) <= plasma);
}

function getUsedCreatureTypes(game: Game) {
	const usedTypes = new Set<CreatureType>();

	for (const player of game.players) {
		for (const creature of player.creatures) {
			usedTypes.add(creature.type);
		}
	}

	return usedTypes;
}

/**
 * Narrows a set of summon candidates for a *random* materialization.
 *
 * Prefer unit types that no player has already materialized. This matters in
 * multiplayer games: the caller already removes the active player's own units,
 * but without the cross-player pass P4 can still be offered a type P1 has on
 * the field (or in that player's creature history). If every globally-unused
 * option is unaffordable, fall back to the original candidates so the dash can
 * still make a suggestion.
 *
 * Within that pool, also avoid handing the immediately previous materialization
 * straight back when another affordable option exists. Both filters are
 * preferences rather than rules.
 */
export function getRandomSummonCandidates(
	game: Game,
	candidates: readonly CreatureType[],
	plasma: number,
	lastSummonedType?: CreatureType | null,
): CreatureType[] {
	const allCandidates = [...candidates];
	const usedTypes = getUsedCreatureTypes(game);
	const globallyUnused = allCandidates.filter((type) => !usedTypes.has(type));
	const globallyPreferred = hasAffordableCandidate(game, globallyUnused, plasma)
		? globallyUnused
		: allCandidates;

	if (!lastSummonedType) {
		return globallyPreferred;
	}

	const preferred = globallyPreferred.filter((type) => type !== lastSummonedType);

	return hasAffordableCandidate(game, preferred, plasma) ? preferred : globallyPreferred;
}
