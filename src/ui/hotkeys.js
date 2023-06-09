export class Hotkeys {
	constructor(ui) {
		this.ui = ui;
	}

	pressQ() {
		this.ui.dashopen ? this.ui.closeDash() : this.ui.selectNextAbility();
	}

	pressS(event) {
		if (event.shiftKey) {
			this.ui.btnToggleScore.triggerClick();
		} else if (event.ctrlKey) {
			this.ui.game.gamelog.save();
		} else {
			this.ui.dashopen ? this.ui.gridSelectDown() : this.ui.btnSkipTurn.triggerClick();
		}
	}

	pressT() {
		this.ui.dashopen ? this.ui.closeDash() : this.ui.btnToggleScore.triggerClick();
	}

	pressD(event) {
		if (event.shiftKey) {
			this.ui.btnToggleDash.triggerClick();
		} else {
			this.ui.dashopen ? this.ui.gridSelectRight() : this.ui.btnDelay.triggerClick();
		}
	}

	pressW() {
		this.ui.dashopen ? this.ui.gridSelectUp() : this.ui.abilitiesButtons[1].triggerClick();
	}

	pressE() {
		!this.ui.dashopen && this.ui.abilitiesButtons[2].triggerClick();
	}

	pressP(event) {
		if (event.metaKey && event.altKey) {
			this.ui.game.signals.ui.dispatch('toggleMetaPowers');
		}
	}

	pressR() {
		this.ui.dashopen ? this.ui.closeDash() : this.ui.abilitiesButtons[3].triggerClick();
	}

	pressA(event) {
		if (event.shiftKey) {
			this.ui.btnAudio.triggerClick();
		} else {
			this.ui.dashopen && this.ui.gridSelectLeft();
		}
	}

	pressF(event) {
		if (event.shiftKey) {
			this.ui.fullscreen.toggle();
		} else {
			this.ui.btnFlee.triggerClick();
		}
	}

	pressX(event) {
		if (event.shiftKey && event.ctrlKey) {
			this.ui.game.gamelog.save();
		} else {
			this.ui.btnExit.triggerClick();
		}
	}

	pressArrowUp() {
		this.ui.dashopen ? this.ui.gridSelectUp() : this.ui.game.grid.selectHexUp();
	}

	pressArrowDown() {
		this.ui.dashopen ? this.ui.gridSelectDown() : this.ui.game.grid.selectHexDown();
	}

	pressArrowLeft() {
		this.ui.dashopen ? this.ui.gridSelectLeft() : this.ui.game.grid.selectHexLeft();
	}

	pressArrowRight() {
		this.ui.dashopen ? this.ui.gridSelectRight() : this.ui.game.grid.selectHexRight();
	}

	pressEnter() {
		this.ui.dashopen ? this.ui.materializeButton.triggerClick() : this.ui.chat.toggle();
	}

	pressEscape() {
		const isAbilityActive =
			this.ui.activeAbility && this.ui.$scoreboard.hasClass('hide') && !this.ui.chat.isOpen;

		if (isAbilityActive) {
			/* Check to see if dash view or chat are open first before
			 * canceling the active ability when using Esc hotkey
			 */
			this.ui.game.activeCreature.queryMove();
			this.ui.selectAbility(-1);
		}

		this.ui.game.signals.ui.dispatch('closeInterfaceScreens');
	}

	pressShiftKeyDown() {
		this.ui.game.grid.showGrid(true);
		this.ui.game.grid.showCurrentCreatureMovementInOverlay(this.ui.game.activeCreature);
	}

	pressShiftKeyUp() {
		this.ui.game.grid.showGrid(false);
		this.ui.game.grid.cleanOverlay();
		this.ui.game.grid.redoLastQuery();
	}

	pressSpace() {
		!this.ui.dashopen && this.ui.game.grid.confirmHex();
	}
}
export function getHotKeys(hk) {
	const hotkeys = {
		KeyS: {
			onkeydown(event) {
				hk.pressS(event);
			},
		},
		KeyT: {
			onkeydown() {
				hk.pressT();
			},
		},
		KeyD: {
			onkeydown(event) {
				hk.pressD(event);
			},
		},
		KeyQ: {
			onkeydown() {
				hk.pressQ();
			},
		},
		KeyW: {
			onkeydown() {
				hk.pressW();
			},
		},
		KeyE: {
			onkeydown() {
				hk.pressE();
			},
		},
		KeyP: {
			onkeydown(event) {
				hk.pressP(event);
			},
		},
		KeyR: {
			onkeydown() {
				hk.pressR();
			},
		},
		KeyA: {
			onkeydown(event) {
				hk.pressA(event);
			},
		},
		KeyF: {
			onkeydown(event) {
				hk.pressF(event);
			},
		},
		KeyX: {
			onkeydown(event) {
				hk.pressX(event);
			},
		},
		ArrowUp: {
			onkeydown() {
				hk.pressArrowUp();
			},
		},
		ArrowDown: {
			onkeydown() {
				hk.pressArrowDown();
			},
		},
		ArrowLeft: {
			onkeydown() {
				hk.pressArrowLeft();
			},
		},
		ArrowRight: {
			onkeydown() {
				hk.pressArrowRight();
			},
		},
		Enter: {
			onkeydown() {
				hk.pressEnter();
			},
		},
		Escape: {
			onkeydown() {
				hk.pressEscape();
			},
		},
		ShiftLeft: {
			onkeydown() {
				hk.pressShiftKeyDown();
			},
			onkeyup() {
				hk.pressShiftKeyUp();
			},
		},
		ShiftRight: {
			onkeydown() {
				hk.pressShiftKeyDown();
			},
			onkeyup() {
				hk.pressShiftKeyUp();
			},
		},
		Space: {
			onkeydown() {
				hk.pressSpace();
			},
		},
	};
	return hotkeys;
}
