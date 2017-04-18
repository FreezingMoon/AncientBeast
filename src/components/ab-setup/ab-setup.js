'use strict';

class AbSetup extends Polymer.Element {
	static get is() {
		return 'ab-setup';
	}

	static get properties() {
		return {
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

			var idx = Math.floor(Math.random() * locations.length - 1) + 1; // never want 0
			this.combatLocation = locations[idx].getAttribute('value');
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
