import { Damage } from '../damage';
import { Effect } from '../effect';
import type Game from '../game';
import type { Creature } from '../creature';
import { attachContagionVisual } from '../vfx/contagion';
import { SnapshotCompatibilityError } from '../engine/GameSnapshot';
import {
	CONTAGION_EFFECT_BEHAVIOR,
	CONTAGION_END_PHASE_BEHAVIOR,
} from '../engine/contagionSnapshotBehaviors';

type ContagionEffect = Effect & {
	contagionDamage: number;
	contagionAttacker: Creature;
	upgraded: boolean;
	contagious: boolean;
	contagionVisual: ReturnType<typeof attachContagionVisual>;
	_contagionDeleteBound?: boolean;
};

type ContagionSnapshotData = {
	infectedId: number;
	attackerId: number;
	damage: number;
	upgraded: boolean;
	contagious: boolean;
	endTurnEffectId: number;
};

type ContagionEndPhaseSnapshotData = {
	contagionEffectId: number;
};

function hasPlasmaBarrier(creature: Creature): boolean {
	return creature.hasActivePlasmaShield();
}

function getContagionSnapshotData(
	game: Game,
	data: Record<string, unknown> | undefined,
	references?: { infected: Creature; attacker: Creature },
): { infected: Creature; attacker: Creature; snapshotData: ContagionSnapshotData } {
	const candidate = data as Partial<ContagionSnapshotData> | undefined;
	const infected =
		references?.infected ??
		(Number.isInteger(candidate?.infectedId) && game.creatures?.[candidate.infectedId as number]);
	const attacker =
		references?.attacker ??
		(Number.isInteger(candidate?.attackerId) && game.creatures?.[candidate.attackerId as number]);
	if (
		!infected ||
		!attacker ||
		typeof candidate?.damage !== 'number' ||
		!Number.isFinite(candidate.damage) ||
		typeof candidate.upgraded !== 'boolean' ||
		typeof candidate.contagious !== 'boolean' ||
		!Number.isInteger(candidate.endTurnEffectId)
	) {
		throw new SnapshotCompatibilityError('Cannot restore Contagion: effect data is invalid.');
	}
	return {
		infected,
		attacker,
		snapshotData: {
			infectedId: infected.id,
			attackerId: attacker.id,
			damage: candidate.damage,
			upgraded: candidate.upgraded,
			contagious: candidate.contagious,
			endTurnEffectId: candidate.endTurnEffectId as number,
		},
	};
}

function bindContagionEffect(
	game: Game,
	effect: Effect,
	data: Record<string, unknown> | undefined,
	references?: { infected: Creature; attacker: Creature },
): void {
	const { infected, attacker, snapshotData } = getContagionSnapshotData(game, data, references);
	const contagion = effect as ContagionEffect;
	contagion.contagionDamage = snapshotData.damage;
	contagion.contagionAttacker = attacker;
	contagion.upgraded = snapshotData.upgraded;
	contagion.contagious = snapshotData.contagious;
	contagion.contagionVisual = attachContagionVisual(game, infected);
	if (contagion.contagious) contagion.contagionVisual.setContagious();
	contagion.snapshotBehaviorId = CONTAGION_EFFECT_BEHAVIOR;
	contagion.snapshotBehaviorData = snapshotData;
	contagion.effectFn = (_effect, event) => {
		if (event === infected) {
			if (!contagion.contagious) {
				contagion.contagious = true;
				snapshotData.contagious = true;
				contagion.snapshotBehaviorData = { ...snapshotData };
				contagion.contagionVisual.setContagious();
				game.log(`%CreatureName${infected.id}% has become extremely contagious`);
				infected.hint('Contagious', 'msg_effects');
				if (contagion.upgraded) {
					const result = infected.takeDamage(
						new Damage(attacker, { poison: contagion.contagionDamage }, 1, [], game),
					);
					if (result.kill || infected.dead) return;
				}
				for (const hex of infected.adjacentHexes(1)) {
					spreadTo(hex.creature);
				}
			}
			return;
		}

		if (!contagion.contagious) return;

		const steppedCreature = (event as { creature?: Creature } | undefined)?.creature;
		const candidates =
			steppedCreature === infected
				? infected.adjacentHexes(1).map((hex) => hex.creature)
				: [steppedCreature];
		for (const candidate of candidates) spreadTo(candidate);
	};

	if (!contagion._contagionDeleteBound) {
		const deleteEffect = contagion.deleteEffect.bind(contagion);
		contagion.deleteEffect = () => {
			contagion.contagionVisual.remove();
			const endTurnEffect = game.effects.find(
				(candidate) => candidate.id === snapshotData.endTurnEffectId,
			);
			if (!endTurnEffect) {
				throw new SnapshotCompatibilityError(
					'Cannot remove Contagion: linked end-phase effect is missing.',
				);
			}
			endTurnEffect.deleteEffect();
			deleteEffect();
		};
		contagion._contagionDeleteBound = true;
	}

	function spreadTo(candidate: Creature | undefined): void {
		if (
			!contagion.contagious ||
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

		addInfected(
			game,
			candidate,
			contagion.contagionAttacker,
			contagion.contagionDamage,
			contagion.upgraded,
		);
	}
}

function bindContagionEndPhaseEffect(
	game: Game,
	endTurnEffect: Effect,
	data: Record<string, unknown> | undefined,
): void {
	const candidate = data as Partial<ContagionEndPhaseSnapshotData> | undefined;
	if (!Number.isInteger(candidate?.contagionEffectId)) {
		throw new SnapshotCompatibilityError(
			'Cannot restore Contagion: linked effect data is invalid.',
		);
	}
	const contagionEffectId = candidate.contagionEffectId as number;
	endTurnEffect.snapshotBehaviorId = CONTAGION_END_PHASE_BEHAVIOR;
	endTurnEffect.snapshotBehaviorData = { contagionEffectId };
	endTurnEffect.effectFn = () => {
		const effect = game.effects.find((current) => current.id === contagionEffectId) as
			| ContagionEffect
			| undefined;
		if (!effect || effect.name !== 'Contagion') {
			throw new SnapshotCompatibilityError(
				'Cannot resolve Contagion end phase: infection effect is missing.',
			);
		}
		if (!effect.contagious) return;

		const infected = effect.target as Creature;
		infected.takeDamage(
			new Damage(effect.contagionAttacker, { poison: effect.contagionDamage }, 1, [], game),
		);
		effect.deleteEffect();
	};
}

export function registerContagionSnapshotBehaviors(game: Game): void {
	game.registerSnapshotEffectBehavior(CONTAGION_EFFECT_BEHAVIOR, (effect, data) =>
		bindContagionEffect(game, effect, data),
	);
	game.registerSnapshotEffectBehavior(CONTAGION_END_PHASE_BEHAVIOR, (effect, data) =>
		bindContagionEndPhaseEffect(game, effect, data),
	);
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
	bindContagionEffect(
		game,
		effect,
		{
			infectedId: infected.id,
			attackerId: attacker.id,
			damage,
			upgraded,
			contagious: false,
			endTurnEffectId: endTurnEffect.id,
		},
		{ infected, attacker },
	);
	bindContagionEndPhaseEffect(game, endTurnEffect, { contagionEffectId: effect.id });

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
