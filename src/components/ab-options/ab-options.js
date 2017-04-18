'use strict';

class AbOptions extends Polymer.Element {
	static get is() {
		return 'ab-options';
	}

	static get properties() {
		return {
			items: {
				type: Array,
				value: function() {
					return [];
				},
				notify: true
			},
			attrForItemTitle: {
				type: String,
				value: 'title'
			},
			attrForSelected: {
				type: String,
				value: 'value'
			},
			attrForItemValue: {
				type: String,
				value: 'value'
			},
			selected: {
				notify: true,
			},
			title: String,
			tooltip: String,
		}
	}
	_attrForItemValue(item) {
		if (typeof item === 'object') {
			return typeof item[this.attrForItemValue] !== 'undefined' ? item[this.attrForItemValue] : '';
		}

		return item;
	}

	_attrForItemTitle(item) {
		if (typeof item === 'object') {
			return typeof item[this.attrForItemTitle] !== 'undefined' ? item[this.attrForItemTitle] : typeof item[this.attrForItemValue] !== 'undefined' ? item[this.attrForItemValue] : '';
		}

		return item;
	}
}

window.customElements.define(AbOptions.is, AbOptions);
