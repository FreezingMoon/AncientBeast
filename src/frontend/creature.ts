import $j from 'jquery';
import { Ability } from './ability';
import { Effect } from '../effect';
import Game from '../game';
import { Player } from '../player';
import { Drop } from './drops';
import { Hex } from './hex';
import { search } from '../utility/pathfinding';
import * as arrayUtils from '../utility/arrayUtils';

export abstract class Creature {
	game: Game;

	x: number;
	y: number;
	pos: { x: number; y: number };

	name: string;
	id: number;
	size: number;
	type: string;
	team: number;
	player: Player;
	hexagons: Hex[];

	dead: boolean;
	stats: any;
	abilities: Ability[];
	remainingMove: number;
	temp: boolean;

	level: number;
	realm: string;
	animation: string;
	drop: Drop;
	_movementType: string;

	killer: any;
	hasWait: boolean;
	travelDist: number;
	effects: Effect[];
	dropCollection: Drop[];
	protectedFromFatigue: boolean;
	turnsActive: number;

	baseStats: any;
	status: any;

	health: number;
	endurance: number;
	energy: number;

	materializationSickness: boolean;
	delayed: boolean;
	delayable: boolean;

	fatigueText: string;
	noActionPossible: boolean;

	oldEnergy: number;
	oldHealth: number;

	undead: boolean;

	constructor(obj: any, game: Game) {
		// Engine
		this.game = game;
		this.name = obj.name;
		this.id = game.creatureIdCounter++;
		this.x = obj.x - 0;
		this.y = obj.y - 0;
		this.pos = {
			x: this.x,
			y: this.y,
		};
		this.size = obj.size - 0;
		this.type = obj.type;
		this.level = obj.level - 0;
		this.realm = obj.realm;
		this.animation = obj.animation;
		this.drop = obj.drop;
		this._movementType = 'normal';
		this.temp = obj.temp;

		if (obj.movementType) {
			this._movementType = obj.movementType;
		}

		this.hexagons = [];

		// Game
		this.team = obj.team; // = playerID (0,1,2,3)
		this.player = game.players[obj.team];
		this.dead = false;
		this.killer = undefined;
		this.hasWait = false;
		this.travelDist = 0;
		this.effects = [];
		this.dropCollection = [];
		this.protectedFromFatigue = this.isDarkPriest() ? true : false;
		this.turnsActive = 0;

		this.baseStats = {
			health: obj.stats.health - 0,
			endurance: obj.stats.endurance - 0,
			regrowth: obj.stats.regrowth - 0,
			energy: obj.stats.energy - 0,
			meditation: obj.stats.meditation - 0,
			initiative: obj.stats.initiative - 0,
			offense: obj.stats.offense - 0,
			defense: obj.stats.defense - 0,
			movement: obj.stats.movement - 0,
			pierce: obj.stats.pierce - 0,
			slash: obj.stats.slash - 0,
			crush: obj.stats.crush - 0,
			shock: obj.stats.shock - 0,
			burn: obj.stats.burn - 0,
			frost: obj.stats.frost - 0,
			poison: obj.stats.poison - 0,
			sonic: obj.stats.sonic - 0,
			mental: obj.stats.mental - 0,

			/* TODO: Move boolean flags into this.status, because updateAlterations() resets
			this.stats unless they've been applied via an effect. */
			moveable: true,
			fatigueImmunity: false,
			// Extra energy required for abilities
			reqEnergy: 0,
		};

		this.stats = {
			...this.baseStats,

			/**
			 * Represents the available "pool" or maximum health of the creature.
			 * `this.health` represents the current remaining health which cannot exceed
			 * this value.
			 */
			health: this.baseStats.health,

			/**
			 * Represents the available "pool" or maximum energy of the creature.
			 * `this.energy` represents the current remaining energy which cannot exceed
			 * this value.
			 */
			energy: this.baseStats.energy,

			/**
			 * Represents the available "pool" or maximum endurance of the creature.
			 * `this.endurance` represents the current remaining endurance which cannot
			 * exceed this value. It also cannot be lower than 0.
			 */
			endurance: this.baseStats.endurance,

			/**
			 * Represents the available "pool" or maximum movement of the creature.
			 * `this.remainingMove` represents the current remaining movement which cannot
			 * exceed this value.
			 */
			movement: this.baseStats.movement,
		};

		this.status = {
			/**
			 * "Frozen" creature will miss their next turn. Frozen expires at the end
			 * of their next (missed) turn. Any damage will break the frozen status.
			 */
			frozen: false,

			/**
			 * "Cryostasis" enhances the "Frozen" status to not break on damage from any
			 * source.
			 */
			cryostasis: false,

			/**
			 * Another type of "Frozen", with a different name.
			 */
			dizzy: false,
		};

		// Current health. Maximum health is `this.stats.health`.
		this.health = obj.stats.health;
		// Current endurance. Maximum endurance is `this.stats.endurance`.
		this.endurance = obj.stats.endurance;
		// Current energy. Maximum energy is `this.stats.energy`.
		this.energy = obj.stats.energy;
		// Current movement. Maximum movement is `this.stats.movement`.
		this.remainingMove = 0; //Default value recovered each turn

		// Abilities
		this.abilities = [];

		this.updateHex();

		// State variable for displaying endurance/fatigue text
		this.fatigueText = '';

		// Adding Himself to creature arrays and queue
		game.creatures[this.id] = this;

		this.delayable = true;
		this.delayed = false;
		if (typeof obj.materializationSickness !== 'undefined') {
			this.materializationSickness = obj.materializationSickness;
		} else {
			this.materializationSickness = this.isDarkPriest() ? false : true;
		}
		this.noActionPossible = false;
	}

	/**
	 * Summon animation.
	 *
	 * @param {boolean} disableMaterializationSickness Do not affect the creature with Materialization Sickness.
	 */
	abstract summon(disableMaterializationSickness: boolean): void;

	abstract healthHide(): void;

	abstract healthShow(): void;

	abstract activate(): void;

	/**
	 * deactivate(wait)
	 *
	 * wait :	Boolean :	Deactivate while waiting or not
	 *
	 * Preview the creature position at the given coordinates
	 *
	 */
	deactivate(wait: boolean): void {
		let game = this.game;
		this.delayed = Boolean(wait);
		this.hasWait = this.delayed;
		this.status.frozen = false;
		this.status.cryostasis = false;
		this.status.dizzy = false;

		// Effects triggers
		if (!wait) {
			this.turnsActive += 1;
			game.onEndPhase(this);
		}

		this.delayable = false;
	}

	/**
	 * wait()
	 *
	 * Move the creature to the end of the queue
	 *
	 */
	wait(): void {
		let abilityAvailable = false;

		if (this.delayed) {
			return;
		}

		// If at least one ability has not been used
		this.abilities.forEach((ability) => {
			abilityAvailable = abilityAvailable || !ability.used;
		});

		if (this.remainingMove > 0 && abilityAvailable) {
			this.delay(this.game.activeCreature === this);
			this.deactivate(true);
		}
	}

	delay(excludeActiveCreature: boolean): void {
		let game = this.game;

		game.queue.delay(this);
		this.delayable = false;
		this.delayed = true;
		this.hint('Delayed', 'msg_effects');
		game.updateQueueDisplay(excludeActiveCreature);
	}

	/**
	 * queryMove()
	 *
	 * launch move action query
	 *
	 */
	abstract queryMove(o?: any): void;

	/**
	 * previewPosition(hex)
	 *
	 * hex :		Hex :		Position
	 *
	 * Preview the creature position at the given Hex
	 *
	 */
	abstract previewPosition(hex: Hex): void;

	/**
	 * cleanHex()
	 *
	 * Clean current creature hexagons
	 *
	 */
	cleanHex(): void {
		this.hexagons.forEach((hex) => {
			hex.creature = undefined;
		});
		this.hexagons = [];
	}

	/**
	 * updateHex()
	 *
	 * Update the current hexes containing the creature and their display
	 *
	 */
	updateHex() {
		let count = this.size,
			i: number;

		for (i = 0; i < count; i++) {
			this.hexagons.push(this.game.grid.hexes[this.y][this.x - i]);
		}

		this.hexagons.forEach((hex) => {
			hex.creature = this;
		});
	}

	/**
	 * faceHex(facefrom,faceto)
	 *
	 * facefrom :	Hex or Creature :	Hex to face from
	 * faceto :	Hex or Creature :	Hex to face
	 *
	 * Face creature at given hex
	 *
	 */
	abstract faceHex(faceto: any, facefrom?: any, ignoreCreaHex?: boolean, attackFix?: boolean): void;

	/**
	 * facePlayerDefault()
	 *
	 * Face default direction
	 *
	 */
	abstract facePlayerDefault(): void;

	/**
	 * moveTo(hex,opts)
	 *
	 * hex :		Hex :		Destination Hex
	 * opts :		Object :	Optional args object
	 *
	 * Move the creature along a calculated path to the given coordinates
	 *
	 */
	abstract moveTo(hex: Hex, opts: any): void;

	/**
	 * tracePath(hex)
	 *
	 * hex :	Hex :	Destination Hex
	 *
	 * Trace the path from the current position to the given coordinates
	 *
	 */
	abstract tracePath(hex: Hex): void;

	abstract tracePosition(args: any): void;

	/**
	 * calculatePath(x,y)
	 *
	 * x :		Integer :	Destination coordinates
	 * y :		Integer :	Destination coordinates
	 *
	 * return :	Array :	Array containing the path hexes
	 *
	 */
	calculatePath(x: number, y: number): Hex[] {
		let game = this.game;

		return search(
			game.grid.hexes[this.y][this.x],
			game.grid.hexes[y][x],
			this.size,
			this.id,
			this.game.grid,
		); // Calculate path
	}

	/**
	 * calcOffset(x,y)
	 *
	 * x :		Integer :	Destination coordinates
	 * y :		Integer :	Destination coordinates
	 *
	 * return :	Object :	New position taking into acount the size, orientation and obstacle {x,y}
	 *
	 * Return the first possible position for the creature at the given coordinates
	 *
	 */
	calcOffset(x: number, y: number): { x: number; y: number } {
		let game = this.game,
			offset = game.players[this.team].flipped ? this.size - 1 : 0,
			mult = game.players[this.team].flipped ? 1 : -1; // For FLIPPED player

		for (let i = 0; i < this.size; i++) {
			// Try next hexagons to see if they fit
			if (x + offset - i * mult >= game.grid.hexes[y].length || x + offset - i * mult < 0) {
				continue;
			}

			if (game.grid.hexes[y][x + offset - i * mult].isWalkable(this.size, this.id, false, false)) {
				x += offset - i * mult;
				break;
			}
		}

		return {
			x: x,
			y: y,
		};
	}

	/**
	 * getInitiative()
	 *
	 * return :	Integer :	Initiative value to order the queue
	 *
	 */
	getInitiative(): number {
		// To avoid 2 identical initiative
		return this.stats.initiative * 500 - this.id;
	}

	/**
	 * adjacentHexes(dist)
	 *
	 * dist :		Integer :	Distance in hexagons
	 *
	 * return :	Array :		Array of adjacent hexagons
	 *
	 */
	adjacentHexes(dist: number, clockwise?: Hex[]) {
		let game = this.game;

		// TODO Review this algo to allow distance
		if (clockwise) {
			let hexes = [],
				c = [];
			let o = this.y % 2 === 0 ? 1 : 0;

			if (this.size == 1) {
				c = [
					{
						y: this.y,
						x: this.x + 1,
					},
					{
						y: this.y - 1,
						x: this.x + o,
					},
					{
						y: this.y - 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y,
						x: this.x - 1,
					},
					{
						y: this.y + 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y + 1,
						x: this.x + o,
					},
				];
			}

			if (this.size == 2) {
				c = [
					{
						y: this.y,
						x: this.x + 1,
					},
					{
						y: this.y - 1,
						x: this.x + o,
					},
					{
						y: this.y - 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y - 1,
						x: this.x - 2 + o,
					},
					{
						y: this.y,
						x: this.x - 2,
					},
					{
						y: this.y + 1,
						x: this.x - 2 + o,
					},
					{
						y: this.y + 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y + 1,
						x: this.x + o,
					},
				];
			}

			if (this.size == 3) {
				c = [
					{
						y: this.y,
						x: this.x + 1,
					},
					{
						y: this.y - 1,
						x: this.x + o,
					},
					{
						y: this.y - 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y - 1,
						x: this.x - 2 + o,
					},
					{
						y: this.y - 1,
						x: this.x - 3 + o,
					},
					{
						y: this.y,
						x: this.x - 3,
					},
					{
						y: this.y + 1,
						x: this.x - 3 + o,
					},
					{
						y: this.y + 1,
						x: this.x - 2 + o,
					},
					{
						y: this.y + 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y + 1,
						x: this.x + o,
					},
				];
			}

			let total = c.length;
			for (let i = 0; i < total; i++) {
				const { x, y } = c[i];
				if (game.grid.hexExists(y, x)) {
					hexes.push(game.grid.hexes[y][x]);
				}
			}

			return hexes;
		}

		if (this.size > 1) {
			let hexes = this.hexagons[0].adjacentHex(dist);
			let lasthexes = this.hexagons[this.size - 1].adjacentHex(dist);

			hexes.forEach((hex) => {
				if (arrayUtils.findPos(this.hexagons, hex)) {
					arrayUtils.removePos(hexes, hex);
				} // Remove from array if own creature hex
			});

			lasthexes.forEach((hex) => {
				// If node doesnt already exist in final collection and if it's not own creature hex
				if (!arrayUtils.findPos(hexes, hex) && !arrayUtils.findPos(this.hexagons, hex)) {
					hexes.push(hex);
				}
			});

			return hexes;
		} else {
			return this.hexagons[0].adjacentHex(dist);
		}
	}

	/**
	 * recharge
	 * @param {number} amount: amount of energy to restore
	 * @return {void}
	 * Restore energy up to the max limit
	 */
	recharge(amount: number, log: boolean = true): void {
		this.energy = Math.min(this.stats.energy, this.energy + amount);

		if (log) {
			this.game.log('%CreatureName' + this.id + '% recovers +' + amount + ' energy');
		}
	}

	/**
	 * Restore endurance to a creature. Will be capped against the creature's maximum
	 * endurance (this.stats.endurance).
	 *
	 * @param {*} amount Number of endurance points to restore.
	 */
	restoreEndurance(amount: number, log: boolean = true): void {
		this.endurance = Math.min(this.stats.endurance, this.endurance + amount);

		if (log) {
			this.game.log('%CreatureName' + this.id + '% recovers +' + amount + ' endurance');
		}
	}

	/**
	 * Restore remaining movement to a creature. Will be capped against the creature's
	 * maximum movement (this.stats.movement).
	 *
	 * @param {*} amount Number of movement points to restore.
	 */
	restoreMovement(amount: number, log: boolean = true): void {
		this.remainingMove = Math.min(this.stats.movement, this.remainingMove + amount);

		if (log) {
			this.game.log('%CreatureName' + this.id + '% recovers +' + amount + ' movement');
		}
	}

	/**
	 * heal(amount)
	 *
	 * amount :	Damage :	Amount of health point to restore
	 */
	heal(amount: number, isRegrowth: boolean, log: boolean = true): void {
		let game = this.game;
		// Cap health point
		amount = Math.min(amount, this.stats.health - this.health);

		if (this.health + amount < 1) {
			amount = this.health - 1; // Cap to 1hp
		}

		this.health += amount;

		// Health display Update
		this.updateHealth(isRegrowth);

		if (amount > 0) {
			if (isRegrowth) {
				this.hint('+' + amount + ' ♥', 'healing d' + amount);
			} else {
				this.hint('+' + amount, 'healing d' + amount);
			}

			if (log) {
				game.log('%CreatureName' + this.id + '% recovers +' + amount + ' health');
			}
		} else if (amount === 0) {
			if (isRegrowth) {
				this.hint('♦', 'msg_effects');
			} else {
				this.hint('!', 'msg_effects');
			}
		} else {
			if (isRegrowth) {
				this.hint(amount + ' ♠', 'damage d' + amount);
			} else {
				this.hint(amount.toString(), 'damage d ' + amount);
			}

			if (log) {
				game.log('%CreatureName' + this.id + '% loses ' + amount + ' health');
			}
		}

		game.onHeal(this, amount);
	}

	/**
	 * takeDamage(damage)
	 *
	 * damage :	Damage : 	Damage object
	 *
	 * return :	Object :	Contains damages dealt and if creature is killed or not
	 */
	takeDamage(damage: any, o: any): any {
		let game = this.game;

		if (this.dead) {
			console.info(`${this.name} (${this.id}) is already dead, aborting takeDamage call.`);
			return;
		}

		let defaultOpt = {
			ignoreRetaliation: false,
			isFromTrap: false,
		};

		o = $j.extend(defaultOpt, o);
		// Determine if melee attack
		damage.melee = false;
		this.adjacentHexes(1).forEach((hex) => {
			if (damage.attacker == hex.creature) {
				damage.melee = true;
			}
		});

		damage.target = this;
		damage.isFromTrap = o.isFromTrap;

		// Trigger
		game.onUnderAttack(this, damage);
		game.onAttack(damage.attacker, damage);

		// Calculation
		if (damage.status === '') {
			// Damages
			let dmg = damage.applyDamage();
			let dmgAmount = dmg.total;

			if (!isFinite(dmgAmount)) {
				// Check for Damage Errors
				this.hint('Error', 'damage');
				game.log('Oops something went wrong !');

				return {
					damages: 0,
					kill: false,
				};
			}

			this.health -= dmgAmount;
			this.health = this.health < 0 ? 0 : this.health; // Cap

			this.addFatigue(dmgAmount);

			// Display
			let nbrDisplayed = dmgAmount ? '-' + dmgAmount : 0;
			this.hint(nbrDisplayed.toString(), 'damage d' + dmgAmount);

			if (!damage.noLog) {
				game.log('%CreatureName' + this.id + '% is hit : ' + nbrDisplayed + ' health');
			}

			// If Health is empty
			if (this.health <= 0) {
				this.die(damage.attacker);

				return {
					damages: dmg,
					damageObj: damage,
					kill: true,
				}; // Killed
			}

			// Effects
			damage.effects.forEach((effect: Effect) => {
				this.addEffect(effect);
			});

			// Unfreeze if taking non-zero damage and not a Cryostasis freeze.
			if (dmgAmount > 0 && !this.isInCryostasis()) {
				this.status.frozen = false;
			}

			// Health display Update
			// Note: update health after adding effects as some effects may affect
			// health display
			this.updateHealth();
			game.UI.updateFatigue();
			/* Some of the active creature's abilities may become active/inactive depending
			on new health/endurance values. */
			game.UI.checkAbilities();

			// Trigger
			if (!o.ignoreRetaliation) {
				game.onDamage(this, damage);
			}

			return {
				damages: dmg,
				damageObj: damage,
				kill: false,
			}; // Not Killed
		} else {
			if (damage.status == 'Dodged') {
				// If dodged
				if (!damage.noLog) {
					game.log('%CreatureName' + this.id + '% dodged the attack');
				}
			}

			if (damage.status == 'Shielded') {
				// If Shielded
				if (!damage.noLog) {
					game.log('%CreatureName' + this.id + '% shielded the attack');
				}
			}

			if (damage.status == 'Disintegrated') {
				// If Disintegrated
				if (!damage.noLog) {
					game.log('%CreatureName' + this.id + '% has been disintegrated');
				}
				this.die(damage.attacker);
			}

			// Hint
			this.hint(damage.status, 'damage ' + damage.status.toLowerCase());
		}

		return {
			damageObj: damage,
			kill: false,
		}; // Not killed
	}

	updateHealth(noAnimBar?: boolean): void {
		let game = this.game;

		if (this == game.activeCreature && !noAnimBar) {
			game.UI.healthBar.animSize(this.health / this.stats.health);
		}

		// Dark Priest plasma shield when inactive
		if (this.isDarkPriest()) {
			if (this.hasCreaturePlayerGotPlasma() && this !== game.activeCreature) {
				this.displayPlasmaShield();
			} else {
				this.displayHealthStats();
			}
		} else {
			this.displayHealthStats();
		}
	}

	abstract displayHealthStats(): void;
	abstract displayPlasmaShield(): void;

	hasCreaturePlayerGotPlasma(): boolean {
		return this.player.plasma > 0;
	}

	addFatigue(dmgAmount: number): void {
		if (!this.stats.fatigueImmunity) {
			this.endurance -= dmgAmount;
			this.endurance = this.endurance < 0 ? 0 : this.endurance; // Cap
		}

		this.game.UI.updateFatigue();
	}

	/**
	 * addEffect(effect)
	 *
	 * effect :		Effect :	Effect object
	 *
	 */
	addEffect(
		effect: Effect,
		specialString?: string,
		specialHint?: string,
		disableLog: boolean = false,
		disableHint: boolean = false,
	): boolean {
		let game = this.game;

		// @ts-ignore
		if (!effect.stackable && this.findEffect(effect.name).length !== 0) {
			return false;
		}

		effect.target = this;
		this.effects.push(effect);

		game.onEffectAttach(this, effect);

		this.updateAlteration();

		if (effect.name !== '') {
			if (!disableHint) {
				// @ts-ignore
				if (specialHint || effect.specialHint) {
					this.hint(specialHint, 'msg_effects');
				} else {
					this.hint(effect.name, 'msg_effects');
				}
			}

			if (!disableLog) {
				if (specialString) {
					game.log(specialString);
				} else {
					game.log('%CreatureName' + this.id + '% is affected by ' + effect.name);
				}
			}
		}
	}

	/**
	 * replaceEffect
	 * Add effect, but if the effect is already attached, replace it with the new
	 * effect.
	 * Note that for stackable effects, this is the same as addEffect()
	 *
	 * @param {Effect} effect: the effect to add
	 * @return {void}
	 */
	replaceEffect(effect: Effect): void {
		// @ts-ignore
		if (!effect.stackable && this.findEffect(effect.name).length !== 0) {
			this.removeEffect(effect.name);
		}

		this.addEffect(effect);
	}

	/**
	 * removeEffect
	 * Remove an effect by name
	 *
	 * @param {string} name: name of effect
	 * @return {void}
	 */
	removeEffect(name: string): void {
		let totalEffects = this.effects.length;

		for (let i = 0; i < totalEffects; i++) {
			if (this.effects[i].name === name) {
				this.effects.splice(i, 1);
				break;
			}
		}
	}

	abstract hint(text: string, cssClass?: string): void;

	/**
	 * updateAlteration()
	 *
	 * Update the stats taking into account the effects' alteration
	 *
	 */
	updateAlteration(): void {
		this.stats = { ...this.baseStats };

		let buffDebuffArray = [...this.effects, ...this.dropCollection];

		buffDebuffArray.forEach((buff: any) => {
			$j.each(buff.alterations, (key, value) => {
				if (typeof value == 'string') {
					// Multiplication Buff
					if (value.match(/\*/)) {
						this.stats[key] = eval(this.stats[key] + value);
					}

					// Division Debuff
					if (value.match(/\//)) {
						this.stats[key] = eval(this.stats[key] + value);
					}
				}

				// Usual Buff/Debuff
				if (typeof value == 'number') {
					this.stats[key] += value;
				}

				// Boolean Buff/Debuff
				if (typeof value == 'boolean') {
					this.stats[key] = value;
				}
			});
		});

		// Maximum stat pools cannot be lower than 1.
		this.stats.health = Math.max(this.stats.health, 1);
		this.stats.endurance = Math.max(this.stats.endurance, 1);
		this.stats.energy = Math.max(this.stats.energy, 1);
		this.stats.movement = Math.max(this.stats.movement, 1);

		// These stats cannot exceed their maximum values.
		this.health = Math.min(this.health, this.stats.health);
		this.endurance = Math.min(this.endurance, this.stats.endurance);
		this.energy = Math.min(this.energy, this.stats.energy);
		this.remainingMove = Math.min(this.remainingMove, this.stats.movement);
	}

	/**
	 * die()
	 *
	 * kill animation. remove creature from queue and from hexes
	 *
	 * killer :	Creature :	Killer of this creature
	 *
	 */
	abstract die(killer: any): void;

	isFatigued(): boolean {
		return this.endurance === 0;
	}

	isFragile(): boolean {
		return this.stats.endurance === 1;
	}

	/**
	 * getHexMap()
	 *
	 * shortcut convenience function to grid.getHexMap
	 */
	getHexMap(map: any, invertFlipped: boolean): Hex[] {
		let x = (this.player.flipped ? !invertFlipped : invertFlipped)
			? this.x + 1 - this.size
			: this.x;
		return this.game.grid.getHexMap(
			x,
			this.y - map.origin[1],
			0 - map.origin[0],
			this.player.flipped ? !invertFlipped : invertFlipped,
			map,
		);
	}

	findEffect(name: string) {
		let ret = [];

		this.effects.forEach((effect) => {
			if (effect.name == name) {
				ret.push(effect);
			}
		});

		return ret;
	}

	// Make units transparent
	abstract xray(enable: boolean): void;

	pickupDrop(): void {
		this.hexagons.forEach((hex) => {
			hex.pickupDrop(this);
		});
	}

	/**
	 * Get movement type for this creature
	 * @return {string} "normal", "hover", or "flying"
	 */
	movementType(): string {
		let totalAbilities = this.abilities.length;

		// If the creature has an ability that modifies movement type, use that,
		// otherwise use the creature's base movement type
		for (let i = 0; i < totalAbilities; i++) {
			if ('movementType' in this.abilities[i]) {
				// @ts-ignore
				return this.abilities[i].movementType();
			}
		}

		return this._movementType;
	}

	/**
	 * Is this unit a Dark Priest?
	 *
	 * @returns {boolean}
	 */
	isDarkPriest(): boolean {
		return this.type === '--';
	}

	/**
	 * Does the creature have the Frozen status? @see status.frozen
	 *
	 * @returns {boolean}
	 */
	isFrozen(): boolean {
		return this.status.frozen;
	}

	/**
	 * Does the creature have the Cryostasis status? @see status.cryostasis
	 *
	 * @returns {boolean}
	 */
	isInCryostasis(): boolean {
		return this.isFrozen() && this.status.cryostasis;
	}

	/**
	 * Same as the "Frozen" status, but with a different name.
	 *
	 * TODO: Refactor to a generic "skip turn" status that can be customised.
	 *
	 * @returns {boolean}
	 */
	isDizzy(): boolean {
		return this.status.dizzy;
	}

	/**
	 * Freeze a creature, skipping its next turn. @see status.frozen
	 *
	 * @param {boolean} cryostasis Also apply the Cryostasis status @see status.cryostasis
	 */
	freeze(cryostasis: boolean = false): void {
		this.status.frozen = true;

		if (cryostasis) {
			this.status.cryostasis = true;
		}

		// Update the health box under the creature cardboard with frozen effect.
		this.updateHealth();
		// Show frozen fatigue text effect in queue.
		this.game.UI.updateFatigue();

		this.game.signals.creature.dispatch('frozen', { creature: this, cryostasis });
	}
}
