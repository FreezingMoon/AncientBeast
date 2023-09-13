import * as $j from 'jquery';
import { Damage } from './damage';
import { Direction, Hex } from './utility/hex';
import { Creature, CreatureMasteries } from './creature';
import { isTeam, Team } from './utility/team';
import * as arrayUtils from './utility/arrayUtils';
import Game from './game';
import { ScoreEvent } from './player';
import { Point } from './utility/pointfacade';

/*
 * NOTE
 *
 * convert game.js -> game.ts to get rid of @ts-expect-error 2339
 *
 */

/**
 * Ability Class
 *
 * Class parsing function from creature abilities
 */

export type AbilitySlot = 0 | 1 | 2 | 3;

export type Trigger =
	| 'onQuery'
	| 'onStartPhase'
	| 'onDamage'
	| 'onEndPhase'
	| 'onStepIn'
	| 'onStepOut'
	| 'onReset'
	| 'onCreatureMove'
	| 'onCreatureDeath'
	| 'onCreatureSummon'
	| 'onAttack'
	| 'onUnderAttack'
	| 'onHeal'
	| 'onEffectAttach'
	| 'onStartOfRound'
	| 'oncePerDamageChain'
	| 'onCreatureMove onOtherCreatureMove';

// Could get rid of the union and optionals by creating a separate (or conditional) type for Dark Priest's Cost
// This might narrow down the types in the constructor by checking `creature.name`
type Cost = {
	special?: string;
	plasma?: string | number;
	energy?: number;
};

type Requirement = { plasma?: number; energy?: number } | Cost;

type Target = { hexesHit: number; target: Creature };

type AbilityEffect = {
	special?: string;
	offense?: number;
	defense?: number;
	regrowth?: number;
	frost?: number;
};

type OffesnsiveBuff = number;
type DefensiveBuff = number;

export class Ability {
	creature: Creature;
	game: Game;
	used: boolean;
	id: AbilitySlot;
	priority: number;
	timesUsed: number;
	timesUsedThisTurn: number;
	token: number;
	upgraded: boolean;
	title: string;

	// TODO properly type all these unknowns
	// These properties come from extending a specific ability from `src/abilities`
	requirements?: Requirement | undefined;
	costs?: Cost | undefined;
	trigger?: Trigger;
	triggerFunc?: () => Trigger;
	require?: (req?: Damage | Hex) => boolean;
	query?: () => unknown;
	affectedByMatSickness?: boolean;
	activate?: (target?: any, hex?: any, path?: Hex[]) => unknown;
	getAnimationData?: (...args: unknown[]) => unknown;
	damages?: CreatureMasteries & { pure?: number };
	effects?: AbilityEffect[];
	message?: string;
	movementType?: () => 'flying'; // Currently, this functon only exists in `Scavenger.js`
	triggeredThisChain?: boolean;

	_disableCooldowns: boolean;

	_energyNormal?: number;
	_energySelfUpgraded: number;
	mbuff?: OffesnsiveBuff;
	obuff?: DefensiveBuff;
	abilityName?: string;
	// TODO: Once all abilities files are converted to TS, look into deleteing the `name` param as it appears unecessary
	getAbilityName?: (name: string) => string;
	getMovementBuff?: (buff: number) => number;
	getOffenseBuff?: (buff: number) => number;
	_targetTeam: Team;

	// Below methods exist in Snow-Bunny.ts
	_detectFrontHexesWithEnemy: () => { direction: number; hex: Hex; enemyPos: Point }[];
	_findEnemyHexInFront: (hexWithEnemy: Hex) => Hex | undefined;
	_getHopHex: () => Hex | undefined;
	_getUsesPerTurn: () => 1 | 2;
	directions: [1, 1, 1, 1, 1, 1];
	constructor(creature: Creature, abilityID: AbilitySlot, game: Game) {
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

		const data = game.retrieveCreatureStats(creature.type);
		$j.extend(true, this, game.abilities[data.id][abilityID], data.ability_info[abilityID]);
		if (this.requirements === undefined && this.costs !== undefined) {
			this.requirements = this.costs;
		}

		// If set, abilities can be used multiple times in a single round.
		this._disableCooldowns = false;

		// Events
		this.game.signals.metaPowers.add(this.handleMetaPowerEvent, this);
	}

	handleMetaPowerEvent(message: string, payload: boolean) {
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

	hasUpgrade() {
		// @ts-expect-error ts-2339
		return this.game.abilityUpgrades >= 0 && this.upgraded;
	}

	setUpgraded() {
		this.upgraded = true;
	}

	/**
	 * Whether this ability upgrades after a certain number of uses. Otherwise it
	 * upgrades after a certain number of rounds.
	 * By default, this applies to active (onQuery) abilities.
	 * @return Is upgrade per use.
	 */
	isUpgradedPerUse(): boolean {
		return this.trigger === 'onQuery';
	}

	/**
	 * Number of uses left before ability upgrades.
	 * @return Uses left before upgrade.
	 */
	usesLeftBeforeUpgrade(): number {
		const game = this.game;

		if (this.isUpgradedPerUse()) {
			// @ts-expect-error ts-2339
			return game.abilityUpgrades - this.timesUsed;
		}

		// @ts-expect-error ts-2339
		return game.abilityUpgrades - this.creature.turnsActive;
	}

	/**
	 * Is this ability upgraded.
	 * @return Is upgraded
	 */
	isUpgraded(): boolean {
		return !this.hasUpgrade() ? false : this.usesLeftBeforeUpgrade() <= 0;
	}

	/**
	 * Get the trigger method for this ablity.
	 * @return Trigger
	 */
	getTrigger(): Trigger {
		if (this.trigger !== undefined) {
			return this.trigger;
		} else if (this.triggerFunc !== undefined) {
			return this.triggerFunc();
		}

		return undefined;
	}

	/**
	 * Reset ability at start of turn.
	 */
	reset(): void {
		this.setUsed(false);
		this.token = 0;
		this.timesUsedThisTurn = 0;
	}

	/**
	 * Test and use the ability
	 */
	use() {
		const game = this.game;

		if (this.getTrigger() !== 'onQuery' || !this.require()) {
			return;
		}

		if (this.used === true) {
			game.log('Ability already used!');
			return;
		}

		game.clearOncePerDamageChain();
		game.activeCreature.hint(this.title, 'msg_effects');

		return this.query();
	}

	/**
	 * End the ability. Must be called at the end of each ability function;
	 */
	//TODO: Once all files in `abilities` are converted to TS, consider defaulting both of these arguments to `false`.
	end(disableLogMsg?: boolean, deferredEnding?: boolean) {
		const game = this.game;

		if (!disableLogMsg) {
			game.log('%CreatureName' + this.creature.id + '% uses ' + this.title);
		}

		this.applyCost();
		if (!this._disableCooldowns) {
			this.setUsed(true); // Should always be here
		}
		game.signals.creature.dispatch('abilityend', { creature: this.creature });
		game.UI.btnDelay.changeState('disabled');
		game.UI.selectAbility(-1);

		if (this.getTrigger() === 'onQuery' && !deferredEnding) {
			game.activeCreature.queryMove();
		}
	}

	/**
	 * Set the value of the used attribute
	 * @param val Value to set.
	 */
	setUsed(val: boolean): void {
		const game = this.game;

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
	 */
	postActivate(): void {
		const game = this.game;
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
			const bonus: ScoreEvent = {
				type: 'upgrade',
				ability: this.id,
				creature: this.creature,
			};

			const matchingBonus = (score: ScoreEvent) =>
				score.type === bonus.type &&
				score.ability === bonus.ability &&
				score.creature.id === bonus.creature.id;

			// Only add the bonus when it has not already been awarded
			if (!this.creature.player.score.find(matchingBonus)) {
				this.creature.player.score.push(bonus);
			}
		}
	}

	/**
	 * Animate the creature
	 */
	animation(...args): false | void {
		const game = this.game;
		// Gamelog Event Registration
		if (game.triggers.onQuery.test(this.getTrigger())) {
			if (args[0] instanceof Hex) {
				const hex = args[0];
				const argsObj = $j.extend({}, args);
				delete argsObj[0];
				game.gamelog.add({
					action: 'ability',
					target: {
						type: 'hex',
						x: hex.x,
						y: hex.y,
					},
					id: this.id,
					args: argsObj,
				});
				if (game.multiplayer) {
					game.gameplay.useAbility({
						target: {
							type: 'hex',
							x: hex.x,
							y: hex.y,
						},
						id: this.id,
						args: argsObj,
					});
				}
			}

			if (args[0] instanceof Creature) {
				const creature = args[0];
				const argsObj = $j.extend({}, args);
				delete argsObj[0];
				game.gamelog.add({
					action: 'ability',
					target: {
						type: 'creature',
						crea: creature.id,
					},
					id: this.id,
					args: argsObj,
				});
				if (game.multiplayer) {
					game.gameplay.useAbility({
						target: {
							type: 'creature',
							crea: creature.id,
						},
						id: this.id,
						args: argsObj,
					});
				}
			}

			if (args[0] instanceof Array) {
				const argsObj = $j.extend({}, args);
				delete argsObj[0];

				const array = args[0].map((item) => ({ x: item.x, y: item.y }));

				game.gamelog.add({
					action: 'ability',
					target: {
						type: 'array',
						array: array,
					},
					id: this.id,
					args: argsObj,
				});
				if (game.multiplayer) {
					game.gameplay.useAbility({
						target: {
							type: 'array',
							array: array,
						},
						id: this.id,
						args: argsObj,
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
			arg: args,
		});
	}

	/**
	 * Helper to animation method.
	 * @param {object} o - Animation object to extend.
	 */
	animation2(o: object): void {
		const game = this.game;
		const opt = $j.extend(
			{
				callback: function () {
					// Default no-op function.
				},
				arg: {},
			},
			o,
		);
		const args = opt.arg;
		const activateAbility = () => {
			const extra = args[2];
			this.activate(args[0], args[1], extra);
			this.postActivate();
		};

		game.freezedInput = true;

		// Animate
		const p0 = this.creature.sprite.x;
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
				for (const argument of args[0]) {
					if (argument instanceof Creature || argument.creature) {
						this.creature.faceHex(argument);
					}
				}
			}
		}
		// Play animations and sounds only for active abilities
		if (this.getTrigger() === 'onQuery') {
			const animId = Math.random();

			game.animationQueue.push(animId);

			let animationData = {
				duration: 500,
				delay: 350,
				activateAnimation: true,
			};

			if (this.getAnimationData) {
				// wrapped `args` in an array to fix ts-error 2488
				animationData = $j.extend(animationData, this.getAnimationData(...[args]));
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
					game.soundsys.playSFX('sounds/swing2');
					activateAbility();
				}
			}, animationData.delay);

			setTimeout(() => {
				const queue = game.animationQueue.filter((item) => item != animId);

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

		const interval = setInterval(() => {
			if (!game.freezedInput) {
				clearInterval(interval);
				opt.callback();
			}
		}, 100);
	}

	/**
	 * Get an array of units in this collection of hexes.
	 * @param hexes The targeted hexes.
	 * @return Targets in these hexes
	 */

	getTargets(hexes: Hex[]): Target[] {
		const targets: Record<number, Target> = {};
		const targetsList: Target[] = [];

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
	 * @return cost
	 */
	getFormattedCosts(): string | false {
		if (this.costs) {
			return this.getFormattedDamages(this.costs);
		}

		return false;
	}

	/**
	 * Return formatted damages.
	 * @param obj Damage object.
	 * @return damage
	 */
	getFormattedDamages(obj: Record<string, any>): string | false {
		obj = obj || this.damages;

		if (!obj) {
			return false;
		}

		let string = '';
		const creature = this.creature;

		$j.each(obj, (key: string, value) => {
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
	 * @return effect
	 */
	getFormattedEffects(): false | string {
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

			$j.each(this.effects[i], (key: string, value) => {
				if (string !== '') {
					string += ', ';
				}

				string += value + '<span class="' + key + '"></span>';
			});
		}

		return string;
	}

	/**
	 * targets : Array : Example : target = [ { target: crea1, hexesHit: 2 }, { target: crea2, hexesHit: 1 } ]
	 */
	areaDamage(attacker: Creature, damages, effects, targets: Target[], ignoreRetaliation: boolean) {
		let multiKill = 0;
		for (let i = 0, len = targets.length; i < len; i++) {
			if (targets[i] === undefined) {
				continue;
			}

			const dmg = new Damage(attacker, damages, targets[i].hexesHit, effects, this.game);
			const damageResult = targets[i].target.takeDamage(dmg, {
				ignoreRetaliation,
			});
			multiKill += damageResult.kill ? 1 : 0;
		}

		if (multiKill > 1) {
			attacker.player.score.push({ type: 'combo', kills: multiKill });
		}
	}

	/**
	 * Return whether there is at least one creature in the hexes that satisfies
	 * various conditions, e.g. team.
	 *
	 * @param hexes Array of hexes to test.
	 * @param {Object} o
	 * @return At least one valid target?
	 */
	atLeastOneTarget(hexes: Hex[], o): boolean {
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
	 * @return Return true if ability requirements are met.
	 */
	testRequirements(): boolean {
		const game = this.game;
		const def = {
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
		const reqEnergy = req.energy + this.creature.stats.reqEnergy;
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
		if (req.stats.health > 0) {
			if (this.creature.health <= req.stats.health) {
				this.message = abilityMsgs.notEnough.replace('%stat%', 'health');
				return false;
			}
		} else if (req.stats.health < 0) {
			if (this.creature.health > -req.stats.health) {
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
		const game = this.game;
		const creature = this.creature;

		if (this.costs === undefined) {
			return;
		}

		$j.each(this.costs, (key: string, value: number) => {
			if (typeof value == 'number') {
				if (key == 'health') {
					creature.hint(value.toString(), 'damage');
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
	 * @return array of ints, length of total directions, 1 if direction valid else 0
	 */
	testDirections(o: Record<string, any>): number[] {
		const defaultOpt = {
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

		const outDirections = [];
		let deadzone = [];

		for (let i = 0, len = o.directions.length; i < len; i++) {
			if (!o.directions[i]) {
				outDirections.push(0);
				continue;
			}

			let fx = 0;

			if (o.sourceCreature instanceof Creature) {
				const flipped = o.sourceCreature.player.flipped;

				if ((!flipped && i > 2) || (flipped && i < 3)) {
					fx = -1 * (o.sourceCreature.size - 1);
				}
			}

			let dir = this.game.grid.getHexLine(o.x + fx, o.y, i, o.flipped);

			if (o.distance > 0) {
				dir = dir.slice(0, o.distance + 1);
			}

			if (o.minDistance > 0) {
				// The untargetable area between the unit and the minimum distance.
				deadzone = dir.slice(0, o.minDistance);
				deadzone = arrayUtils.filterCreature(deadzone, o.includeCreature, o.stopOnCreature, o.id);

				dir = dir.slice(
					// 1 greater than expected to exclude current (source creature) hex.
					o.minDistance,
				);
			}

			dir = arrayUtils.filterCreature(dir, o.includeCreature, o.stopOnCreature, o.id);

			/* If the ability has a minimum distance and units should block LOS, this
			direction cannot be used if there is a unit in the deadzone. */
			const blockingUnitInDeadzone =
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
	 * @param {Object} o - Dict of arguments for direction query.
	 * @return true if valid targets in at least one direction, else false
	 */
	testDirection(o: object): boolean {
		const directions = this.testDirections(o);

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
	 * @param direction The direction the ability is being used.
	 * @returns is the ability being used backwards.
	 */
	isTargetingBackwards(direction: Direction): boolean {
		return (
			(this.creature.player.flipped && direction < Direction.DownLeft) ||
			(!this.creature.player.flipped && direction > Direction.DownRight)
		);
	}
}
