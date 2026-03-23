import { Creature } from '../creature';

export enum Team {
	Enemy = 1,
	Ally = 2,
	Same = 3,
	Both = 4,
}

/**
 * Compare the teams of two creatures.
 *
 * @param creature1
 * @param creature2
 * @param team
 * @returns
 */
export function isTeam(creature1: Creature, creature2: Creature, team: Team) {
	switch (team) {
		case Team.Enemy:
			return creature1.team % 2 !== creature2.team % 2;
		case Team.Ally:
			return creature1.team % 2 === creature2.team % 2;
		case Team.Same:
			return creature1.team === creature2.team;
		case Team.Both:
			return true;
	}
}
