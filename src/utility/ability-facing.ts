/**
 * `Ability.animation2()` turns the caster to face its target before playing the
 * cast animation. That is right for an attack, but wrong for abilities that
 * reach out to a unit already beside the caster: the caster spins on the spot,
 * and for a multi-hex creature a target on a frontal diagonal hex can even read
 * as being behind it, so it turns its back on the ally it is helping.
 *
 * An ability opts out by declaring `_facesTarget: false`.
 */
export type FacingAwareAbility = {
	_facesTarget?: boolean;
};

/**
 * Whether an ability should re-orient its caster towards the target.
 *
 * Facing is the default; only an explicit `false` opts out, so abilities that
 * say nothing keep the behaviour they have always had.
 */
export function shouldFaceTargetDuringCast(ability: FacingAwareAbility): boolean {
	return ability._facesTarget !== false;
}
