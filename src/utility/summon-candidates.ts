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

/**
 * Narrows a set of summon candidates for a *random* materialization so that the
 * unit materialized immediately before isn't handed straight back, which is what
 * produces copy-catting: one player materializes a unit and the next random pick
 * offers the very same type again.
 *
 * The exclusion is a preference rather than a rule. If dropping that type would
 * leave nothing the player can actually afford, the untouched candidate list is
 * returned so a random pick is still possible.
 */
export function getRandomSummonCandidates(
	game: Game,
	candidates: readonly CreatureType[],
	plasma: number,
	lastSummonedType?: CreatureType | null,
): CreatureType[] {
	const allCandidates = [...candidates];

	if (!lastSummonedType) {
		return allCandidates;
	}

	const preferred = allCandidates.filter((type) => type !== lastSummonedType);
	const canAffordPreferred = preferred.some((type) => getPlasmaCost(game, type) <= plasma);

	return canAffordPreferred ? preferred : allCandidates;
}
