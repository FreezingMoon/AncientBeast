import * as $j from 'jquery';
import { Damage } from './damage';
import { Hex } from './utility/hex';
import { Creature } from './creature';
import { isTeam, Team } from './utility/team';
import * as arrayUtils from './utility/arrayUtils';

/**
 * Ability Class
 *
 * Class parsing function from creature abilities
 */
export class Ability {
	constructor(creature, abilityID, game) {
		this.creature = creature;
		this.game = game;
		this.used = false;
		this.id = abilityID;
		this.priority = 0; // Priority for same trigger
		this.timesUsed = 0;
		this.timesUsedThisTurn = 0;
		this.token = 0;
		this.upgraded = false;

		let data = game.retrieveCreatureStats(creature.type);
		$j.extend(true, this, game.abilities[data.id][abilityID], data.ability_info[abilityID]);
		if (this.requirements === undefined && this.costs !== undefined) {
			this.requirements = this.costs;
		}
	}

	hasUpgrade() {
		return this.game.abilityUpgrades >= 0 && this.upgrade;
	}

	setUpgraded() {
		this.upgraded = true;
	}

	/**
	 * Whether this ability upgrades after a certain number of uses. Otherwise it
	 * upgrades after a certain number of rounds.
	 * By default, this applies to active (onQuery) abilities.
	 * @return {boolean} Is upgrade per use.
	 */
	isUpgradedPerUse() {
		return this.trigger === 'onQuery';
	}

	/**
	 * Number of uses left before ability upgrades.
	 * @return {number} Uses left before upgrade.
	 */
	usesLeftBeforeUpgrade() {
		let game = this.game;

		if (this.isUpgradedPerUse()) {
			return game.abilityUpgrades - this.timesUsed;
		}

		return game.abilityUpgrades - this.creature.turnsActive;
	}

	/**
	 * Is this ability upgraded.
	 * @return {boolean} Is upgraded?
	 */
	isUpgraded() {
		return !this.hasUpgrade() ? false : this.usesLeftBeforeUpgrade() <= 0;
	}

	/**
	 * Get the trigger method for this ablity.
	 * @return {string|Function} Trigger
	 */
	getTrigger() {
		if (this.trigger !== undefined) {
			return this.trigger;
		} else if (this.triggerFunc !== undefined) {
			return this.triggerFunc();
		}

		return undefined;
	}

	/**
	 * Reset ability at start of turn.
	 * @return {void}
	 */
	reset() {
		this.setUsed(false);
		this.token = 0;
		this.timesUsedThisTurn = 0;
	}

	/*
	 * Test and use the ability
	 *
	 */
	use() {
		let game = this.game;

		if (this.getTrigger() !== 'onQuery' || !this.require()) {
			return;
		}

		if (this.used === true) {
			game.log('Ability already used!');
			return;
		}

		game.grid.clearHexViewAlterations();
		game.clearOncePerDamageChain();
		game.activeCreature.hint(this.title, 'msg_effects');

		return this.query();
	}

	/*
	 * End the ability. Must be called at the end of each ability function;
	 *
	 */
	end(disableLogMsg, deferredEnding) {
		let game = this.game;

		if (!disableLogMsg) {
			game.log('%CreatureName' + this.creature.id + '% uses ' + this.title);
		}

		this.applyCost();
		this.setUsed(true); // Should always be here
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
	setUsed(val) {
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
	postActivate() {
		this.timesUsed++;
		this.timesUsedThisTurn++;

		// Update upgrade information
		this.game.UI.updateAbilityUpgrades();

		// Configure score update for player
		// When the ability is upgraded, add a single score bonus unique to that ability
		if (this.isUpgraded()) {
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
	animation() {
		let game = this.game;
		// Gamelog Event Registration
		if (game.triggers.onQuery.test(this.getTrigger())) {
			if (arguments[0] instanceof Hex) {
				let args = $j.extend({}, arguments);
				delete args[0];
				game.gamelog.add({
					action: 'ability',
					target: {
						type: 'hex',
						x: arguments[0].x,
						y: arguments[0].y,
					},
					id: this.id,
					args: args,
				});
				if (game.multiplayer) {
					game.gameplay.useAbility({
						target: {
							type: 'hex',
							x: arguments[0].x,
							y: arguments[0].y,
						},
						id: this.id,
						args: args,
					});
				}
			}

			if (arguments[0] instanceof Creature) {
				let args = $j.extend({}, arguments);
				delete args[0];
				game.gamelog.add({
					action: 'ability',
					target: {
						type: 'creature',
						crea: arguments[0].id,
					},
					id: this.id,
					args: args,
				});
				if (game.multiplayer) {
					game.gameplay.useAbility({
						target: {
							type: 'creature',
							crea: arguments[0].id,
						},
						id: this.id,
						args: args,
					});
				}
			}

			if (arguments[0] instanceof Array) {
				let args = $j.extend({}, arguments);
				delete args[0];

				let array = arguments[0].map((item) => ({ x: item.x, y: item.y }));

				game.gamelog.add({
					action: 'ability',
					target: {
						type: 'array',
						array: array,
					},
					id: this.id,
					args: args,
				});
				if (game.multiplayer) {
					game.gameplay.useAbility({
						target: {
							type: 'array',
							array: array,
						},
						id: this.id,
						args: args,
					});
				}
			}
		} else {
			// Test for materialization sickness
			if (this.creature.materializationSickness && this.affectedByMatSickness) {
				return false;
			}
		}

		return this.animation2({
			arg: arguments,
		});
	}

	/**
	 * Helper to animation method.
	 * @param {Object} o Animation object to extend.
	 * @return {void}
	 */
	animation2(o) {
		let game = this.game,
			opt = $j.extend({ callback: function () {}, arg: {} }, o),
			args = opt.arg,
			activateAbility = () => {
				this.activate(args[0], args[1]);
				this.postActivate();
			};

		game.freezedInput = true;

		// Animate
		let p0 = this.creature.sprite.x;
		let p1 = p0;
		let p2 = p0;

		p1 += this.creature.player.flipped ? 5 : -5;
		p2 += this.creature.player.flipped ? -5 : 5;

		this.creature.facePlayerDefault();

		// Force creatures to face towards their target
		if (args[0]) {
			if (args[0] instanceof Creature) {
				this.creature.faceHex(args[0]);
			} else if (args[0] instanceof Array) {
				for (var argument of args[0]) {
					if (argument instanceof Creature || argument.creature) {
						this.creature.faceHex(argument);
					}
				}
			}
		}
		// Play animations and sounds only for active abilities
		if (this.getTrigger() === 'onQuery') {
			let animId = Math.random();

			game.animationQueue.push(animId);

			let animationData = {
				duration: 500,
				delay: 350,
				activateAnimation: true,
			};

			if (this.getAnimationData) {
				animationData = $j.extend(animationData, this.getAnimationData(...args));
			}

			if (animationData.activateAnimation) {
				game.Phaser.add
					.tween(this.creature.sprite)
					.to({ x: p1 }, 250, Phaser.Easing.Linear.None)
					.to({ x: p2 }, 100, Phaser.Easing.Linear.None)
					.to({ x: p0 }, 150, Phaser.Easing.Linear.None)
					.start();
			}

			setTimeout(() => {
				if (!game.triggers.onUnderAttack.test(this.getTrigger())) {
					game.soundsys.playSound(game.soundLoaded[2], game.soundsys.effectsGainNode);
					activateAbility();
				}
			}, animationData.delay);

			setTimeout(() => {
				let queue = game.animationQueue.filter((item) => item != animId);

				if (queue.length === 0) {
					game.freezedInput = false;
					if (game.multiplayer) {
						game.freezedInput = game.UI.active ? false : true;
					}
				}

				game.animationQueue = queue;
			}, animationData.duration);
		} else {
			activateAbility();
			if (game.animationQueue.length === 0) {
				game.freezedInput = false;
			}
		}

		let interval = setInterval(() => {
			if (!game.freezedInput) {
				clearInterval(interval);
				opt.callback();
			}
		}, 100);
	}

	/**
	 * Get an array of units in this collection of hexes.
	 * @param {Array} hexes The targeted hexes.
	 * @return {Array} Targest in these hexes
	 */
	getTargets(hexes) {
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
	getFormattedCosts() {
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
	getFormattedDamages(obj) {
		obj = obj || this.damages;

		if (!obj) {
			return false;
		}

		let string = '',
			creature = this.creature;

		$j.each(obj, (key, value) => {
			if (key == 'special') {
				// TODO: don't manually list all the stats and masteries when needed
				string += value.replace(
					/%(health|regrowth|endurance|energy|meditation|initiative|offense|defense|movement|pierce|slash|crush|shock|burn|frost|poison|sonic|mental)%/g,
					'<span class="$1"></span>',
				);
				return;
			}

			if (key === 'energy') {
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

		if (!this.effects) {
			return false;
		}

		for (let i = this.effects.length - 1; i >= 0; i--) {
			if (this.effects[i].special) {
				// TODO: don't manually list all the stats and masteries when needed
				string += this.effects[i].special.replace(
					/%(health|regrowth|endurance|energy|meditation|initiative|offense|defense|movement|pierce|slash|crush|shock|burn|frost|poison|sonic|mental)%/g,
					'<span class="$1"></span>',
				);
				continue;
			}

			$j.each(this.effects[i], (key, value) => {
				if (string !== '') {
					string += ', ';
				}

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
				ignoreRetaliation: ignoreRetaliation,
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
	 * @param {Array} hexes Array of hexes
	 * @param {Object} o Options
	 * @return {boolean} At least one target.
	 */
	atLeastOneTarget(hexes, o) {
		let defaultOpt = {
			team: Team.both,
			optTest: function () {
				return true;
			},
		};

		o = $j.extend(defaultOpt, o);
		for (let i = 0, len = hexes.length; i < len; i++) {
			let creature = hexes[i].creature;

			if (!creature || !isTeam(this.creature, creature, o.team) || !o.optTest(creature)) {
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
	testRequirements() {
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
					creature.hint(value, 'damage d' + value);
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
	 * direction queries
	 * @param {Object} o Dict of arguments for direction query
	 * @return {Array} array of ints, length of total directions, 1 if direction valid else 0
	 */
	testDirections(o) {
		let defaultOpt = {
			team: Team.enemy,
			id: this.creature.id,
			flipped: this.creature.player.flipped,
			x: this.creature.x,
			y: this.creature.y,
			directions: [1, 1, 1, 1, 1, 1],
			includeCreature: true,
			stopOnCreature: true,
			distance: 0,
			sourceCreature: undefined,
		};

		o = $j.extend(defaultOpt, o);

		let outDirections = [];

		for (let i = 0, len = o.directions.length; i < len; i++) {
			if (!o.directions[i]) {
				outDirections.push(0);
				continue;
			}

			let fx = 0;

			if (o.sourceCreature instanceof Creature) {
				let flipped = o.sourceCreature.player.flipped;

				if ((!flipped && i > 2) || (flipped && i < 3)) {
					fx = -1 * (o.sourceCreature.size - 1);
				}
			}

			let dir = this.game.grid.getHexLine(o.x + fx, o.y, i, o.flipped);

			if (o.distance > 0) {
				dir = dir.slice(0, o.distance + 1);
			}

			dir = arrayUtils.filterCreature(dir, o.includeCreature, o.stopOnCreature, o.id);
			let isValid = this.atLeastOneTarget(dir, o);
			outDirections.push(isValid ? 1 : 0);
		}

		return outDirections;
	}

	/**
	 * Test whether there are valid targets in directions, using direction queries
	 * @param {Object} o Dict of arguments for direction query.
	 * @return {boolean} true if valid targets in at least one direction, else false
	 */
	testDirection(o) {
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
}
