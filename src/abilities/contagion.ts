import { Damage } from '../damage';
import { Effect } from '../effect';
import type Game from '../game';
import type { Creature } from '../creature';
import { attachContagionVisual } from '../vfx/contagion';

type ContagionEffect = Effect & {
	contagionDamage: number;
	contagionAttacker: Creature;
	upgraded: boolean;
	contagious: boolean;
	contagionVisual: ReturnType<typeof attachContagionVisual>;
};

function hasPlasmaBarrier(creature: Creature): boolean {
	return creature.hasActivePlasmaShield();
}

function addInfected(
	game: Game,
	infected: Creature,
	attacker: Creature,
	damage: number,
	upgraded: boolean,
): void {
	if (infected.dead || infected.effects.some((effect) => effect.name === 'Contagion')) return;

	const effect = new Effect(
		'Contagion',
		infected,
		infected,
		'onReset onStepIn onOtherStepIn',
		{
			turnLifetime: -1,
			deleteTrigger: '',
			deleteOnOwnerDeath: true,
			stackable: false,
			alterations: {},
		},
		game,
	) as ContagionEffect;
	effect.contagionDamage = damage;
	effect.contagionAttacker = attacker;
	effect.upgraded = upgraded;
	effect.contagious = false;
	effect.contagionVisual = attachContagionVisual(game, infected);

	const endTurnEffect = new Effect(
		'',
		infected,
		infected,
		'onEndPhase',
		{
			turnLifetime: -1,
			deleteTrigger: '',
			deleteOnOwnerDeath: true,
		},
		game,
	);
	const deleteEffect = effect.deleteEffect.bind(effect);
	effect.deleteEffect = () => {
		effect.contagionVisual.remove();
		endTurnEffect.deleteEffect();
		deleteEffect();
	};

	endTurnEffect.effectFn = () => {
		if (!effect.contagious) return;

		infected.takeDamage(
			new Damage(effect.contagionAttacker, { poison: effect.contagionDamage }, 1, [], game),
		);
		effect.deleteEffect();
	};

	effect.effectFn = (_effect, event) => {
		if (event === infected) {
			if (!effect.contagious) {
				effect.contagious = true;
				effect.contagionVisual.setContagious();
				game.log(`%CreatureName${infected.id}% has become extremely contagious`);
				infected.hint('Contagious', 'msg_effects');
				if (effect.upgraded) {
					const result = infected.takeDamage(
						new Damage(effect.contagionAttacker, { poison: effect.contagionDamage }, 1, [], game),
					);
					if (result.kill || infected.dead) return;
				}
				for (const hex of infected.adjacentHexes(1)) {
					spreadTo(hex.creature);
				}
			}
			return;
		}

		if (!effect.contagious) return;

		const steppedCreature = (event as { creature?: Creature } | undefined)?.creature;
		const candidates =
			steppedCreature === infected
				? infected.adjacentHexes(1).map((hex) => hex.creature)
				: [steppedCreature];
		for (const candidate of candidates) spreadTo(candidate);
	};

	function spreadTo(candidate: Creature | undefined): void {
		if (
			!effect.contagious ||
			infected.dead ||
			!candidate ||
			candidate === infected ||
			candidate.dead ||
			hasPlasmaBarrier(candidate) ||
			!infected.adjacentHexes(1).some((hex) => hex.creature === candidate) ||
			candidate.effects.some((current) => current.name === 'Contagion')
		) {
			return;
		}

		addInfected(game, candidate, effect.contagionAttacker, effect.contagionDamage, effect.upgraded);
	}

	infected.addEffect(effect, `%CreatureName${infected.id}% has been infected`, 'Infected');
	infected.addEffect(endTurnEffect, undefined, undefined, true, true);
}

export function applyGooContagion(
	game: Game,
	carrier: Creature,
	attacker: Creature,
	damage: number,
	upgraded: boolean,
): void {
	addInfected(game, carrier, attacker, damage, upgraded);
}
