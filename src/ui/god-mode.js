import * as $j from 'jquery';
import { Button } from './button';

/**
 *
 */
export class GodMode {
	constructor(game) {
		this.game = game;

		this.state = {
			executeMonster: false,
		};

		this.$els = {
			executeMonsterButton: $j('#execute-monster-button'),
		};

		this.btnExecuteMonster = new Button(
			{
				$button: this.$els.executeMonsterButton,
				click: () => this.toggleExecuteMonster(),
			},
			game,
		);
	}

	toggleExecuteMonster() {
		const executeMonster = !this.state.executeMonster;

		this.state = {
			...this.state,
			executeMonster,
		};

		this.btnExecuteMonster.changeState(executeMonster ? 'glowing' : 'normal');

		// this.$els.executeMonsterButton.toggleClass('activated', executeMonster);

		// How to notify to the monster display UI to show a cross on hover?
		// And override existing click handlers? I think this has to live in whatever
		// code currently exists to display creatures.

		this.game.signals.ui.dispatch('toggleExecuteMonster', executeMonster);

		// if (this.state.executeMonster) {
		// }
	}
}
