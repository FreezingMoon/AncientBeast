import * as $j from 'jquery';
import { getUrl } from './assetLoader';
import { Creature } from './creature';

/**
 * Player Class
 * Player object with attributes
 */
export class Player {
	constructor(id, game) {
		/* Attributes
		 *
		 * id :		Integer :	Id of the player 1, 2, 3 or 4
		 * creature :	Array :		Array containing players creatures
		 * plasma :	Integer :	Plasma amount for the player
		 * flipped :	Boolean :	Player side of the battlefield (affects displayed creature)
		 *
		 */
		this.id = id;
		this.game = game;
		this.creatures = [];
		this.name = 'Player' + (id + 1);
		switch (id) {
			case 0:
				this.color = 'red';
				break;
			case 1:
				this.color = 'blue';
				break;
			case 2:
				this.color = 'orange';
				break;
			default:
				this.color = 'green';
				break;
		}
		this.avatar = getUrl('units/avatars/Dark Priest ' + this.color);
		this.score = [];
		this.plasma = game.plasma_amount;
		this.flipped = Boolean(id % 2); // Convert odd/even to true/false
		this.availableCreatures = game.availableCreatures;
		this.hasLost = false;
		this.hasFled = false;
		this.bonusTimePool = 0;
		this.totalTimePool = game.timePool * 1000;
		this.startTime = new Date();

		this.score = [
			{
				type: 'timebonus',
			},
		];

		/**
		 * Whether creatures summoned by Player are affected by Materialization Sickness.
		 */
		this._summonCreaturesWithMaterializationSickness = true;

		// Events
		this.game.signals.metaPowers.add(this.handleMetaPowerEvent, this);
	}

	// TODO: Is this even right? it should be off by 1 based on this code...
	getNbrOfCreatures() {
		let nbr = -1,
			creatures = this.creatures,
			count = creatures.length,
			creature;

		for (let i = 0; i < count; i++) {
			creature = creatures[i];

			if (!creature.dead && !creature.undead) {
				nbr++;
			}
		}

		return nbr;
	}

	/* summon(type, pos)
	 *
	 * type :	String :	Creature type (ex: "0" for Dark Priest and "G2" for Swampler)
	 * pos :	Object :	Position {x,y}
	 *
	 */
	summon(type, pos) {
		let game = this.game,
			data = game.retrieveCreatureStats(type),
			creature;

		data = $j.extend(data, pos, {
			team: this.id,
			temp: false,
		}); // Create the full data for creature creation

		for (let i = game.creatureData.length - 1; i >= 0; i--) {
			// Avoid Dark Priest shout at the begining of a match
			if (game.creatureData[i].type == type && i !== 0) {
				game.soundsys.playSound(game.soundLoaded[1000 + i], game.soundsys.announcerGainNode);
			}
		}

		creature = new Creature(data, game);
		this.creatures.push(creature);
		creature.summon(!this._summonCreaturesWithMaterializationSickness);
		game.onCreatureSummon(creature);
	}

	/* flee()
	 *
	 * Ask if the player wants to flee the match
	 *
	 */
	flee(o) {
		this.hasFled = true;
		this.deactivate();
		this.game.skipTurn(o);
	}

	/* getScore()
	 *
	 * return :	Integer :	The current score of the player
	 *
	 * Return the total of the score events.
	 */
	getScore() {
		let total = this.score.length,
			s = {},
			points,
			totalScore = {
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
				pickupDrop: 0,
				upgrade: 0,
			};

		for (let i = 0; i < total; i++) {
			s = this.score[i];
			points = 0;

			switch (s.type) {
				case 'firstKill':
					points += 20;
					break;
				case 'kill':
					// Prevent issues with non-leveled creatures, e.g. Dark Priest
					if (s.creature.level) {
						points += s.creature.level * 5;
					}
					break;
				case 'combo':
					points += s.kills * 5;
					break;
				case 'humiliation':
					points += 50;
					break;
				case 'annihilation':
					points += 100;
					break;
				case 'deny':
					points += -1 * s.creature.size * 5;
					break;
				case 'timebonus':
					points += Math.round(this.bonusTimePool * 0.5);
					break;
				case 'nofleeing':
					points += 25;
					break;
				case 'creaturebonus':
					points += s.creature.level * 5;
					break;
				case 'darkpriestbonus':
					points += 50;
					break;
				case 'immortal':
					points += 100;
					break;
				case 'pickupDrop':
					points += 2;
					break;
				case 'upgrade':
					points += 1;
					break;
			}

			totalScore[s.type] += points;
			totalScore.total += points;
		}

		return totalScore;
	}

	/* isLeader()
	 *
	 * Test if the player has the greater score.
	 * Return true if in lead. False if not.
	 *
	 * TODO: This is also wrong, because it allows for ties to result in a "leader".
	 */
	isLeader() {
		let game = this.game;

		for (let i = 0; i < game.playerMode; i++) {
			// Each player
			// If someone has a higher score
			if (game.players[i].getScore().total > this.getScore().total) {
				return false; // He's not in lead
			}
		}

		return true; // If nobody has a better score he's in lead
	}

	/* isAnnihilated()
	 *
	 * A player is considered annihilated if all his creatures are dead DP included
	 */
	isAnnihilated() {
		// annihilated is false if only one creature is not dead
		let annihilated = this.creatures.length > 1,
			count = this.creatures.length;

		for (let i = 0; i < count; i++) {
			annihilated = annihilated && this.creatures[i].dead;
		}

		return annihilated;
	}

	/* deactivate()
	 *
	 * Remove all player's creature from the queue
	 */
	deactivate() {
		let game = this.game,
			count = game.creatures.length,
			creature;

		this.hasLost = true;

		// Remove all player creatures from queues
		for (let i = 1; i < count; i++) {
			creature = game.creatures[i];

			if (creature.player.id == this.id) {
				game.queue.remove(creature);
			}
		}

		game.updateQueueDisplay();

		// Test if allie Dark Priest is dead
		if (game.playerMode > 2) {
			// 2 vs 2
			if (game.players[(this.id + 2) % 4].hasLost) {
				game.endGame();
			}
		} else {
			// 1 vs 1
			game.endGame();
		}
	}

	get summonCreaturesWithMaterializationSickness() {
		return this._summonCreaturesWithMaterializationSickness;
	}

	handleMetaPowerEvent(message, payload) {
		if (message === 'toggleDisableMaterializationSickness') {
			this._summonCreaturesWithMaterializationSickness = !payload;
		}
	}
}
