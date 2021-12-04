import * as $j from 'jquery';
import { Button } from './button';

/**
 * TODO: open and close with hotkey
 */
export class GodMode {
	constructor(game) {
		this.game = game;

		this.state = {
			executeMonster: false,
			unlimitedAbilityUses: false,
		};

		this.$els = {
			executeMonsterButton: $j('#execute-monster-button'),
			unlimitedAbilityUsesButton: $j('#unlimited-ability-uses-button'),
		};

		this.btnExecuteMonster = new Button(
			{
				$button: this.$els.executeMonsterButton,
				click: () => this.toggleExecuteMonster(),
			},
			game,
		);
		this.btnUnlimitedAbilityUses = new Button(
			{
				$button: this.$els.unlimitedAbilityUsesButton,
				click: () => this.toggleUnlimitedAbilityUses(),
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

		this.game.signals.ui.dispatch('toggleExecuteMonster', executeMonster);
	}

	toggleUnlimitedAbilityUses() {
		const unlimitedAbilityUses = !this.state.unlimitedAbilityUses;

		this.state = {
			...this.state,
			unlimitedAbilityUses,
		};

		this.btnUnlimitedAbilityUses.changeState(unlimitedAbilityUses ? 'glowing' : 'normal');

		// Trying a simpler non-event approach.
		// this.game.signals.ui.dispatch('toggleExecuteMonster', executeMonster);
	}
}
