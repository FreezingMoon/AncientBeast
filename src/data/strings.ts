// TODO: Support translations
// https://github.com/FreezingMoon/AncientBeast/issues/923

export const strings = {
	abilities: {
		noTarget: 'No targets available.',
		noPlasma: 'Not enough plasma.',
		noPsy: 'Psyhelm overload: too many units!',
		alreadyUsed: 'This ability has already been used.',
		tooMuch: 'Too much %stat%.',
		notEnough: 'Not enough %stat%.',
		notMoveable: 'This creature cannot be moved.',
		passiveCycle: 'Switches between any usable abilities.',
		passiveUnavailable: 'No usable abilities to switch to.',
	},
	ui: {
		dash: {
			materializeOverload: 'Overload! Maximum number of units controlled',
			selectUnit: 'Please select an available unit from the left grid',
			lowPlasma: 'Low Plasma! Cannot materialize the selected unit',
			// plasmaCost :    String :    plasma cost of the unit to materialize
			materializeUnit: (plasmaCost: string) => {
				return 'Materialize unit at target location for ' + plasmaCost + ' plasma';
			},
			materializeUsed: 'Materialization has already been used this round',
			heavyDev: 'This unit is currently under heavy development',
		},
	},
} as const;
