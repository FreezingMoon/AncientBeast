export const Team = Object.freeze({
	enemy: 1,
	ally: 2,
	same: 3,
	both: 4
});

export function isTeam(creature1, creature2, team) {
	switch (team) {
		case Team.enemy:
			return creature1.team % 2 !== creature2.team % 2;
		case Team.ally:
			return creature1.team % 2 === creature2.team % 2;
		case Team.same:
			return creature1.team === creature2.team;
		case Team.both:
			return true;
	}
}
