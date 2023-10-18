import * as $j from 'jquery';
import { getUrl } from './assets';
import { Creature } from './creature';
import Game from './game';
import { AbilitySlot } from './ability';
import { CreatureType } from './data/types';
import { Point } from './utility/pointfacade';

/**
 * Player Class
 * Player object with attributes
 */

/**
 * NOTE
 * need to convert game.js -> game.ts to get rid of @ts-expect-errors
 *
 * to fix @ts-expect-error 2554: properly type the arguments for the trigger functions in `game.ts`
 */

type ScoreType =
	| 'firstKill'
	| 'kill'
	| 'combo'
	| 'humiliation'
	| 'annihilation'
	| 'deny'
	| 'timebonus'
	| 'nofleeing'
	| 'creaturebonus'
	| 'darkpriestbonus'
	| 'immortal'
	| 'pickupDrop'
	| 'upgrade';

export type ScoreEvent = {
	type: ScoreType;
	creature?: Creature;
	player?: PlayerID;
	kills?: number;
	ability?: AbilitySlot;
};

export type PlayerColor = 'red' | 'blue' | 'orange' | 'green';

export type PlayerID = 0 | 1 | 2 | 3;

type PlayerName = `Player${1 | 2 | 3 | 4}`;

type TotalScore = Record<ScoreType, number> & { total: number };

export class Player {
	id: PlayerID;
	game: Game;
	creatures: Creature[];
	name: PlayerName;
	color: PlayerColor;
	avatar: string;
	score: ScoreEvent[];
	plasma: number;
	flipped: boolean;
	availableCreatures: CreatureType[];
	hasLost: boolean;
	hasFled: boolean;
	bonusTimePool: number;
	totalTimePool: number;
	startTime: Date;
	_summonCreaturesWithMaterializationSickness: boolean;
	constructor(id: PlayerID, game: Game) {
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
		this.name = ('Player' + (id + 1)) as PlayerName;
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
		// @ts-expect-error ts(2339)
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
		let nbr = -1;
		let creature: Creature;
		const creatures = this.creatures;
		const count = creatures.length;

		for (let i = 0; i < count; i++) {
			creature = creatures[i];

			if (!creature.dead && !creature.undead) {
				nbr++;
			}
		}

		return nbr;
	}

	/**
	 * @param {string} type - Creature type (ex: "--" for Dark Priest and "G2" for Swampler)
	 * @param {Point} pos - Position {x,y}
	 */
	summon(type: CreatureType, pos: Point) {
		const game = this.game;
		const baseCreatureData = game.retrieveCreatureStats(type);

		// Create the full data for creature creation
		const creatureData = $j.extend(baseCreatureData, pos, {
			team: this.id,
			temp: false,
		});

		if (creatureData.name !== 'Dark Priest') {
			game.soundsys.playShout(creatureData.name);
		}

		const creature = new Creature(creatureData, game);

		this.creatures.push(creature);
		creature.summon(!this._summonCreaturesWithMaterializationSickness);
		// @ts-expect-error 2554
		game.onCreatureSummon(creature);
	}

	/**
	 * Ask if the player wants to flee the match
	 */
	flee(o) {
		this.hasFled = true;
		this.deactivate();
		this.game.skipTurn(o);
	}

	/**
	 * Create and return a totalScore object that includes the point value for each score event as well as the cumulative score
	 */
	getScore(): TotalScore {
		let points = 0;
		const total = this.score.length;
		const totalScore: TotalScore = {
			firstKill: 0,
			combo: 0,
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
			const s = this.score[i];
			points = 0;

			switch (s.type) {
				case 'firstKill':
					points += 20;
					break;
				case 'kill':
					// Prevent issues with non-leveled creatures, e.g. Dark Priest
					if (s.creature.level && s.creature.level !== '-') {
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
					if (s.creature.level !== '-') {
						points += s.creature.level * 5;
					}
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

	/**
	 * Test if the player has the greater score.
	 * Return true if in lead. False if not.
	 * TODO: This is also wrong, because it allows for ties to result in a "leader".
	 */
	isLeader(): boolean {
		const game = this.game;

		for (let i = 0; i < game.playerMode; i++) {
			// Each player
			// If someone has a higher score
			if (game.players[i].getScore().total > this.getScore().total) {
				return false; // He's not in lead
			}
		}

		return true; // If nobody has a better score he's in lead
	}

	/**
	 * A player is considered annihilated if all his creatures are dead DP included
	 */
	isAnnihilated(): boolean {
		// annihilated is false if only one creature is not dead
		let annihilated = this.creatures.length > 1;
		const count = this.creatures.length;

		for (let i = 0; i < count; i++) {
			annihilated = annihilated && this.creatures[i].dead;
		}

		return annihilated;
	}

	/**
	 * Remove all player's creature from the queue
	 */
	deactivate(): void {
		let creature: Creature;
		const game = this.game;

		this.hasLost = true;

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
