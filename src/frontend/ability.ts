import $j from 'jquery';
import { Game } from '../game';
import { Creature } from './creature';
import { Direction, Hex } from './hex';
import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';

export abstract class Ability {
	creature: Creature;
	game: Game;
	used: boolean;
	id: number;
	priority: number;
	timesUsed: number;
	timesUsedThisTurn: number;
	token: number;
	upgraded: boolean;
	title: string;
	_disableCooldowns: boolean;

	// unsure where this properties are added to the class
	upgrade: any;
	requirements: any;
	costs: any;
	trigger: string;
	triggerFunc: Function;
	message: any;

	require: Function;

	constructor(creature: Creature, abilityID: number, game: Game) {
		this.creature = creature;
		this.game = game;
		this.used = false;
		this.id = abilityID;
		this.priority = 0; // Priority for same trigger
		this.timesUsed = 0;
		this.timesUsedThisTurn = 0;
		this.token = 0;
		this.upgraded = false;
		this.title = '';

		let data = game.retrieveCreatureStats(creature.type);
		$j.extend(true, this, game.abilities[data.id][abilityID], data.ability_info[abilityID]);

		if (this.requirements === undefined && this.costs !== undefined) {
			this.requirements = this.costs;
		}

		// If set, abilities can be used multiple times in a single round.
		this._disableCooldowns = false;
	}

	handleMetaPowerEvent(message: string, payload: boolean): void {
		if (message === 'toggleResetCooldowns') {
			// Prevent ability from going on cooldown.
			this._disableCooldowns = payload;

			// Reset cooldown if the ability has already been used.
			if (this.used && payload === true) {
				this.reset();
				// Refresh UI to show ability is available.
				this.game.UI.selectAbility(-1);
			}
		}
	}

	hasUpgrade(): boolean {
		// @ts-ignore
		return this.game.abilityUpgrades >= 0 && this.upgrade;
	}

	setUpgraded(): void {
		this.upgraded = true;
	}

	/**
	 * Whether this ability upgrades after a certain number of uses. Otherwise it
	 * upgrades after a certain number of rounds.
	 * By default, this applies to active (onQuery) abilities.
	 * @return {boolean} Is upgrade per use.
	 */
	isUpgradedPerUse(): boolean {
		return this.trigger === 'onQuery';
	}

	/**
	 * Number of uses left before ability upgrades.
	 * @return {number} Uses left before upgrade.
	 */
	usesLeftBeforeUpgrade(): number {
		let game = this.game;

		if (this.isUpgradedPerUse()) {
			// @ts-ignore
			return game.abilityUpgrades - this.timesUsed;
		}

		// @ts-ignore
		return game.abilityUpgrades - this.creature.turnsActive;
	}

	/**
	 * Is this ability upgraded.
	 * @return {boolean} Is upgraded?
	 */
	isUpgraded(): boolean {
		return !this.hasUpgrade() ? false : this.usesLeftBeforeUpgrade() <= 0;
	}

	/**
	 * Get the trigger method for this ablity.
	 * @return {string|Function} Trigger
	 */
	getTrigger(): string | Function {
		if (this.trigger !== undefined) {
			return this.trigger;
		} else if (this.triggerFunc !== undefined) {
			return this.triggerFunc.bind(this);
		}

		return undefined;
	}

	getTriggerStr(): string {
		let s = '';
		let trigger = this.getTrigger();

		if (trigger instanceof String) {
			s = trigger as string;
		} else if (trigger instanceof Function) {
			s = trigger();
		}

		return s;
	}

	/**
	 * Reset ability at start of turn.
	 * @return {void}
	 */
	reset(): void {
		this.setUsed(false);
		this.token = 0;
		this.timesUsedThisTurn = 0;
	}

	/**
	 * Test and use the ability
	 */
	use(): any {
		let game = this.game;

		// @ts-ignore
		if (this.getTrigger() !== 'onQuery' || !this.require()) {
			return;
		}

		if (this.used === true) {
			game.log('Ability already used!');
			return;
		}

		game.clearOncePerDamageChain();
		game.activeCreature.hint(this.title, 'msg_effects');

		// @ts-ignore
		return this.query();
	}

	/**
	 * End the ability. Must be called at the end of each ability function;
	 */
	end(disableLogMsg: string, deferredEnding: boolean): void {
		let game = this.game;

		if (!disableLogMsg) {
			game.log('%CreatureName' + this.creature.id + '% uses ' + this.title);
		}

		this.applyCost();
		if (!this._disableCooldowns) {
			this.setUsed(true); // Should always be here
		}
		game.UI.updateInfos(); // Just in case
		game.UI.btnDelay.changeState('disabled');
		game.activeCreature.delayable = false;
		game.UI.selectAbility(-1);

		if (this.getTrigger() === 'onQuery' && !deferredEnding) {
			game.activeCreature.queryMove();
		}
	}

	/**
	 * Set the value of the used attribute
	 * @param {boolean} val Value to set.
	 * @return {void}
	 */
	setUsed(val: boolean): void {
		let game = this.game;

		if (val) {
			this.used = true;
			// Avoid dimmed passive for current creature
			if (this.creature.id == game.activeCreature.id) {
				game.UI.abilitiesButtons[this.id].changeState('disabled');
			}
		} else {
			this.used = false;
			if (this.creature.id == game.activeCreature.id) {
				// Passive
				game.UI.abilitiesButtons[this.id].changeState('normal');
			}
		}
	}

	/**
	 * Called after activate(); primarily to set times used so that isUpgraded is
	 * correct within activate().
	 * @return {void}
	 */
	postActivate(): void {
		let game = this.game;
		this.timesUsed++;
		this.timesUsedThisTurn++;

		// Update upgrade information
		this.game.UI.updateAbilityUpgrades();

		// Configure score update for player
		// When the ability is upgraded, add a single score bonus unique to that ability
		if (this.isUpgraded() && this.usesLeftBeforeUpgrade() == 0) {
			game.log(this.title + ' has been upgraded');
			// Upgrade bonus uniqueness managed by preventing multiple bonuses
			// with the same ability ID (which is an index 0,1,2,3 into the creature's abilities) and the creature ID
			const bonus = {
				type: 'upgrade',
				ability: this.id,
				creature: this.creature.id,
			};

			const find = (scorePart) =>
				scorePart.type === bonus.type &&
				scorePart.ability === bonus.ability &&
				scorePart.creature === bonus.creature;

			// Only add the bonus when it has not already been awarded
			if (!this.creature.player.score.find(find)) {
				this.creature.player.score.push(bonus);
			}
		}
	}

	/**
	 * Animate the creature
	 * @return {void}
	 */
	abstract animation(...args: any[]): void | boolean;

	/**
	 * Helper to animation method.
	 * @param {Object} o Animation object to extend.
	 * @return {void}
	 */
	abstract animation2(o: Object): void;

	/**
	 * Get an array of units in this collection of hexes.
	 * @param {Array} hexes The targeted hexes.
	 * @return {Array} Targest in these hexes
	 */
	getTargets(hexes: Hex[]): Hex[] {
		let targets = {},
			targetsList = [];

		hexes.forEach((item) => {
			if (item.creature instanceof Creature) {
				if (targets[item.creature.id] === undefined) {
					targets[item.creature.id] = { hexesHit: 0, target: item.creature };

					targetsList.push(targets[item.creature.id]);
				}

				targets[item.creature.id].hexesHit += 1; // Unit has been found
			}
		});

		return targetsList;
	}

	/**
	 * Return a formatted cost.
	 * @return {string|Boolean} cost
	 */
	getFormattedCosts(): string | boolean {
		if (this.costs) {
			return this.getFormattedDamages(this.costs);
		}

		return false;
	}

	/**
	 * Return formatted damages.
	 * @param {Object} obj Damage object.
	 * @return {boolean|string} damage
	 */
	getFormattedDamages(obj: Object): boolean | string {
		// @ts-ignore
		obj = obj || this.damages;

		if (!obj) {
			return false;
		}

		let string = '',
			creature = this.creature;

		$j.each(obj, (key, value) => {
			// @ts-ignore
			if (key == 'special') {
				// TODO: don't manually list all the stats and masteries when needed
				// @ts-ignore
				string += value.replace(
					/%(health|regrowth|endurance|energy|meditation|initiative|offense|defense|movement|pierce|slash|crush|shock|burn|frost|poison|sonic|mental)%/g,
					'<span class="$1"></span>',
				);
				return;
			}

			// @ts-ignore
			if (key === 'energy') {
				// @ts-ignore
				value += creature.stats.reqEnergy;
			}

			if (string !== '') {
				string += ', ';
			}

			string += value + '<span class="' + key + '"></span>';
		});

		return string;
	}

	/**
	 * Get formattted effects.
	 * @return {boolean|string} effect
	 */
	getFormattedEffects() {
		let string = '';

		// @ts-ignore
		if (!this.effects) {
			return false;
		}

		// @ts-ignore
		for (let i = this.effects.length - 1; i >= 0; i--) {
			// @ts-ignore
			if (this.effects[i].special) {
				// TODO: don't manually list all the stats and masteries when needed
				// @ts-ignore
				string += this.effects[i].special.replace(
					/%(health|regrowth|endurance|energy|meditation|initiative|offense|defense|movement|pierce|slash|crush|shock|burn|frost|poison|sonic|mental)%/g,
					'<span class="$1"></span>',
				);
				continue;
			}

			// @ts-ignore
			$j.each(this.effects[i], (key, value) => {
				if (string !== '') {
					string += ', ';
				}

				// @ts-ignore
				string += value + '<span class="' + key + '"></span>';
			});
		}

		return string;
	}

	/*
	 * targets : Array : Example : target = [ { target: crea1, hexesHit: 2 }, { target: crea2, hexesHit: 1 } ]
	 */
	areaDamage(attacker, damages, effects, targets, ignoreRetaliation) {
		let multiKill = 0;
		for (let i = 0, len = targets.length; i < len; i++) {
			if (targets[i] === undefined) {
				continue;
			}

			let dmg = new Damage(attacker, damages, targets[i].hexesHit, effects, this.game);
			let damageResult = targets[i].target.takeDamage(dmg, {
				ignoreRetaliation,
			});
			multiKill += damageResult.kill + 0;
		}

		if (multiKill > 1) {
			attacker.player.score.push({ type: 'combo', kills: multiKill });
		}
	}

	/**
	 * Return whether there is at least one creature in the hexes that satisfies
	 * various conditions, e.g. team.
	 *
	 * @param {Array} hexes Array of hexes to test.
	 * @param {Object} o
	 * @return {boolean} At least one valid target?
	 */
	atLeastOneTarget(hexes: Hex[], o: Object): boolean {
		const defaultOpt = {
			team: Team.Both,
			optTest: function () {
				return true;
			},
		};

		const options = { ...defaultOpt, ...o };

		for (let i = 0, len = hexes.length; i < len; i++) {
			const creature = hexes[i].creature;

			if (
				!creature ||
				!isTeam(this.creature, creature, options.team) ||
				// @ts-ignore
				!options.optTest(creature)
			) {
				continue;
			}

			return true;
		}

		this.message = this.game.msg.abilities.noTarget;
		return false;
	}

	/**
	 * Test the requirement for this ability. Negative values mean maximum value of the stat.
	 * For instance : energy = -5 means energy must be lower than 5.
	 * If one requirement fails it returns false.
	 * @return {boolean} Return true if ability requirements are met.
	 */
	testRequirements(): boolean {
		let game = this.game,
			def = {
				plasma: 0,
				energy: 0,
				endurance: 0,
				remainingMovement: 0,
				stats: {
					health: 0,
					regrowth: 0,
					endurance: 0,
					energy: 0,
					meditation: 0,
					initiative: 0,
					offense: 0,
					defense: 0,
					movement: 0,
					pierce: 0,
					slash: 0,
					crush: 0,
					shock: 0,
					burn: 0,
					frost: 0,
					poison: 0,
					sonic: 0,
					mental: 0,
				},
			},
			req = $j.extend(def, this.requirements),
			abilityMsgs = game.msg.abilities;

		// Plasma
		if (req.plasma > 0) {
			if (this.creature.player.plasma < req.plasma) {
				this.message = abilityMsgs.notEnough.replace('%stat%', 'plasma');
				return false;
			}
		} else if (req.plasma < 0) {
			if (this.creature.player.plasma > -req.plasma) {
				this.message = abilityMsgs.tooMuch.replace('%stat%', 'plasma');
				return false;
			}
		}

		// Energy
		let reqEnergy = req.energy + this.creature.stats.reqEnergy;
		if (reqEnergy > 0) {
			if (this.creature.energy < reqEnergy) {
				this.message = abilityMsgs.notEnough.replace('%stat%', 'energy');
				return false;
			}
		} else if (reqEnergy < 0) {
			if (this.creature.energy > -reqEnergy) {
				this.message = abilityMsgs.tooMuch.replace('%stat%', 'energy');
				return false;
			}
		}

		// Endurance
		if (req.endurance > 0) {
			if (this.creature.endurance < req.endurance) {
				this.message = abilityMsgs.notEnough.replace('%stat%', 'endurance');
				return false;
			}
		} else if (req.endurance < 0) {
			if (this.creature.endurance > -req.endurance) {
				this.message = abilityMsgs.tooMuch.replace('%stat%', 'endurance');
				return false;
			}
		}

		// Health
		if (req.health > 0) {
			if (this.creature.health <= req.health) {
				this.message = abilityMsgs.notEnough.replace('%stat%', 'health');
				return false;
			}
		} else if (req.health < 0) {
			if (this.creature.health > -req.health) {
				this.message = abilityMsgs.tooMuch.replace('%stat%', 'health');
				return false;
			}
		}

		$j.each(req.stats, (key, value) => {
			if (value > 0) {
				if (this.creature.stats[key] < value) {
					return false;
				}
			} else if (value < 0) {
				if (this.creature.stats[key] > value) {
					return false;
				}
			}
		});

		return true;
	}

	applyCost() {
		let game = this.game,
			creature = this.creature;

		if (this.costs === undefined) {
			return;
		}

		$j.each(this.costs, (key, value) => {
			if (typeof value == 'number') {
				if (key == 'health') {
					creature.hint(value.toString(), 'damage d' + value);
					game.log('%CreatureName' + creature.id + '% loses ' + value + ' health');
				} else if (key === 'energy') {
					value += creature.stats.reqEnergy;
				}

				creature[key] = Math.max(creature[key] - value, 0); // Cap
			}
		});

		creature.updateHealth();
		if (creature.id == game.activeCreature.id) {
			game.UI.energyBar.animSize(creature.energy / creature.stats.energy);
		}
	}

	/**
	 * Test and get directions where there are valid targets in directions, using
	 * direction queries.
	 *
	 * @param {Object} o Dict of arguments for direction query
	 * @param {function} o.optTest Callback function receiving the target creature, for final filtering.
	 * @param {function} o.minDistance Target must be at least this distance away to be valid.
	 * @return {Array} array of ints, length of total directions, 1 if direction valid else 0
	 */
	testDirections(o: Object): number[] {
		let defaultOpt = {
			team: Team.Enemy,
			id: this.creature.id,
			flipped: this.creature.player.flipped,
			x: this.creature.x,
			y: this.creature.y,
			directions: [1, 1, 1, 1, 1, 1],
			includeCreature: true,
			stopOnCreature: true,
			distance: 0,
			minDistance: 0,
			sourceCreature: undefined,
			optTest: function () {
				return true;
			},
		};

		o = $j.extend(defaultOpt, o);

		let outDirections = [];
		let deadzone = [];

		// @ts-ignore
		for (let i = 0, len = o.directions.length; i < len; i++) {
			// @ts-ignore
			if (!o.directions[i]) {
				outDirections.push(0);
				continue;
			}

			let fx = 0;

			// @ts-ignore
			if (o.sourceCreature instanceof Creature) {
				// @ts-ignore
				const flipped = o.sourceCreature.player.flipped;

				if ((!flipped && i > 2) || (flipped && i < 3)) {
					// @ts-ignore
					fx = -1 * (o.sourceCreature.size - 1);
				}
			}

			// @ts-ignore
			let dir = this.game.grid.getHexLine(o.x + fx, o.y, i, o.flipped);

			// @ts-ignore
			if (o.distance > 0) {
				// @ts-ignore
				dir = dir.slice(0, o.distance + 1);
			}

			// @ts-ignore
			if (o.minDistance > 0) {
				// The untargetable area between the unit and the minimum distance.
				// @ts-ignore
				deadzone = dir.slice(0, o.minDistance);
				// @ts-ignore
				deadzone = arrayUtils.filterCreature(deadzone, o.includeCreature, o.stopOnCreature, o.id);

				dir = dir.slice(
					// 1 greater than expected to exclude current (source creature) hex.
					// @ts-ignore
					o.minDistance,
				);
			}

			// @ts-ignore
			dir = arrayUtils.filterCreature(dir, o.includeCreature, o.stopOnCreature, o.id);

			/* If the ability has a minimum distance and units should block LOS, this
			direction cannot be used if there is a unit in the deadzone. */
			const blockingUnitInDeadzone =
				// @ts-ignore
				o.stopOnCreature && deadzone.length && this.atLeastOneTarget(deadzone, o);
			const targetInDirection = this.atLeastOneTarget(dir, o);
			const isValidDirection = targetInDirection && !blockingUnitInDeadzone;
			outDirections.push(isValidDirection ? 1 : 0);
		}

		return outDirections;
	}

	/**
	 * Test whether there are valid targets in directions, using direction queries.
	 *
	 * @param {Object} o Dict of arguments for direction query.
	 * @return {boolean} true if valid targets in at least one direction, else false
	 */
	testDirection(o: Object): boolean {
		let directions = this.testDirections(o);

		for (let i = 0, len = directions.length; i < len; i++) {
			if (directions[i] === 1) {
				this.message = '';
				return true;
			}
		}

		this.message = this.game.msg.abilities.noTarget;
		return false;
	}

	/**
	 * Determine if the ability is being used in the opposite direction to the creature's
	 * natural facing direction.
	 *
	 * i.e. red player's right facing Headless is targeting a creature to its left.
	 *
	 * @param {Direction} direction The direction the ability is being used.
	 * @returns {boolean} The ability is being used backwards.
	 */
	isTargetingBackwards(direction: Direction): boolean {
		return (
			(this.creature.player.flipped && direction < Direction.DownLeft) ||
			(!this.creature.player.flipped && direction > Direction.DownRight)
		);
	}
}
