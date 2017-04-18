'use strict';

class AbSetup extends Polymer.Element {
	static get is() {
		return 'ab-setup';
	}

	static get properties() {
		return {
			options: {
				type: Object,
				value: function() {
					return {
						playerMode: [{
							title: '1 versus 1',
							value: 2,
						}, {
							title: '2 versus 2',
							value: 4,
						}],
						maxUnits: [1, 2, 3, 4, 5, 6, 7],
						dropsEnabled: [{
							title: 'On',
							value: 1
						}, {
							title: 'Off',
							value: 0
						}],
						upgradeRounds: [{
							title: 'Enabled',
							value: 0
						}, 1, 2, 3, 4, 5, {
							title: 'Disabled',
							value: -1
						}],
						maxPlasma: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110],
						turnTime: [20, 40, 60, 80, 99, {
							title: '&#8734;',
							value: -1
						}],
						timePool: [15, 20, 25, 30, {
							title: '&#8734;',
							value: -1
						}],
						combatLocation: [{
								title: 'Random place',
								value: 'random'
							},
							{
								value: 'Dark Forest'
							},
							{
								value: 'Frozen Skull'
							},
							{
								value: 'Shadow Cave'
							}
						]
					}
				}
			},
			playerMode: {
				type: Number,
				value: 2
			},
			maxUnits: {
				type: Number,
				value: 3
			},
			dropsEnabled: {
				type: Number,
				value: 1
			},
			upgradeRounds: {
				type: Number,
				value: 3
			},
			maxPlasma: {
				type: Number,
				value: 30
			},
			turnTime: {
				type: Number,
				value: -1
			},
			timePool: {
				type: Number,
				value: -1,
			},
			combatLocation: {
				type: String,
				value: 'random'
			}
		}
	}

	get gameConfig() {
		var locations = this.$.combatLocation.items;

		if (locations.length && this.combatLocation === 'random') {
			var idx = Math.floor(Math.random() * (locations.length - 1)) + 1; // never want 0
			this.combatLocation = locations[idx].value;
		}

		return {
			playerMode: this.playerMode,
			creaLimitNbr: this.maxUnits,
			unitDrops: this.dropsEnabled,
			abilityUpgrades: this.upgradeRounds,
			plasma_amount: this.maxPlasma,
			turnTimePool: this.turnTime,
			timePool: this.timePool * 60,
			background_image: this.combatLocation
		};
	}

	onTapStart(event) {
		console.log(this.gameConfig);
		this.dispatchEvent(new CustomEvent('ab-start', {
			detail: this.gameConfig,
			bubbles: true
		}));
	}
}

window.customElements.define(AbSetup.is, AbSetup);
