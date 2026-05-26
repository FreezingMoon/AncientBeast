import { UI } from './interface';
import { Fullscreen } from './fullscreen';

export class Hotkeys {
	ui: UI;
	constructor(ui: UI) {
		this.ui = ui;
	}

	pressQ() {
		if (this.ui.game.botController?.isBotTurn()) {
			return;
		}
		if (this.ui.dashopen) {
			this.ui.closeDash();
		} else {
			const result = this.ui.selectNextAbility();
			// If no usable ability was found, pulse the target-range circles — but
			// only when ALL active abilities have no valid targets (passiveUnavailable).
			// If there is still a usable ability (Q just deselected/wrapped), skip it.
			if (result === -1 || result === undefined) {
				this.ui.checkAbilities();
				const passiveAb = this.ui.game.activeCreature?.abilities[0];
				if (passiveAb?.message === this.ui.game.msg.abilities.passiveUnavailable) {
					this.ui.animateNoTargetAbilityRanges();
					this.ui.flashAbilityBtn(0);
				}
			}
		}
	}

	pressS(event) {
		if (
			!this.ui.$scoreboard.hasClass('hide') &&
			!event.shiftKey &&
			!event.ctrlKey &&
			!event.altKey &&
			!event.metaKey
		) {
			this.ui.btnSaveLog.triggerClick();
			return;
		}

		if (event.shiftKey) {
			this.ui.btnToggleScore.triggerClick();
		} else if (event.ctrlKey) {
			this.ui.game.gamelog.save();
		} else {
			if (this.ui.dashopen) {
				this.ui.gridSelectDown();
			} else {
				this.ui.btnSkipTurn.triggerClick();
			}
		}
	}

	pressT() {
		if (this.ui.dashopen) {
			this.ui.closeDash();
		} else {
			this.ui.btnToggleScore.triggerClick();
		}
	}

	pressD(event) {
		if (event.shiftKey) {
			this.ui.btnToggleDash.triggerClick();
		} else {
			if (this.ui.dashopen) {
				this.ui.gridSelectRight();
			} else {
				this.ui.btnDelay.triggerClick();
			}
		}
	}

	pressW() {
		if (this.ui.game.botController?.isBotTurn()) {
			return;
		}
		if (!this.ui.dashopen) {
			this.ui.flashAbilityBtn(1);
			this.ui.abilitiesButtons[1].triggerClick();
		} else {
			this.ui.gridSelectUp();
		}
	}

	pressE() {
		if (this.ui.game.botController?.isBotTurn()) {
			return;
		}
		if (!this.ui.dashopen) {
			this.ui.flashAbilityBtn(2);
			this.ui.abilitiesButtons[2].triggerClick();
		}
	}

	pressP(event) {
		if (event.metaKey && event.altKey && this.ui.canToggleMetaPowers()) {
			this.ui.game.signals.ui.dispatch('toggleMetaPowers');
		}
	}

	pressDigit(index: number) {
		if (index === 0) {
			// Reset powers
			if (this.ui.metaPowers) {
				this.ui.metaPowers._clearPowers();
			}
		} else if (index >= 1 && index <= 9) {
			// Enable power by index
			if (this.ui.metaPowers) {
				this.ui.metaPowers.enablePowerByIndex(index);
			}
		}
	}

	pressBackspace() {
		if (this.ui.canToggleMetaPowers()) {
			this.ui.game.signals.ui.dispatch('toggleMetaPowers');
		}
	}

	pressR(event?: KeyboardEvent) {
		if (
			!this.ui.$scoreboard.hasClass('hide') &&
			!event?.shiftKey &&
			!event?.ctrlKey &&
			!event?.metaKey &&
			!event?.altKey
		) {
			this.ui.btnRestartMatch.triggerClick();
			return;
		}

		if (event?.ctrlKey || event?.metaKey || event?.altKey) {
			return;
		}

		if (this.ui.game.botController?.isBotTurn()) {
			return;
		}
		if (!this.ui.dashopen) {
			this.ui.flashAbilityBtn(3);
			this.ui.abilitiesButtons[3].triggerClick();
		} else {
			this.ui.closeDash();
		}
	}

	pressA(event) {
		if (event.shiftKey) {
			this.ui.btnAudio.triggerClick();
		} else {
			if (this.ui.dashopen) {
				this.ui.gridSelectLeft();
			}
		}
	}

	pressF(event) {
		if (event.shiftKey) {
			this.ui.fullscreen.toggle();
		}
	}

	pressX(event) {
		if (event.shiftKey && event.ctrlKey) {
			this.ui.game.gamelog.save();
		} else {
			this.ui.btnExit.triggerClick();
		}
	}
	pressTab(event) {
		event.preventDefault();
		if (this.ui.dashopen) {
			if (event.shiftKey) this.ui.gridSelectPrevious();
			else this.ui.gridSelectNext();
		} else if (event.shiftKey) {
			this.ui.brandlogo.alpha = 0;
			this.ui.selectPreviousAbility();
		} else {
			this.ui.selectNextAbility();
		}
	}

	pressArrowUp() {
		if (this.ui.dashopen) {
			this.ui.gridSelectUp();
		} else {
			this.ui.game.grid.selectHexUp();
		}
	}

	pressArrowDown() {
		if (this.ui.dashopen) {
			this.ui.gridSelectDown();
		} else {
			this.ui.game.grid.selectHexDown();
		}
	}

	pressArrowLeft() {
		if (this.ui.dashopen) {
			this.ui.gridSelectLeft();
		} else {
			this.ui.game.grid.selectHexLeft();
		}
	}

	pressArrowRight() {
		if (this.ui.dashopen) {
			this.ui.gridSelectRight();
		} else {
			this.ui.game.grid.selectHexRight();
		}
	}

	pressBacktick() {
		this.ui.chat.toggle();
	}

	pressEnter() {
		if (this.ui.dashopen) {
			this.ui.materializeButton.triggerClick();
		} else {
			this.ui.game.grid.confirmHex();
		}
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

		// Check if we were in fullscreen mode and update button state accordingly
		setTimeout(() => {
			if (this.ui.fullscreen) {
				this.ui.fullscreen.updateButtonState();
			}
		}, 100);

		this.ui.game.signals.ui.dispatch('closeInterfaceScreens');
	}

	pressShiftKeyDown(_event) {
		if (!this.ui.dashopen) {
			this.ui.brandlogo.alpha = 1;
			this.ui.game.grid.showGrid(true);
			this.ui.game.grid.showCurrentCreatureMovementInOverlay(this.ui.game.activeCreature);
		}
	}

	pressShiftKeyUp() {
		if (!this.ui.dashopen) {
			this.ui.brandlogo.alpha = 0;
			this.ui.game.grid.showGrid(false);
			this.ui.game.grid.allhexes.forEach((hex) => {
				hex.cleanOverlayVisualState();
			});
			this.ui.game.grid.redoLastQuery();
		}
	}
	pressControlKeyDown() {
		this.ui.brandlogo.alpha = 0;
	}

	pressControlKeyUp() {
		this.ui.brandlogo.alpha = 0;
	}

	pressSpace() {
		if (this.ui.dashopen) {
			this.ui.materializeButton.triggerClick();
		} else {
			this.ui.game.grid.confirmHex();
		}
	}

	pressF11(event) {
		event.preventDefault();
		const fullscreen = new Fullscreen(document.getElementById('fullscreen'));

		fullscreen.toggle();
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
			onkeydown(event) {
				hk.pressR(event);
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
		Tab: {
			onkeydown(event) {
				hk.pressTab(event);
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
		Backquote: {
			onkeydown() {
				hk.pressBacktick();
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
		ControlLeft: {
			onkeydown() {
				hk.pressControlKeyDown();
			},
			onkeyup() {
				hk.pressControlKeyUp();
			},
		},
		ControlRight: {
			onkeydown() {
				hk.pressControlKeyDown();
			},
			onkeyup() {
				hk.pressControlKeyUp();
			},
		},
		Space: {
			onkeydown() {
				hk.pressSpace();
			},
		},
		F11: {
			onkeydown(event) {
				hk.pressF11(event);
			},
		},
		Digit0: {
			onkeydown() {
				hk.pressDigit(0);
			},
		},
		Digit1: {
			onkeydown() {
				hk.pressDigit(1);
			},
		},
		Digit2: {
			onkeydown() {
				hk.pressDigit(2);
			},
		},
		Digit3: {
			onkeydown() {
				hk.pressDigit(3);
			},
		},
		Digit4: {
			onkeydown() {
				hk.pressDigit(4);
			},
		},
		Digit5: {
			onkeydown() {
				hk.pressDigit(5);
			},
		},
		Digit6: {
			onkeydown() {
				hk.pressDigit(6);
			},
		},
		Digit7: {
			onkeydown() {
				hk.pressDigit(7);
			},
		},
		Digit8: {
			onkeydown() {
				hk.pressDigit(8);
			},
		},
		Digit9: {
			onkeydown() {
				hk.pressDigit(9);
			},
		},
		Backspace: {
			onkeydown() {
				hk.pressBackspace();
			},
		},
	};
	return hotkeys;
}
