/*	Player Class
 *
 *	Player object with attributes
 *
 */
var Player = Class.create({
	/*	Attributes
	 *
	 *	id :		Integer :	Id of the player 1, 2, 3 or 4
	 *	creature :	Array :		Array containing players creatures
	 *	plasma :	Integer :	Plasma amount for the player
	 *	flipped :	Boolean :	Player side of the battlefield (affects displayed creature)
	 *
	 */
	initialize: function(id) {
		this.id = id;
		this.creatures = [];
		this.name = "Player" + (id + 1);
		this.color =
			(this.id === 0) ? "red" :
			(this.id == 1) ? "blue" :
			(this.id == 2) ? "orange" :
			"green";
		this.avatar = "../units/avatars/Dark Priest " + this.color + ".jpg";
		this.score = [];
		this.plasma = G.plasma_amount;
		this.flipped = !!(id % 2); // Convert odd/even to true/false
		this.availableCreatures = G.availableCreatures;
		this.hasLost = false;
		this.hasFleed = false;
		this.bonusTimePool = 0;
		this.totalTimePool = G.timePool * 1000;
		this.startTime = new Date();

		this.score = [{
			type: "timebonus"
		}];
	},


	getNbrOfCreatures: function() {
		var nbr = -1;
		for (var i = 0; i < this.creatures.length; i++) {
			var crea = this.creatures[i];
			if (!crea.dead && !crea.undead) nbr++;
		}
		return nbr;
	},


	/*	summon(type,pos)
	 *
	 *	type :	String :	Creature type (ex: "0" for Dark Priest and "L2" for Magma Spawn)
	 *	pos :	Object :	Position {x,y}
	 *
	 */
	summon: function(type, pos) {
		var data = G.retreiveCreatureStats(type);
		data = $j.extend(data, pos, {
			team: this.id
		}); // Create the full data for creature creation
		for (var i = G.creatureJSON.length - 1; i >= 0; i--) {
			if (
				G.creatureJSON[i].type == type &&
				i !== 0) // Avoid Dark Priest shout at the begining of a match
			{
				G.soundsys.playSound(G.soundLoaded[1000 + i], G.soundsys.announcerGainNode);
			}
		}
		var creature = new Creature(data);
		this.creatures.push(creature);
		creature.summon();
		G.grid.updateDisplay(); // Retrace players creatures
		G.triggersFn.onCreatureSummon(creature);
	},

	/*	flee()
	 *
	 *	Ask if the player want to flee the match
	 *
	 */
	flee: function(o) {
		this.hasFleed = true;
		this.deactivate();
		G.skipTurn(o);
	},


	/*	getScore()
	 *
	 *	return :	Integer :	The current score of the player
	 *
	 *	Return the total of the score events.
	 */
	getScore: function() {
		var totalScore = {
			firstKill: 0,
			kill: 0,
			deny: 0,
			humiliation: 0,
			annihilation: 0,
			timebonus: 0,
			nofleeing: 0,
			creaturebonus: 0,
			darkpriestbonus: 0,
			immortal: 0,
			total: 0,
		};
		for (var i = 0; i < this.score.length; i++) {
			var s = this.score[i];
			var points = 0;
			switch (s.type) {
				case "firstKill":
					points += 20;
					break;
				case "kill":
					points += s.creature.level * 5;
					break;
				case "combo":
					points += s.kills * 5;
					break;
				case "humiliation":
					points += 50;
					break;
				case "annihilation":
					points += 100;
					break;
				case "deny":
					points += -1 * s.creature.size * 5;
					break;
				case "timebonus":
					points += Math.round(this.bonusTimePool * 0.5);
					break;
				case "nofleeing":
					points += 25;
					break;
				case "creaturebonus":
					points += s.creature.level * 5;
					break;
				case "darkpriestbonus":
					points += 50;
					break;
				case "immortal":
					points += 100;
					break;
			}
			totalScore[s.type] += points;
			totalScore.total += points;
		}
		return totalScore;
	},

	/*	isLeader()
	 *
	 *	Test if the player has the greater score.
	 *	Return true if in lead. False if not.
	 */
	isLeader: function() {

		for (var i = 0; i < G.playerMode; i++) { // Each player
			// If someone has a higher score
			if (G.players[i].getScore().total > this.getScore().total) {
				return false; // He's not in lead
			}
		}

		return true; // If nobody has a better score he's in lead
	},


	/*	isAnnihilated()
	 *
	 *	A player is considered annihilated if all his creatures are dead DP included
	 */
	isAnnihilated: function() {
		var annihilated = (this.creatures.length > 1);
		// annihilated is false if only one creature is not dead
		for (var i = 0; i < this.creatures.length; i++) {
			annihilated = annihilated && this.creatures[i].dead;
		}
		return annihilated;
	},

	/* deactivate()
	 *
	 *	Remove all player's creature from the queue
	 */
	deactivate: function() {
		this.hasLost = true;

		// Remove all player creatures from queues
		for (var i = 1; i < G.creatures.length; i++) {
			var crea = G.creatures[i];
			if (crea.player.id == this.id) {
				G.queue.remove(crea);
			}
		}
		G.updateQueueDisplay();

		// Test if allie Dark Priest is dead
		if (G.playerMode > 2) {
			// 2vs2
			if (G.players[(this.id + 2) % 4].hasLost)
				G.endGame();
		} else {
			// 1vs1
			G.endGame();
		}
	},
});