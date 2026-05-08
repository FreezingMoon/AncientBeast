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
