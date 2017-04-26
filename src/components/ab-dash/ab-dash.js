'use strict';

class AbDash extends Polymer.Element {
	static get is() {
		return 'ab-dash';
	}

	static get properties() {
		return {
			player: {
				type: Array,
				value() {
					return [];
				}
			},
			visible: {
				type: String,
				value: "visible"
			}
		}
	}
	hideDash() {
		document.querySelector('ab-dash').hide();
	}
}

window.customElements.define(AbDash.is, AbDash);