import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
import { Creature } from '../creature';
import { Effect } from '../effect';
import { Hex } from '../utility/hex';
import Game from '../game';
import { shakeBoard } from '../game-display/camera';

/**
 * Creates the abilities
 * @param {Game} G the game object
 * @return {void}
 */
/** Damage of each Carving Nails strike before the per-unit multiplier. */
const CARVING_NAILS_DAMAGE = 8;
/** Flat health restored per strike when Carving Nails is upgraded. */
const CARVING_NAILS_UPGRADED_HEAL = 8;

/**
 * Rings of hexagons searched when measuring how far a lured unit is from Miss
 * Creeper: the whole board, so a unit at the far end of the upgraded range
 * still compares like any other.
 */
const BOARD_RINGS = 24;

export default (G: Game) => {
	G.abilities[19] = [
		// First Ability: Muscous Pillar
		{
			// Reacts to any *other* unit dying, ally or foe, as long as it
			// happened close enough for her to feed on the remains.
			trigger: 'onOtherCreatureDeath',

			require: function (deadCreature: unknown) {
				const dead = deadCreature as Creature;

				if (!this.testRequirements()) {
					return false;
				}

				if (!dead || dead.id === this.creature.id) {
					return false;
				}

				// Temporary summons (clones, traps, decoys) leave nothing behind.
				if (dead.temp) {
					return false;
				}

				return this._isNearby(dead);
			},

			activate: function (deadCreature: unknown) {
				const creeper = this.creature;
				const dead = deadCreature as Creature;
				const ratio = this.isUpgraded() ? 0.4 : 0.2;
				const amount = Math.round(dead.stats.health * ratio);

				if (amount <= 0) {
					return;
				}

				G.log('%CreatureName' + creeper.id + '% feeds on %CreatureName' + dead.id + "%'s remains");

				creeper.heal(amount);
			},

			/**
			 * Whether the given creature died within one hexagon of Miss Creeper.
			 *
			 * Adjacency is measured by position, on the corpse's own hexagons:
			 * by the time an `onCreatureDeath` trigger runs, the dying unit's
			 * hexes have already dropped their `creature` back-reference, so
			 * looking the unit up on the board would find nothing (Cycloper's
			 * Explosive End reads the corpse the same way).
			 * @param {Creature} dead The unit that just died.
			 * @return {boolean} True if she is adjacent to the death location.
			 */
			_isNearby: function (dead: Creature) {
				const near = this.creature.adjacentHexes(1);
				const corpses = dead.hexagons.length ? dead.hexagons : [{ x: dead.x, y: dead.y }];

				return corpses.some((corpse: Hex) =>
					near.some((hex: Hex) => hex.x === corpse.x && hex.y === corpse.y),
				);
			},
		},

		// Second Ability: Carving Nails
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// Successful strikes per unit, by creature id: the value in there is
			// how many times that unit has been carved already.
			_strikes: {} as Record<number, number>,

			// require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				// At least one adjacent target
				if (
					!this.atLeastOneTarget(this.creature.adjacentHexes(1), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			// query() :
			query: function () {
				const ability = this;
				const creeper = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: (...args) => ability.animation(...args),
					team: this._targetTeam,
					id: creeper.id,
					flipped: creeper.player.flipped,
					hexes: creeper.adjacentHexes(1),
				});
			},

			// activate() :
			activate: function (target: Creature) {
				this.end();
				shakeBoard({
					amplitude: 0.01,
					durationMs: 65,
					force: true,
					axis: 'horizontal',
				});

				// Every strike on the same unit cuts deeper: the Nth one on a
				// given unit multiplies the base damage by N. The count lives on
				// the ability, so it survives turn to turn and stays per unit —
				// alternating between two foes keeps both counts climbing on
				// their own.
				const strikes = (this._strikes[target.id] ?? 0) + 1;
				this._strikes[target.id] = strikes;

				// The unit data carries the base damage, so the dash card, the
				// panel and the strike itself read the same numbers.
				const damages = {
					pierce: (this.damages?.pierce ?? CARVING_NAILS_DAMAGE) * strikes,
					slash: (this.damages?.slash ?? CARVING_NAILS_DAMAGE) * strikes,
				};

				target.takeDamage(new Damage(this.creature, damages, 1, [], G));

				// Upgraded claws feed her a flat amount per strike, whatever the
				// multiplier has grown to.
				if (this.isUpgraded()) {
					this.creature.heal(CARVING_NAILS_UPGRADED_HEAL);
				}
			},
		},

		// Third Ability: Fatal Attraction
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			range: { regular: 6, upgraded: 10 },

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				return this.atLeastOneTarget(this._getHexes(), {
					team: this._targetTeam,
					optTest: (creature: Creature) => this._confirmTarget(creature),
				});
			},

			// query() :
			query: function () {
				const ability = this;
				const creeper = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: (...args) => ability.animation(...args),
					team: this._targetTeam,
					id: creeper.id,
					flipped: creeper.player.flipped,
					hexes: this._getHexes(),
					optTest: (creature: Creature) => this._confirmTarget(creature),
				});
			},

			// activate() :
			activate: function (target: Creature) {
				this.end();

				const effect = new Effect(
					this.title, // Name
					this.creature, // Caster
					target, // Target
					'onStartPhase',
					{
						effectFn: (effect: Effect, creatureOrHex) => {
							this._attract(effect, creatureOrHex as Creature);
						},
						deleteTrigger: '',
						turnLifetime: -1,
						stackable: false,
						deleteOnOwnerDeath: true,
					},
					G,
				);

				target.addEffect(
					effect,
					'%CreatureName' + target.id + '% is attracted to %CreatureName' + this.creature.id + '%',
				);
			},

			/**
			 * Hexagons the ability can reach, using the upgraded range when the
			 * ability has been upgraded.
			 * @return {Hex[]} Every hexagon within range of Miss Creeper.
			 */
			_getHexes: function () {
				const range = this.isUpgraded() ? this.range.upgraded : this.range.regular;

				return this.creature.adjacentHexes(range);
			},

			/**
			 * Whether a unit can be lured. Summoners are never affected (see the
			 * ability description); anything else in range is fair game, including
			 * units that already stand next to her.
			 * @param {Creature} creature Targeted unit.
			 * @return {boolean} True if the unit is a valid target.
			 */
			_confirmTarget: function (creature: Creature) {
				return !creature.isDarkPriest();
			},

			/**
			 * Whether the target already stands on a hexagon touching hers.
			 * @param {Creature} target Attracted unit.
			 * @param {Creature} creeper Miss Creeper.
			 * @return {boolean} True if both units are adjacent.
			 */
			_isAdjacent: function (target: Creature, creeper: Creature) {
				return creeper
					.adjacentHexes(1)
					.some((hex: Hex) => hex.creature && hex.creature.id === target.id);
			},

			/**
			 * Rings of hexagons separating a hexagon from Miss Creeper, using the
			 * grid's own adjacency geometry.
			 * @param {Hex} hex Hexagon to measure.
			 * @param {Creature} creeper Miss Creeper.
			 * @return {number} Number of hexagons between them.
			 */
			_ringDistance: function (hex: Hex, creeper: Creature) {
				const anchor = G.grid.hexes[creeper.y][creeper.x];

				// The whole board: a lured unit can stand at the far end of the
				// upgraded range, well past six rings.
				for (let ring = 1; ring <= BOARD_RINGS; ring++) {
					if (anchor.adjacentHex(ring).some((item: Hex) => item.x === hex.x && item.y === hex.y)) {
						return ring;
					}
				}

				return Number.MAX_SAFE_INTEGER;
			},

			/**
			 * Hexagon that brings the lured unit one hexagon closer to her: the
			 * freely walkable neighbour nearest to Miss Creeper.
			 *
			 * Reachability is ignored on purpose. The pull runs at the start of the
			 * lured unit's turn, before its movement query paints the reachable
			 * hexagons, so `isWalkable` would report every hexagon as blocked.
			 * @param {Creature} target Attracted unit.
			 * @param {Creature} creeper Miss Creeper.
			 * @return {Hex | undefined} Next hexagon of the walk, if any.
			 */
			_getStepTowards: function (target: Creature, creeper: Creature): Hex | undefined {
				const current = G.grid.hexes[target.y][target.x];

				let best: Hex | undefined;
				let bestDistance = Number.MAX_SAFE_INTEGER;

				current.adjacentHex(1).forEach((hex: Hex) => {
					if (!hex.isWalkable(target.size, target.id, true)) {
						return;
					}

					const distance = this._ringDistance(hex, creeper);

					if (distance < bestDistance) {
						bestDistance = distance;
						best = hex;
					}
				});

				return best;
			},

			/**
			 * Walks the lured unit towards Miss Creeper for as long as its own
			 * movement points allow, then drops the attraction.
			 * @param {Effect} effect Attraction effect.
			 * @param {Creature} target Attracted unit.
			 * @return {void}
			 */
			_attract: function (effect: Effect, target: Creature) {
				if (!target || target.dead || target.stats.moveable === false) {
					effect.deleteEffect();
					return;
				}

				const creeper = effect.owner as Creature;

				if (!creeper || creeper.dead) {
					effect.deleteEffect();
					return;
				}

				if (this._isAdjacent(target, creeper)) {
					effect.deleteEffect();
					return;
				}

				const finish = () => {
					effect.deleteEffect();

					// The pull walked the unit in the middle of its own turn, so
					// the turn's default movement query was skipped for it: while
					// an ability animation owns the board, the engine leaves the
					// hand-back to that animation. Hand it over now, the way a
					// caster does when its own effect is over, or the unit would
					// sit through its turn with no movement range, no path
					// preview and no hover highlights.
					if (G.activeCreature === target) {
						target.queryMove();
					}
				};

				const step = () => {
					if (
						target.dead ||
						creeper.dead ||
						target.remainingMove <= 0 ||
						this._isAdjacent(target, creeper)
					) {
						finish();
						return;
					}

					const destination = this._getStepTowards(target, creeper);

					if (!destination) {
						// Walled off: she cannot reach through stone.
						finish();
						return;
					}

					target.moveTo(destination, {
						ignoreMovementPoint: false,
						ignorePath: true,
						animation: 'walk',
						callback: step,
					});
				};

				G.log(
					'%CreatureName' + target.id + '% is dragged towards %CreatureName' + creeper.id + '%',
				);

				step();
			},
		},

		// Fourth Ability: Tendril Feet
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				// At least one target
				if (
					!this.atLeastOneTarget(this.creature.adjacentHexes(1), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			// query() :
			query: function () {
				const ability = this;
				const creeper = this.creature;

				const showOutlinedArea = function () {
					creeper.adjacentHexes(1).forEach(function (hex) {
						hex.cleanOverlayVisualState(
							'hover selected reachable weakDmg moveto ownCreatureHexShade h_player0 h_player1 h_player2 h_player3',
						);
						hex.cleanDisplayVisualState(
							'adj dashed shrunken creature player0 player1 player2 player3',
						);
						if (hex.creature instanceof Creature && hex.creature.id !== creeper.id) {
							hex.overlayVisualState('hover h_player' + hex.creature.team);
						}
					});
				};

				G.grid.queryHexes({
					fnOnConfirm: (...args) => ability.animation(...args),
					fnOnHoverOutside: showOutlinedArea,
					callbackAfterQueryHexes: showOutlinedArea,
					id: creeper.id,
					flipped: creeper.player.flipped,
					hexes: creeper.adjacentHexes(1),
					targeting: false,
					fillHexOnHover: false,
					hideNonTarget: true,
				});
			},

			// activate() :
			activate: function () {
				const ability = this;
				const creeper = this.creature;

				ability.end();
				shakeBoard({
					amplitude: 0.02,
					durationMs: 150,
					force: true,
					axis: 'vertical',
				});

				// Only foes are caught by the tendrils, allies walk through them.
				const aoe = creeper
					.adjacentHexes(1)
					.filter(
						(hex: Hex) =>
							hex.creature instanceof Creature && isTeam(creeper, hex.creature, Team.Enemy),
					);

				const targets = ability.getTargets(aoe);

				targets.forEach(function (item) {
					const target = item.target;

					// Rooted until the end of their next turn.
					const tendrils = new Effect(
						ability.title,
						creeper,
						target,
						'',
						{
							alterations: {
								moveable: false,
							},
							deleteTrigger: 'onEndPhase',
							turnLifetime: 1,
							creationTurn: G.turn - 1,
							deleteOnOwnerDeath: true,
						},
						G,
					);

					target.addEffect(
						tendrils,
						'%CreatureName' + target.id + '% is being grasped by tentacles',
					);

					if (ability.isUpgraded()) {
						ability._disableAbilityUpgrades(target, tendrils);
					}

					target.takeDamage(new Damage(creeper, ability.damages, 1, [], G));
				});
			},

			/**
			 * Silences the ability upgrades of a rooted unit for exactly as long as
			 * the tendrils hold it.
			 *
			 * Cyber Wolf's Bad Doggie is the case this exists for: upgraded it
			 * snarls at both ends of a turn, un-upgraded only at the start. The
			 * silencing is an override on the ability instance, so the engine's own
			 * bookkeeping — `setUpgraded`, upgrade counters, the panel's re-arm pass
			 * — keeps running and simply reads as silenced. It lifts at the start of
			 * the first turn the tendrils are gone from, which covers the whole
			 * rooted turn and also Miss Creeper dying mid-hold: the tendrils drop
			 * with her and the silence then lifts on its own.
			 * @param {Creature} target Rooted unit.
			 * @param {Effect} tendrils The tendril effect holding the unit.
			 * @return {void}
			 */
			_disableAbilityUpgrades: function (target: Creature, tendrils: Effect) {
				const suspended = target.abilities.filter((ability) => ability.isUpgraded());

				if (!suspended.length) {
					return;
				}

				const originals = suspended.map((ability) => ability.isUpgraded.bind(ability));

				const silence = () => {
					suspended.forEach((ability) => {
						ability.isUpgraded = () => false;
					});
				};

				const restore = () => {
					suspended.forEach((ability, index) => {
						ability.isUpgraded = originals[index];
					});
				};

				silence();

				target.addEffect(
					new Effect(
						'',
						this.creature,
						target,
						'onStartPhase',
						{
							effectFn: (effect: Effect) => {
								if (!tendrils.isDeleted) {
									// Still grasped: keep the upgrades silenced.
									silence();
									return;
								}

								restore();
								effect.deleteEffect();
							},
							deleteTrigger: '',
							turnLifetime: -1,
						},
						G,
					),
				);
			},
		},
	];
};
