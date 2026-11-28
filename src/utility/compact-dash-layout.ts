import type { CreatureType } from '../data/types';

export type CompactDashLayout =
	| 'side-rails'
	| 'bottom-dial'
	| 'card-only'
	| 'full-grid'
	| 'standard';

export type MediumCardLayout = 'two-cards' | 'one-card';

export function isTablessLandscapeDash(width: number, isLandscape: boolean): boolean {
	return isLandscape && width <= 700;
}

export function getMediumCardLayout(width: number, height: number): MediumCardLayout {
	if (width >= 649 && width <= 1000) {
		return width >= 972 && height >= 501 ? 'two-cards' : 'one-card';
	}
	return 'two-cards';
}

export function getCompactDashLayout(
	width: number,
	height: number,
	isLandscape: boolean,
): CompactDashLayout {
	if (width >= 401 && width <= 768) {
		if (height < 450) {
			return isLandscape ? 'full-grid' : 'card-only';
		}
		if (width >= 649) {
			if (height >= 290) {
				return 'full-grid';
			}
			return 'standard';
		}
		if (height >= 700) {
			return 'full-grid';
		}
		if (height <= 630) {
			return 'side-rails';
		}
		return 'bottom-dial';
	}

	if (width >= 649 && width <= 1000 && height >= 290) {
		return 'full-grid';
	}

	return 'standard';
}

export function getNextRealmUnit(
	realm: string,
	selectedCreature: string,
	candidates: readonly CreatureType[],
): CreatureType | null {
	const realmCandidates = candidates.filter(
		(type) => type.startsWith(realm) && /^.[1-7]$/.test(type),
	);
	if (realmCandidates.length === 0) {
		return null;
	}

	const selectedIndex = realmCandidates.findIndex((type) => type === selectedCreature);
	const nextIndex = selectedIndex >= 0 ? (selectedIndex + 1) % realmCandidates.length : 0;
	return realmCandidates[nextIndex] ?? null;
}

export function getLowestRealmUnit(
	realm: string,
	candidates: readonly CreatureType[],
): CreatureType | null {
	const realmCandidates = candidates
		.filter((type) => type.startsWith(realm) && /^.[1-7]$/.test(type))
		.sort((left, right) => {
			const leftLevel = Number.parseInt(left.slice(1), 10);
			const rightLevel = Number.parseInt(right.slice(1), 10);
			return leftLevel - rightLevel;
		});
	return realmCandidates[0] ?? null;
}

export function getToggledCardSide(side: 'A' | 'B'): 'A' | 'B' {
	return side === 'A' ? 'B' : 'A';
}
