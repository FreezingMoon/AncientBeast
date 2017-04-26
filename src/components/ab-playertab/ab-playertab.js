'use strict';

class AbPlayertab extends Polymer.Element {
	static get is() {
		return 'ab-playertab';
	}
	// static get properties() {
	// 	return {
	// 		employees: {
	// 			type: Array,
	// 			value() {
	// 				return [
	// 					{ first: 'Bob', last: 'Smith' },
	// 					{ first: 'Sally', last: 'Johnson' },
	// 				];
	// 			}
	// 		}
	// 	}
	// }

	static get properties() {
		return {
			player: {
				type: Array,
				value() {
					return [];
				}
			},
		}
	}
}


window.customElements.define(AbPlayertab.is, AbPlayertab);
