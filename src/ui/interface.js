import * as $j from 'jquery';
import * as time from '../utility/time';
import * as emoji from 'node-emoji';
import { Hotkeys, getHotKeys } from './hotkeys';

import { Button, ButtonStateEnum } from './button';
import { Chat } from './chat';
import { Creature } from '../creature';
import { Fullscreen } from './fullscreen';
import { ProgressBar } from './progressbar';
import { getUrl } from '../assets';
import { MetaPowers } from './meta-powers';
import { Queue } from './queue';
import { QuickInfo } from './quickinfo';
import { pretty as version } from '../utility/version';

import { capitalize } from '../utility/string';
import { throttle } from 'underscore';
import { DEBUG_DISABLE_HOTKEYS } from '../debug';

/**
 * Class UI
 *
 * Object containing UI DOM element, update functions and event management on UI.
 */
export class UI {
	/* Attributes
	 *
	 * NOTE : attributes and variables starting with $ are jquery element
	 * and jquery function can be called directly from them.
	 *
	 * $display :		UI container
	 * $queue :		Queue container
	 * $textbox :		Chat and log container
	 * $activebox :	Current active creature panel (left panel) container
	 * $dash :			Overview container
	 * $grid :			Creature grid container
	 *
	 * selectedCreature :	String :	ID of the visible creature card
	 * selectedPlayer :	Integer :	ID of the selected player in the dash
	 *
	 */

	/**
	 * Create attributes and default buttons
	 * @constructor
	 */
	constructor(configuration, game) {
		this.configuration = configuration;
		this.game = game;
		this.fullscreen = new Fullscreen(
			document.querySelector('#fullscreen.button'),
			game.fullscreenMode,
		);
		this.$display = $j('#ui');
		this.$dash = $j('#dash');
		this.$grid = $j(this.#makeCreatureGrid(document.getElementById('creaturerasterwrapper')));
		this.$activebox = $j('#activebox');
		this.$scoreboard = $j('#scoreboard');
		this.active = false;

		this.queue = UI.#getQueue(this, document.getElementById('queuewrapper'));
		this.quickInfo = UI.#getQuickInfo(this, document.querySelector('div.quickinfowrapper'));

		// Last clicked creature in Godlet Printer for the current turn
		this.lastViewedCreature = '';

		// Last viewed creature for the current turn
		this.viewedCreature = '';

		// Chat
		this.chat = new Chat(game);

		// Meta Powers - only available for hot-seat games running in development mode.
		if (process.env.NODE_ENV === 'development' && !this.game.multiplayer) {
			this.metaPowers = new MetaPowers(this.game);
		}

		// Buttons Objects
		this.buttons = [];
		this.abilitiesButtons = [];

		// Dash Button
		this.btnToggleDash = new Button(
			{
				$button: $j('.toggledash'),
				hasShortcut: true,
				click: () => {
					this.game.signals.ui.dispatch('toggleDash');
				},
				overridefreeze: true,
			},
			{ isAcceptingInput: () => this.interfaceAPI.isAcceptingInput },
		);
		this.buttons.push(this.btnToggleDash);

		// Score Button
		this.btnToggleScore = new Button(
			{
				$button: $j('.togglescore'),
				hasShortcut: true,
				click: () => {
					this.game.signals.ui.dispatch('toggleScore');
				},
				overridefreeze: true,
			},
			{ isAcceptingInput: () => this.interfaceAPI.isAcceptingInput },
		);

		// In-Game Fullscreen Button
		this.btnFullscreen = new Button(
			{
				$button: $j('#fullscreen.button'),
				hasShortcut: true,
				click: () => this.fullscreen.toggle(),
				overridefreeze: true,
			},
			{ isAcceptingInput: () => this.interfaceAPI.isAcceptingInput },
		);
		this.buttons.push(this.btnFullscreen);

		// Audio Button
		this.btnAudio = new Button(
			{
				$button: $j('.toggle-music-player'),
				hasShortcut: true,
				click: () => {
					this.game.signals.ui.dispatch('toggleMusicPlayer');
				},
				overridefreeze: true,
			},
			{ isAcceptingInput: () => this.interfaceAPI.isAcceptingInput },
		);
		this.buttons.push(this.btnAudio);

		// Skip Turn Button
		this.btnSkipTurn = new Button(
			{
				$button: $j('#skip.button'),
				hasShortcut: true,
				click: () => {
					if (!this.dashopen) {
						if (game.turnThrottle) {
							return;
						}

						game.gamelog.add({
							action: 'skip',
						});

						// Prevents upgrade animation from carrying on into opponent's turn and disabling their button
						clearTimeout(this.animationUpgradeTimeOutID);

						game.skipTurn();
						this.lastViewedCreature = '';
						this.queryUnit = '';
					}
				},
			},
			{ isAcceptingInput: () => this.interfaceAPI.isAcceptingInput },
		);
		this.buttons.push(this.btnSkipTurn);

		// Delay Unit Button
		this.btnDelay = new Button(
			{
				$button: $j('#delay.button'),
				hasShortcut: true,
				click: () => {
					if (!this.dashopen) {
						if (game.turnThrottle || !game.activeCreature?.canWait || game.queue.isCurrentEmpty()) {
							return;
						}

						game.gamelog.add({
							action: 'delay',
						});
						game.delayCreature();
					}
				},
			},
			{ isAcceptingInput: () => this.interfaceAPI.isAcceptingInput },
		);
		this.buttons.push(this.btnDelay);

		// Flee Match Button
		this.btnFlee = new Button(
			{
				$button: $j('#flee.button'),
				hasShortcut: true,
				click: () => {
					if (!this.dashopen) {
						if (game.turn < game.minimumTurnBeforeFleeing) {
							alert(
								`You cannot flee the match in the first ${game.minimumTurnBeforeFleeing} rounds.`,
							);
							return;
						}

						if (game.activeCreature.player.isLeader()) {
							alert('You cannot flee the match while being in lead.');
							return;
						}

						if (window.confirm('Are you sure you want to flee the match?')) {
							game.gamelog.add({
								action: 'flee',
							});
							game.activeCreature.player.flee();
						}
					}
				},
				state: ButtonStateEnum.disabled,
			},
			{ isAcceptingInput: () => this.interfaceAPI.isAcceptingInput },
		);
		this.buttons.push(this.btnFlee);

		this.btnExit = new Button(
			{
				$button: $j('#exit.button'),
				hasShortcut: true,
				click: () => {
					if (this.dashopen) {
						return;
					}
					game.gamelog.add({
						action: 'exit',
					});
					game.resetGame();
				},
				state: ButtonStateEnum.normal,
			},
			{ isAcceptingInput: () => this.interfaceAPI.isAcceptingInput },
		);
		this.buttons.push(this.btnExit);

		this.materializeButton = new Button(
			{
				$button: $j('#materialize_button'),
				css: {
					disabled: {
						cursor: 'not-allowed',
					},
					glowing: {
						cursor: 'pointer',
					},
					selected: {},
					active: {},
					noclick: {},
					normal: {
						cursor: 'default',
					},
					slideIn: {},
				},
			},
			{ isAcceptingInput: () => this.interfaceAPI.isAcceptingInput },
		);

		// Defines states for ability buttons
		for (let i = 0; i < 4; i++) {
			const b = new Button(
				{
					$button: $j('.ability[ability="' + i + '"]'),
					hasShortcut: true,
					click: () => {
						const game = this.game;
						if (this.selectedAbility != i) {
							if (this.dashopen) {
								return false;
							}

							const ability = game.activeCreature.abilities[i];
							// Passive ability icon can cycle between usable abilities
							if (i == 0) {
								const selectedAbility = this.selectNextAbility();
								if (selectedAbility > 0) {
									b.cssTransition('nextIcon', 1000);
								}
								return;
							}
							// Colored frame around selected ability
							if (ability.require() == true && i != 0) {
								this.selectAbility(i);
							}
							// Activate Ability
							game.activeCreature.abilities[i].use();
						} else {
							// Cancel Ability
							this.closeDash();
							game.activeCreature.queryMove();
							this.selectAbility(-1);
						}
					},
					mouseover: () => {
						if (this.selectedAbility == -1) {
							this.showAbilityCosts(i);
						}

						(function () {
							const $desc = $j('.desc[ability="' + i + '"]');

							// Ensure tooltip stays in window - adjust
							var rect = $desc[0].getBoundingClientRect();
							const margin = 20;
							if (rect.bottom > window.innerHeight - margin) {
								const value = window.innerHeight - rect.bottom - margin;
								$desc[0].style.top = value + 'px';
								$desc.find('.arrow')[0].style.top = 27 - value + 'px'; // Keep arrow position
							}
						})();
					},
					mouseleave: () => {
						if (this.selectedAbility == -1) {
							this.hideAbilityCosts();
						}
						(function () {
							const $desc = $j('.desc[ability="' + i + '"]');
							$desc[0].style.top = '0px';
							$desc.find('.arrow')[0].style.top = '27px';
						})();
					},
					abilityId: i,
					css: {
						disabled: {
							cursor: 'help',
						},
						glowing: {
							cursor: 'pointer',
						},
						selected: {},
						active: {},
						noclick: {
							cursor: 'help',
						},
						normal: {
							cursor: 'default',
						},
						slideIn: {
							cursor: 'pointer',
						},
					},
				},
				{ isAcceptingInput: () => this.interfaceAPI.isAcceptingInput },
			);
			this.buttons.push(b);
			this.abilitiesButtons.push(b);
		}

		// ProgressBar
		this.healthBar = new ProgressBar({
			$bar: $j('#leftpanel .progressbar .bar.healthbar'),
			color: 'red',
		});

		this.energyBar = new ProgressBar({
			$bar: $j('#leftpanel .progressbar .bar.energybar'),
			color: 'yellow',
		});

		this.timeBar = new ProgressBar({
			$bar: $j('#rightpanel .progressbar .timebar'),
			color: 'white',
		});

		this.poolBar = new ProgressBar({
			$bar: $j('#rightpanel .progressbar .poolbar'),
			color: 'grey',
		});

		// Sound Effects slider
		const slider = document.getElementById('sfx');
		slider.addEventListener('input', () => (game.soundsys.allEffectsMultiplier = slider.value));

		this.hotkeys = new Hotkeys(this);
		const ingameHotkeys = getHotKeys(this.hotkeys);

		// Remove hex grid if window loses focus
		$j(window).on('blur', () => {
			game.grid.showGrid(false);
		});

		// Binding Hotkeys
		if (!DEBUG_DISABLE_HOTKEYS) {
			$j(document).on('keydown', (e) => {
				if (game.freezedInput) {
					return;
				}

				const keydownAction = ingameHotkeys[e.code] && ingameHotkeys[e.code].onkeydown;

				if (keydownAction !== undefined) {
					keydownAction.call(this, e);

					e.preventDefault();
				}
			});

			$j(document).on('keyup', (e) => {
				if (game.freezedInput) {
					return;
				}

				const keyupAction = ingameHotkeys[e.code] && ingameHotkeys[e.code].onkeyup;

				if (keyupAction !== undefined) {
					keyupAction.call(this, e);

					e.preventDefault();
				}
			});
		}

		// Mouse Shortcut
		$j('#dash').on('mousedown', (e) => {
			if (game.freezedInput) {
				return;
			}

			switch (e.which) {
				case 1:
					// Left mouse button pressed
					break;
				case 2:
					// Middle mouse button pressed
					if (this.dashopen) {
						this.materializeButton.triggerClick();
					}
					break;
				case 3:
					// Right mouse button pressed
					if (this.dashopen) {
						this.closeDash();
					}
					break;
			}
		});

		// Mouse Shortcut
		$j('#musicplayerwrapper').on('mousedown', (e) => {
			if (game.freezedInput) {
				return;
			}
			switch (e.which) {
				case 1:
					// Left mouse button pressed
					break;
				case 2:
					// Middle mouse button pressed
					break;
				case 3:
					// Right mouse button pressed
					this.closeMusicPlayer();
					break;
			}
		});

		// Mouse Shortcut
		$j('#ui').on('mousedown', (e) => {
			if (game.freezedInput) {
				return;
			}
			switch (e.which) {
				case 1:
					// Left mouse button pressed
					break;
				case 2:
					// Middle mouse button pressed
					break;
				case 3:
					// Right mouse button pressed
					this.closeScoreboard();
					break;
			}
		});

		// Mouse Shortcut
		$j('#meta-powers').on('mousedown', (e) => {
			if (game.freezedInput) {
				return;
			}
			switch (e.which) {
				case 1:
					// Left mouse button pressed
					break;
				case 2:
					// Middle mouse button pressed
					break;
				case 3:
					// Right mouse button pressed
					this.metaPowers._closeModal();
					break;
			}
		});

		$j('#combatwrapper, #dash, #toppanel').on('wheel', (e) => {
			if (game.freezedInput) {
				return;
			}

			// Dash
			if (this.dashopen) {
				if (e.originalEvent.deltaY < 0) {
					// Wheel up
					this.gridSelectPrevious();
				} else if (e.originalEvent.deltaY > 0) {
					// Wheel down
					this.gridSelectNext();
				}
				// Abilities
			} else {
				if (e.originalEvent.deltaY < 0) {
					// Wheel up
					this.selectPreviousAbility();
					// TODO: Allow to cycle between the usable active abilities by pressing the passive one's icon
				} else if (e.originalEvent.deltaY > 0) {
					// Wheel down
					this.selectNextAbility();
				}
			}

			e.preventDefault();
		});

		this.$dash.find('.section.numbers .stat').on('mouseover', (event) => {
			const $section = $j(event.target).closest('.section');
			const which = $section.hasClass('stats') ? '.stats_desc' : '.masteries_desc';
			$j(which).addClass('shown');
		});

		this.$dash.find('.section.numbers .stat').on('mouseleave', (event) => {
			const $section = $j(event.target).closest('.section');
			const which = $section.hasClass('stats') ? '.stats_desc' : '.masteries_desc';

			$j(which).removeClass('shown');
		});

		this.$dash.children('#playertabswrapper').addClass('numplayer' + game.playerMode);

		this.selectedCreature = '';
		this.selectedPlayer = 0;
		this.selectedAbility = -1;

		this.queueAnimSpeed = 500; // ms
		this.dashAnimSpeed = 250; // ms

		this.materializeToggled = false;
		this.dashopen = false;

		this.glowInterval = setInterval(() => {
			const opa =
				0.5 +
				Math.floor(((1 + Math.sin(Math.floor(new Date() * Math.PI * 0.2) / 100)) / 4) * 100) / 100;
			const opaWeak = opa / 2;

			game.grid.allhexes.forEach((hex) => {
				if (hex.overlayClasses.match(/creature/)) {
					if (hex.overlayClasses.match(/selected|active/)) {
						if (hex.overlayClasses.match(/weakDmg/)) {
							hex.overlay.alpha = opaWeak;
							return;
						}

						hex.overlay.alpha = opa;
					}
				}
			});
		}, 10);

		if (game.turnTimePool) {
			$j('.turntime').text(time.getTimer(game.turnTimePool));
		}

		if (game.timePool) {
			$j('.timepool').text(time.getTimer(game.timePool));
		}

		this.confirmWindowUnload();

		$j('#tabwrapper a').removeAttr('href'); // Empty links

		this.btnExit.changeState(ButtonStateEnum.hidden);
		// Show UI
		this.$display.show();
		this.$dash.hide();

		// Events
		this.game.signals.ui.add(this._handleUiEvent, this);
	}

	/**
	 * Handle events on the "ui" channel.
	 *
	 * @param {string} message Event name.
	 * @param {object} payload Event payload.
	 */
	_handleUiEvent(message, payload) {
		if (message === 'toggleDash') {
			this.toggleDash();
			this.closeMusicPlayer();
			this.closeScoreboard();
		}

		if (message === 'toggleScore') {
			this.toggleScoreboard();
			this.closeDash();
			this.closeMusicPlayer();
		}

		if (message === 'toggleMusicPlayer') {
			this.toggleMusicPlayer();
			this.closeDash();
			this.closeScoreboard();
		}

		if (message === 'toggleMetaPowers') {
			this.closeDash();
			this.closeMusicPlayer();
			this.closeScoreboard();
		}

		if (message === 'closeInterfaceScreens') {
			this.closeDash();
			this.closeMusicPlayer();
			this.closeScoreboard();
		}
	}

	showAbilityCosts(abilityId) {
		const game = this.game,
			creature = game.activeCreature,
			ab = creature.abilities[abilityId];

		if (ab.costs !== undefined) {
			if (typeof ab.costs.energy == 'number') {
				const costsEnergy = ab.costs.energy + creature.stats.reqEnergy;
				this.energyBar.previewSize(costsEnergy / creature.stats.energy);
				this.energyBar.setAvailableStyle();

				if (costsEnergy > creature.energy) {
					// Indicate the minimum energy required for the hovered ability
					// if the requirement is not met
					this.energyBar.setSize(costsEnergy / creature.stats.energy);
					this.energyBar.previewSize(
						costsEnergy / creature.stats.energy - creature.energy / creature.stats.energy,
					);

					this.energyBar.setUnavailableStyle();
				}
			} else {
				this.energyBar.previewSize(0);
			}
			if (typeof ab.costs.health == 'number') {
				this.healthBar.previewSize(ab.costs.health / creature.stats.health);
			} else {
				this.healthBar.previewSize(0);
			}
		}
	}

	hideAbilityCosts() {
		const game = this.game,
			creature = game.activeCreature;
		// Reset energy bar to match actual energy value
		this.energyBar.setSize(creature.energy / creature.stats.energy);

		this.energyBar.previewSize(0);
		this.healthBar.previewSize(0);
	}

	selectPreviousAbility() {
		const game = this.game,
			b = this.selectedAbility == -1 ? 4 : this.selectedAbility;

		for (let i = b - 1; i > 0; i--) {
			const creature = game.activeCreature;

			if (creature.abilities[i].require() && !creature.abilities[i].used) {
				this.abilitiesButtons[i].triggerClick();
				return;
			}
		}

		game.activeCreature.queryMove();
	}

	/**
	 * Cycles to next available ability. Returns the ability number selected or -1 if deselected.
	 */
	selectNextAbility() {
		const game = this.game,
			b = this.selectedAbility == -1 ? 0 : this.selectedAbility;
		if (this.selectedAbility == 3) {
			game.activeCreature.queryMove();
			this.selectAbility(-1);
			return -1;
		}
		for (let i = b + 1; i < 4; i++) {
			const creature = game.activeCreature;

			if (creature.abilities[i].require() && !creature.abilities[i].used) {
				this.abilitiesButtons[i].triggerClick();
				return i;
			}
		}
	}

	resizeDash() {
		let zoom1 = $j('#cardwrapper').innerWidth() / $j('#card').outerWidth(),
			zoom2 =
				$j('#cardwrapper').innerHeight() /
				($j('#card').outerHeight() + $j('#materialize_button').outerHeight()),
			zoom = Math.min(zoom1, zoom2, 1);

		$j('#cardwrapper_inner').css({
			scale: zoom,
			left: ($j('#cardwrapper').innerWidth() - $j('#card').innerWidth() * zoom) / 2,
			position: 'absolute',
			margin: 0,
		});

		zoom1 = $j('#creaturerasterwrapper').innerWidth() / $j('#creatureraster').innerWidth();
		zoom2 = $j('#creaturerasterwrapper').innerHeight() / $j('#creatureraster').innerHeight();
		zoom = Math.min(zoom1, zoom2, 1);

		$j('#creatureraster').css({
			scale: zoom,
			left:
				($j('#creaturerasterwrapper').innerWidth() - $j('#creatureraster').innerWidth() * zoom) / 2,
			position: 'absolute',
			margin: 0,
		});
	}

	/**
	 * Query a creature in the available creatures of the active player.
	 *
	 * @param {string} creatureType Creature type
	 * @param {number} player Player ID
	 * @param {'emptyHex' | 'portrait' | 'grid'} clickMethod Method used to view creatures.
	 */
	showCreature(creatureType, player, clickMethod) {
		const game = this.game;

		if (!this.dashopen) {
			this.$dash.show().css('opacity', 0);
			this.$dash.transition(
				{
					opacity: 1,
				},
				this.dashAnimSpeed,
				'linear',
			);
		}

		this.dashopen = true;

		if (player === undefined) {
			player = game.activeCreature.player.id;
		}

		// Set dash active
		this.$dash.addClass('active');
		this.$dash.children('#tooltip').removeClass('active');
		this.$dash.children('#playertabswrapper').addClass('active');
		this.changePlayerTab(game.activeCreature.team);
		this.resizeDash();

		this.$dash
			.children('#playertabswrapper')
			.children('.playertabs')
			.off('click')
			.on('click', (e) => {
				if (game.freezedInput) {
					return;
				}
				this.showCreature('--', $j(e.currentTarget).attr('player') - 0);
			});

		// Update player info
		for (let i = game.players.length - 1; i >= 0; i--) {
			$j('#dash .playertabs.p' + i + ' .vignette').css(
				'background-image',
				`url("${game.players[i].avatar}")`,
			);
			$j('#dash .playertabs.p' + i + ' .name').text(game.players[i].name);
			$j('#dash .playertabs.p' + i + ' .plasma').text('Plasma ' + game.players[i].plasma);
			$j('#dash .playertabs.p' + i + ' .score').text('Score ' + game.players[i].getScore().total);
			$j('#dash .playertabs.p' + i + ' .units').text(
				'Units ' + game.players[i].getNbrOfCreatures() + ' / ' + game.creaLimitNbr,
			);
		}

		// Change to the player tab
		if (player != this.selectedPlayer) {
			this.changePlayerTab(player);
		}

		this.$grid
			.children('.vignette')
			.removeClass('active')
			.filter("[creature='" + creatureType + "']")
			.addClass('active');

		this.selectedCreature = creatureType;
		const stats = game.retrieveCreatureStats(creatureType);

		//function to add the name, realm, size etc of the current card in the menu
		function addCardCharacterInfo() {
			const name = stats.name;
			let type = stats.type;
			let set = stats.set;
			const no_of_hexes =
				stats.size === 1
					? '&#11041'
					: stats.size == 2
					? '&#11041 &#11041'
					: '&#11041 &#11041 &#11041';

			if (stats.level === '-' || stats.realm == '-') {
				type = '&#9734';
				$j('#card .sideA .type').addClass('star');
				set = '';
			} else {
				$j('#card .sideA .type').removeClass('star');
			}

			$j('#card .sideA .type').html(type);
			$j('#card .sideA .name').text(name);
			$j('#card .sideA .set').html(set);
			$j('#card .sideA .hexes').html(no_of_hexes);
		}

		// TODO card animation
		if (
			$j.inArray(creatureType, game.players[player].availableCreatures) > 0 ||
			creatureType == '--'
		) {
			// retrieve the selected unit
			this.selectedCreatureObj = undefined;
			game.players[player].creatures.forEach((creature) => {
				if (creature.type == creatureType) {
					this.selectedCreatureObj = creature;
				}
			});

			// Card A
			$j('#card .sideA').css({
				'background-image': `url('${getUrl('cards/margin')}'), url('${getUrl(
					'units/artwork/' + stats.name,
				)}')`,
			});
			$j('#card .sideA .section.info')
				.removeClass('sin- sinA sinE sinG sinL sinP sinS sinW')
				.addClass('sin' + stats.type.substring(0, 1));
			addCardCharacterInfo();

			// Card B
			$j('#card .sideB').css({
				'background-image': `url('${getUrl('cards/margin')}'), url('${getUrl(
					'cards/' + stats.type.substring(0, 1),
				)}')`,
			});
			$j.each(stats.stats, (key, value) => {
				const $stat = $j('#card .sideB .' + key + ' .value');
				$stat.removeClass('buff debuff');
				if (this.selectedCreatureObj) {
					if (key == 'health') {
						$stat.text(this.selectedCreatureObj.health + '/' + this.selectedCreatureObj.stats[key]);
					} else if (key == 'movement') {
						$stat.text(
							this.selectedCreatureObj.remainingMove + '/' + this.selectedCreatureObj.stats[key],
						);
					} else if (key == 'energy') {
						$stat.text(this.selectedCreatureObj.energy + '/' + this.selectedCreatureObj.stats[key]);
					} else if (key == 'endurance') {
						$stat.text(
							this.selectedCreatureObj.endurance + '/' + this.selectedCreatureObj.stats[key],
						);
					} else {
						$stat.text(this.selectedCreatureObj.stats[key]);
					}
					if (this.selectedCreatureObj.stats[key] > value) {
						// Buff
						$stat.addClass('buff');
					} else if (this.selectedCreatureObj.stats[key] < value) {
						// Debuff
						$stat.addClass('debuff');
					}
				} else {
					$stat.text(value);
				}
			});
			$j.each(game.abilities[stats.id], (key) => {
				const $ability = $j('#card .sideB .abilities .ability:eq(' + key + ')');
				$ability.children('.icon').css({
					'background-image': `url('${getUrl('units/abilities/' + stats.name + ' ' + key)}')`,
				});
				$ability
					.children('.wrapper')
					.children('.info')
					.children('h3')
					.text(stats.ability_info[key].title);
				$ability
					.children('.wrapper')
					.children('.info')
					.children('#desc')
					.text(stats.ability_info[key].desc);
				$ability
					.children('.wrapper')
					.children('.info')
					.children('#info')
					.text(stats.ability_info[key].info);
				$ability
					.children('.wrapper')
					.children('.info')
					.children('#upgrade')
					.text('Upgrade: ' + stats.ability_info[key].upgrade);

				if (key !== 0) {
					$ability
						.children('.wrapper')
						.children('.info')
						.children('#cost')
						.text(' - costs ' + stats.ability_info[key].costs.energy + ' energy pts.');
				} else {
					$ability
						.children('.wrapper')
						.children('.info')
						.children('#cost')
						.text(' - this ability is passive.');
				}
			});

			const summonedOrDead = game.players[player].creatures.some(
				(creature) => creature.type == creatureType,
			);

			this.materializeButton.changeState(ButtonStateEnum.disabled);
			$j('#card .sideA').addClass('disabled').off('click');

			const activeCreature = game.activeCreature;

			if (activeCreature.player.getNbrOfCreatures() > game.creaLimitNbr) {
				$j('#materialize_button p').text(game.msg.ui.dash.materializeOverload);
			} else if (
				!summonedOrDead &&
				activeCreature.player.id === player &&
				activeCreature.type === '--' &&
				activeCreature.abilities[3].used === false
			) {
				const lvl = creatureType.substring(1, 2) - 0,
					size = game.retrieveCreatureStats(creatureType).size - 0,
					plasmaCost = lvl + size;

				// Messages (TODO: text strings in a new language file)
				if (plasmaCost > activeCreature.player.plasma) {
					$j('#materialize_button p').text(game.msg.ui.dash.lowPlasma);
				} else {
					if (creatureType == '--') {
						$j('#materialize_button p').text(game.msg.ui.dash.selectUnit);
					} else {
						$j('#materialize_button p').text(
							game.msg.ui.dash.materializeUnit(plasmaCost.toString()),
						);

						// Bind button
						this.materializeButton.click = () => {
							this.materializeToggled = false;
							this.selectAbility(3);
							this.closeDash();

							if (this.lastViewedCreature) {
								activeCreature.abilities[3].materialize(this.lastViewedCreature);
							} else {
								activeCreature.abilities[3].materialize(this.selectedCreature);
								this.lastViewedCreature = this.selectedCreature;
							}
						};
						$j('#card .sideA').on('click', this.materializeButton.click);
						$j('#card .sideA').removeClass('disabled');
						this.materializeButton.changeState(ButtonStateEnum.glowing);
						$j('#materialize_button').show();
					}
				}
			} else {
				if (creatureType == '--' && !activeCreature.abilities[3].used) {
					// Figure out if the player has enough plasma to summon any available creatures
					const activePlayer = game.players[game.activeCreature.player.id];
					const deadOrSummonedTypes = activePlayer.creatures.map((creature) => creature.type);
					const availableTypes = activePlayer.availableCreatures.filter(
						(el) => !deadOrSummonedTypes.includes(el),
					);
					// Assume we can't afford anything
					// Check one available creature at a time until we see something we can afford
					let can_afford_a_unit = false;
					availableTypes.forEach((type) => {
						const lvl = type.substring(1, 2) - 0;
						const size = game.retrieveCreatureStats(type).size - 0;
						const plasmaCost = lvl + size;
						if (plasmaCost <= activePlayer.plasma) {
							can_afford_a_unit = true;
						}
					});
					// If we can't afford anything, tell the player and disable the materialize button
					if (!can_afford_a_unit) {
						$j('#materialize_button p').text(game.msg.abilities.noPlasma);
						this.materializeButton.changeState(ButtonStateEnum.disabled);
					}
					// Otherwise, let's have it show a random creature on click
					else {
						$j('#materialize_button p').text(game.msg.ui.dash.selectUnit);
						// Bind button for random unit selection
						this.materializeButton.click = () => {
							const creatureId = this.showRandomCreature();
							this.lastViewedCreature = creatureId;
						};
						// Apply the changes
						$j('#card .sideA').on('click', this.materializeButton.click);
						$j('#card .sideA').removeClass('disabled');
						this.materializeButton.changeState(ButtonStateEnum.glowing);
					}
				} else if (
					activeCreature.abilities[3].used &&
					game.activeCreature.isDarkPriest() &&
					player == game.activeCreature.player.id &&
					(clickMethod == 'emptyHex' || clickMethod == 'portrait' || clickMethod == 'grid')
				) {
					if (summonedOrDead) {
						$j('#materialize_button').hide();
					} else if (clickMethod == 'portrait' && creatureType != '--') {
						$j('#materialize_button').hide();
					} else {
						$j('#materialize_button p').text(game.msg.ui.dash.materializeUsed);
						$j('#materialize_button').show();
					}
				} else {
					$j('#materialize_button').hide();
				}
			}
		} else {
			// Card A
			$j('#card .sideA').css({
				'background-image': `url('${getUrl('cards/margin')}'), url('${getUrl(
					'units/artwork/' + stats.name,
				)}')`,
			});
			$j('#card .sideA .section.info')
				.removeClass('sin- sinA sinE sinG sinL sinP sinS sinW')
				.addClass('sin' + stats.type.substring(0, 1));
			addCardCharacterInfo();

			// Card B
			$j.each(stats.stats, (key, value) => {
				const $stat = $j('#card .sideB .' + key + ' .value');
				$stat.removeClass('buff debuff');
				$stat.text(value);
			});

			// Abilities
			$j.each(stats.ability_info, (key) => {
				const $ability = $j('#card .sideB .abilities .ability:eq(' + key + ')');
				$ability.children('.icon').css({
					'background-image': `url('${getUrl('units/abilities/' + stats.name + ' ' + key)}')`,
				});
				$ability
					.children('.wrapper')
					.children('.info')
					.children('h3')
					.text(stats.ability_info[key].title);
				$ability
					.children('.wrapper')
					.children('.info')
					.children('#desc')
					.html(stats.ability_info[key].desc);
				$ability
					.children('.wrapper')
					.children('.info')
					.children('#info')
					.html(stats.ability_info[key].info);
				// Check for an upgrade
				if (stats.ability_info[key].upgrade) {
					$ability
						.children('.wrapper')
						.children('.info')
						.children('#upgrade')
						.text('Upgrade: ' + stats.ability_info[key].upgrade);
				} else {
					$ability.children('.wrapper').children('.info').children('#upgrade').text(' ');
				}
				if (key !== 0) {
					$ability
						.children('.wrapper')
						.children('.info')
						.children('#cost')
						.text(' - costs ' + stats.ability_info[key].costs.energy + ' energy pts.');
				} else {
					$ability
						.children('.wrapper')
						.children('.info')
						.children('#cost')
						.text(' - this ability is passive.');
				}
			});

			// Materialize button
			this.materializeButton.changeState(ButtonStateEnum.disabled);
			$j('#materialize_button p').text(game.msg.ui.dash.heavyDev);
			$j('#materialize_button').show();
			$j('#card .sideA').addClass('disabled').off('click');
		}
	}

	/**
	 * Selects a random available unit and shows its card on the dash.
	 *
	 * Calls showCreature(chosenRandomUnit, activePlayerID, '') to handle opening the dash.
	 *
	 * Called by toggleDash with the randomize option and by clicking the materialize button
	 * when it reads "Please select..."
	 *
	 * @returns ID of the random creature selected.
	 */
	showRandomCreature() {
		const game = this.game;
		// Figure out what the active player can summon
		const activePlayer = game.players[this.game.activeCreature.player.id];
		const deadOrSummonedTypes = activePlayer.creatures.map((creature) => creature.type);
		const availableTypes = activePlayer.availableCreatures.filter(
			(el) => !deadOrSummonedTypes.includes(el),
		);

		// Randomize array to grab a random creature
		for (let i = availableTypes.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const temp = availableTypes[i];
			availableTypes[i] = availableTypes[j];
			availableTypes[j] = temp;
		}

		// Grab the first creature we can afford (if none, default to priest)
		let typeToPass = '--';
		availableTypes.some((creature) => {
			const lvl = creature.substring(1, 2) - 0;
			const size = game.retrieveCreatureStats(creature).size - 0;
			const plasmaCost = lvl + size;

			if (plasmaCost <= activePlayer.plasma) {
				typeToPass = creature;
				return true;
			}

			return false;
		});

		// Show the random unit selected
		this.showCreature(typeToPass, game.activeCreature.team, '');

		return typeToPass;
	}

	selectAbility(i) {
		this.checkAbilities();
		this.selectedAbility = i;

		if (i > -1) {
			this.showAbilityCosts(i);
			this.abilitiesButtons[i].changeState(ButtonStateEnum.active);
			this.activeAbility = true;
		} else {
			this.hideAbilityCosts();
			this.activeAbility = false;
		}
	}

	/**
	 * Change to the specified player tab in the dash
	 * @param{number} id - player id (integer)
	 */
	changePlayerTab(id) {
		const game = this.game;

		this.selectedPlayer = id;
		this.$dash // Dash class
			.removeClass('selected0 selected1 selected2 selected3')
			.addClass('selected' + id);

		this.$grid
			.find('.vignette') // Vignettes class
			.removeClass('active dead queued notsummonable')
			.addClass('locked');

		$j('#tabwrapper').show();
		$j('#playertabswrapper').show();

		// Change creature status
		game.players[id].availableCreatures.forEach((creature) => {
			this.$grid.find(".vignette[creature='" + creature + "']").removeClass('locked');

			const lvl = creature.substring(1, 2) - 0,
				size = game.retrieveCreatureStats(creature).size - 0,
				plasmaCost = lvl + size;

			if (plasmaCost > game.players[id].plasma) {
				this.$grid.find(".vignette[creature='" + creature + "']").addClass('notsummonable');
			}
		});

		game.players[id].creatures.forEach((creature) => {
			const $crea = this.$grid.find(".vignette[creature='" + creature.type + "']");

			$crea.removeClass('notsummonable');
			if (creature.dead === true) {
				$crea.addClass('dead');
			} else {
				$crea.addClass('queued');
			}
		});

		// Bind creature vignette click
		this.$grid
			.find('.vignette')
			.off('click')
			.on('click', (e) => {
				e.preventDefault();
				if (game.freezedInput) {
					return;
				}

				if ($j(e.currentTarget).hasClass('locked')) {
					this.$dash.children('#tooltip').text('Creature locked.');
				}

				const creatureType = $j(e.currentTarget).attr('creature'); // CreatureType
				this.lastViewedCreature = creatureType;
				this.showCreature(creatureType, this.selectedPlayer, 'grid');
			});
	}

	toggleMusicPlayer() {
		$j('#musicplayerwrapper').toggleClass('hide');
	}

	closeMusicPlayer() {
		$j('#musicplayerwrapper').addClass('hide');
	}

	// Function to close scoreboard if pressing outside of it
	easyScoreClose(e) {
		const score = $j('#scoreboard');
		const scoreboard = $j('#scoreboard');

		// Check if the target of the click isn't the scoreboard nor a descendant of it
		if (!score.is(e.target) && score.has(e.target).length === 0) {
			scoreboard.off('click', this.easyScoreClose);
			scoreboard.hide();
		}
	}

	toggleScoreboard(gameOver) {
		const game = this.game;

		// If the scoreboard is already displayed, hide it and return
		if (!this.$scoreboard.hasClass('hide')) {
			this.closeScoreboard();

			return;
		}

		// Binding the click outside of the scoreboard to close the view
		this.$scoreboard.on('click', this.easyScoreClose);

		// Configure scoreboard data
		this.$scoreboard.find('#scoreboardTitle').text('Current Score');

		// Calculate the time cost of the last turn
		const skipTurn = new Date(),
			p = game.activeCreature.player;

		p.totalTimePool = p.totalTimePool - (skipTurn - p.startTime);

		const $table = $j('#scoreboard table tbody');

		// Write table for number players

		// Clear table
		const tableMeta = [
			{
				cls: 'player_name',
				title: 'Players',
			},
			{
				cls: 'firstKill',
				emoji: emoji.get('syringe'),
				title: 'First blood',
			},
			{
				cls: 'kill',
				emoji: emoji.get('skull'),
				title: 'Kills',
			},
			{
				cls: 'combo',
				emoji: emoji.get('chains'),
				title: 'Combos',
			},
			{
				cls: 'humiliation',
				emoji: emoji.get('baby'),
				title: 'Humiliation',
			},
			{
				cls: 'annihilation',
				emoji: emoji.get('coffin'),
				title: 'Annihilation',
			},
			{
				cls: 'deny',
				emoji: emoji.get('collision'),
				title: 'Denies',
			},
			{
				cls: 'pickupDrop',
				emoji: emoji.get('cherries'),
				title: 'Drops picked',
			},
			{
				cls: 'timebonus',
				emoji: emoji.get('alarm_clock'),
				title: 'Time Bonus',
			},
			{
				cls: 'nofleeing',
				emoji: emoji.get('chicken'),
				title: 'No Fleeing',
			},
			{
				cls: 'creaturebonus',
				emoji: emoji.get('heartbeat'),
				title: 'Survivor Units',
			},
			{
				cls: 'darkpriestbonus',
				title: 'Survivor Dark Priest',
			},
			{
				cls: 'immortal',
				emoji: emoji.get('bat'),
				title: 'Immortal',
			},
			{
				cls: 'upgrade',
				emoji: emoji.get('medal'),
				title: 'Ability Upgrades',
			},
			{
				cls: 'total',
				emoji: emoji.get('100'),
				title: 'Total',
			},
		];

		tableMeta.forEach((row) => {
			$table.find(`tr.${row.cls}`).empty().html(`<td>
			${row.emoji ? `<span class="tooltiptext">${row.title}</span>${row.emoji}` : `${row.title}`}
			</td>`);

			// Add cells for each player
			for (let i = 0; i < game.playerMode; i++) {
				$table.find(`tr.${row.cls}`).append('<td>--</td>');
			}
		});

		// Fill the board
		for (let i = 0; i < game.playerMode; i++) {
			// Each player
			// TimeBonus
			if (game.timePool > 0) {
				game.players[i].bonusTimePool = Math.round(game.players[i].totalTimePool / 1000);
			}

			//----------Display-----------//
			const colId = game.playerMode > 2 ? i + 2 + ((i % 2) * 2 - 1) * Math.min(1, i % 3) : i + 2;

			// Change Name
			$table
				.children('tr.player_name')
				.children('td:nth-child(' + colId + ')') // Weird expression swaps 2nd and 3rd player
				.text(game.players[i].name);

			// Change score
			$j.each(game.players[i].getScore(), function (index, val) {
				const text = val === 0 && index !== 'total' ? '--' : val;
				$table
					.children('tr.' + index)
					.children('td:nth-child(' + colId + ')') // Weird expression swaps 2nd and 3rd player
					.text(text);
			});
		}

		if (gameOver) {
			// Set title
			this.$scoreboard.find('#scoreboardTitle').text('Match Over');

			// Declare winner
			if (game.playerMode > 2) {
				// 2 vs 2
				const score1 = game.players[0].getScore().total + game.players[2].getScore().total,
					score2 = game.players[1].getScore().total + game.players[3].getScore().total;

				if (score1 > score2) {
					// Left side wins
					$j('#scoreboard p').text(
						game.players[0].name + ' and ' + game.players[2].name + ' won the match!',
					);
				} else if (score1 < score2) {
					// Right side wins
					$j('#scoreboard p').text(
						game.players[1].name + ' and ' + game.players[3].name + ' won the match!',
					);
				} else if (score1 == score2) {
					// Draw
					$j('#scoreboard p').text('Draw!');
				}
			} else {
				// 1 vs 1
				const score1 = game.players[0].getScore().total,
					score2 = game.players[1].getScore().total;

				if (score1 > score2) {
					// Left side wins
					$j('#scoreboard p').text(game.players[0].name + ' won the match!');
				} else if (score1 < score2) {
					// Right side wins
					$j('#scoreboard p').text(game.players[1].name + ' won the match!');
				} else if (score1 == score2) {
					// Draw
					$j('#scoreboard p').text('Draw!');
				}
			}
		}

		// Finally, show the scoreboard
		this.$scoreboard.removeClass('hide');
	}

	closeScoreboard() {
		this.$scoreboard.addClass('hide');
	}

	/**
	 * Show the dash and hide some buttons
	 * @param{boolean} [randomize] - True selects a random creature from the grid.
	 */
	toggleDash(randomize) {
		const game = this.game;

		if (this.$dash.hasClass('active')) {
			this.closeDash();
			return;
		}

		game.signals.ui.dispatch('onOpenDash');
		if (randomize && !this.lastViewedCreature) {
			// Optional: select a random creature from the grid
			this.showRandomCreature();
		} else if (this.lastViewedCreature) {
			this.showCreature(this.lastViewedCreature, game.activeCreature.team, '');
		} else {
			this.showCreature(game.activeCreature.type, game.activeCreature.team, '');
		}
	}

	closeDash() {
		const game = this.game;

		this.$dash.removeClass('active');
		this.$dash.transition(
			{
				opacity: 0,
				queue: false,
			},
			this.dashAnimSpeed,
			'linear',
			() => {
				this.$dash.hide();
			},
		);

		if (this.materializeToggled && game.activeCreature && game.activeCreature.type === '--') {
			game.activeCreature.queryMove();
		}

		this.dashopen = false;
		this.materializeToggled = false;
	}

	gridSelectUp() {
		const game = this.game;
		const creatureType = this.selectedCreature;
		let nextCreature;

		const isDarkPriest = creatureType === '--';
		if (isDarkPriest) {
			this.showCreature('W1', this.selectedPlayer);
			return;
		}

		if (game.realms.indexOf(creatureType[0]) - 1 > -1) {
			const realm = game.realms[game.realms.indexOf(creatureType[0]) - 1];
			nextCreature = realm + creatureType[1];
			this.lastViewedCreature = nextCreature;
			this.showCreature(nextCreature, this.selectedPlayer);
		}
	}

	gridSelectDown() {
		const game = this.game;
		const creatureType = this.selectedCreature;
		let nextCreature;

		const isDarkPriest = creatureType === '--';
		if (isDarkPriest) {
			this.showCreature('A1', this.selectedPlayer);
			return;
		}

		if (game.realms.indexOf(creatureType[0]) + 1 < game.realms.length) {
			const realm = game.realms[game.realms.indexOf(creatureType[0]) + 1];
			nextCreature = realm + creatureType[1];
			this.lastViewedCreature = nextCreature;
			this.showCreature(nextCreature, this.selectedPlayer);
		}
	}

	gridSelectLeft() {
		const isDarkPriest = this.selectedCreature === '--';
		const creatureType = isDarkPriest ? 'A0' : this.selectedCreature;
		let nextCreature;

		if (creatureType[1] - 1 < 1) {
			// End of row
			return;
		} else {
			nextCreature = creatureType[0] + (creatureType[1] - 1);
			this.lastViewedCreature = nextCreature;
			this.showCreature(nextCreature, this.selectedPlayer);
		}
	}

	gridSelectRight() {
		const isDarkPriest = this.selectedCreature === '--';
		const creatureType = isDarkPriest ? 'A8' : this.selectedCreature;
		let nextCreature;

		if (creatureType[1] - 0 + 1 > 7) {
			// End of row
			return;
		} else {
			nextCreature = creatureType[0] + (creatureType[1] - 0 + 1);
			this.lastViewedCreature = nextCreature;
			this.showCreature(nextCreature, this.selectedPlayer);
		}
	}

	gridSelectNext() {
		const game = this.game;
		const isDarkPriest = this.selectedCreature === '--';
		const creatureType = isDarkPriest ? 'A0' : this.selectedCreature;
		let valid;
		let nextCreature;

		if (creatureType[1] - 0 + 1 > 7) {
			// End of row
			if (game.realms.indexOf(creatureType[0]) + 1 < game.realms.length) {
				const realm = game.realms[game.realms.indexOf(creatureType[0]) + 1];

				// Test If Valid Creature
				if ($j.inArray(realm + '1', game.players[this.selectedPlayer].availableCreatures) > 0) {
					valid = true;

					for (let i = 0, len = game.players[this.selectedPlayer].creatures.length; i < len; i++) {
						const creature = game.players[this.selectedPlayer].creatures[i];

						if (creature instanceof Creature && creature.type == realm + '1' && creature.dead) {
							valid = false;
						}
					}

					if (valid) {
						nextCreature = realm + '1';
						this.lastViewedCreature = nextCreature;
						this.showCreature(nextCreature, this.selectedPlayer);
						return;
					}
				}

				this.selectedCreature = realm + '1';
			} else {
				return;
			}
		} else {
			// Test If Valid Creature
			if (
				$j.inArray(
					creatureType[0] + (creatureType[1] - 0 + 1),
					game.players[this.selectedPlayer].availableCreatures,
				) > 0
			) {
				valid = true;

				for (let i = 0, len = game.players[this.selectedPlayer].creatures.length; i < len; i++) {
					const creature = game.players[this.selectedPlayer].creatures[i];

					if (
						creature instanceof Creature &&
						creature.type == creatureType[0] + (creatureType[1] - 0 + 1) &&
						creature.dead
					) {
						valid = false;
					}
				}

				if (valid) {
					nextCreature = creatureType[0] + (creatureType[1] - 0 + 1);
					this.lastViewedCreature = nextCreature;
					this.showCreature(nextCreature, this.selectedPlayer);
					return;
				}
			}

			this.selectedCreature = creatureType[0] + (creatureType[1] - 0 + 1);
		}

		this.gridSelectNext();
	}

	gridSelectPrevious() {
		const game = this.game;
		const creatureType = this.selectedCreature == '--' ? 'W8' : this.selectedCreature;
		let valid;
		let nextCreature;

		if (creatureType[1] - 1 < 1) {
			// End of row
			if (game.realms.indexOf(creatureType[0]) - 1 > -1) {
				const realm = game.realms[game.realms.indexOf(creatureType[0]) - 1];

				// Test if valid creature
				if ($j.inArray(realm + '7', game.players[this.selectedPlayer].availableCreatures) > 0) {
					valid = true;

					for (let i = 0, len = game.players[this.selectedPlayer].creatures.length; i < len; i++) {
						const creature = game.players[this.selectedPlayer].creatures[i];

						if (creature instanceof Creature && creature.type == realm + '7' && creature.dead) {
							valid = false;
						}
					}

					if (valid) {
						nextCreature = realm + '7';
						this.lastViewedCreature = nextCreature;
						this.showCreature(nextCreature, this.selectedPlayer);
						return;
					}
				}

				this.selectedCreature = realm + '7';
			} else {
				return;
			}
		} else {
			// Test if valid creature
			if (
				$j.inArray(
					creatureType[0] + (creatureType[1] - 1),
					game.players[this.selectedPlayer].availableCreatures,
				) > 0
			) {
				valid = true;

				for (let i = 0, len = game.players[this.selectedPlayer].creatures.length; i < len; i++) {
					const creature = game.players[this.selectedPlayer].creatures[i];

					if (
						creature instanceof Creature &&
						creature.type == creatureType[0] + (creatureType[1] - 1) &&
						creature.dead
					) {
						valid = false;
					}
				}

				if (valid) {
					nextCreature = creatureType[0] + (creatureType[1] - 1);
					this.lastViewedCreature = nextCreature;
					this.showCreature(nextCreature, this.selectedPlayer);
					return;
				}
			}

			this.selectedCreature = creatureType[0] + (creatureType[1] - 1);
		}

		this.gridSelectPrevious();
	}
	/**
	 * Change ability buttons and bind events
	 */
	changeAbilityButtons() {
		const game = this.game,
			creature = game.activeCreature;
		this.abilitiesButtons.forEach((btn) => {
			const ab = creature.abilities[btn.abilityId];
			btn.css.normal = {
				'background-image': `url('${getUrl(
					'units/abilities/' + creature.name + ' ' + btn.abilityId,
				)}')`,
			};
			const $desc = btn.$button.next('.desc');
			$desc.find('span.title').text(ab.title);
			$desc.find('p.description').html(ab.desc);
			$desc.find('p.full-info').html(ab.info);
			btn.changeState(); // Apply changes
		});
	}
	/* updateActiveBox()
	 *
	 * Update activebox with new current creature's abilities
	 */
	banner(message) {
		const $bannerBox = $j('#banner');
		$bannerBox.text(message);
	}

	updateActivebox() {
		const game = this.game,
			creature = game.activeCreature,
			$abilitiesButtons = $j('#abilities .ability');

		$abilitiesButtons.off('click');
		this.$activebox
			.find('#abilities')
			.clearQueue()
			.transition(
				{
					y: '-420px',
				},
				500,
				'easeInQuart',
				() => {
					// Hide panel
					$j('#abilities')
						.removeClass('p0 p1 p2 p3')
						.addClass('p' + creature.player.id);

					this.energyBar.setSize(creature.oldEnergy / creature.stats.energy);
					this.healthBar.setSize(creature.oldHealth / creature.stats.health);

					this.btnAudio.changeState(ButtonStateEnum.normal);
					this.btnSkipTurn.changeState(ButtonStateEnum.normal);
					this.btnFullscreen.changeState(ButtonStateEnum.normal);
					// Change ability buttons
					this.changeAbilityButtons();
					// Update upgrade info
					this.updateAbilityUpgrades();
					// Callback after final transition
					this.$activebox.children('#abilities').transition(
						{
							y: '0px',
						},
						500,
						'easeOutQuart',
						() => {
							this.btnAudio.changeState(ButtonStateEnum.slideIn);
							this.btnSkipTurn.changeState(ButtonStateEnum.slideIn);
							this.btnFullscreen.changeState(ButtonStateEnum.slideIn);
							if (creature.canWait && game.queue.getCurrentQueueLength() > 1) {
								this.btnDelay.changeState(ButtonStateEnum.slideIn);
							}
							this.checkAbilities();
						},
					); // Show panel
				},
			);

		if (game.multiplayer) {
			if (!this.active) {
				game.freezedInput = true;
			} else {
				game.freezedInput = false;
			}
		}
	}

	updateAbilityUpgrades() {
		const game = this.game,
			creature = game.activeCreature;

		// Change ability buttons
		this.abilitiesButtons.forEach((btn) => {
			const ab = creature.abilities[btn.abilityId];
			const $desc = btn.$button.next('.desc');

			// Play the ability upgrade animation and sound when it gets upgraded
			if (
				!ab.upgraded &&
				ab.usesLeftBeforeUpgrade() === 0 &&
				(ab.used || !ab.isUpgradedPerUse()) &&
				game.abilityUpgrades != 0
			) {
				// Add the class for the background image and fade transition
				btn.$button.addClass('upgradeTransition');
				btn.$button.addClass('upgradeIcon');

				btn.changeState(ButtonStateEnum.slideIn); // Keep the button in view

				// After .3s play the upgrade sound
				setTimeout(() => {
					game.soundsys.playSFX('sounds/upgrade');
				}, 300);

				// After 2s remove the background and update the button if it's not a passive
				setTimeout(() => {
					btn.$button.removeClass('upgradeIcon');
				}, 1200);

				// Then remove the animation
				this.animationUpgradeTimeOutID = setTimeout(() => {
					btn.$button.removeClass('upgradeTransition');
					if (ab.isUpgradedPerUse()) {
						btn.changeState(ButtonStateEnum.disabled);
					}
				}, 1500);

				ab.setUpgraded(); // Set the ability to upgraded
			}

			// Change the ability's frame when it gets upgraded
			if (ab.isUpgraded()) {
				btn.$button.addClass('upgraded');
			} else {
				btn.$button.removeClass('upgraded');
			}

			// Add extra ability info
			const $abilityInfo = $desc.find('.abilityinfo_content');
			$abilityInfo.find('.info').remove();

			const costsString = ab.getFormattedCosts();
			if (costsString) {
				$abilityInfo.append('<div class="info costs">Costs : ' + costsString + '</div>');
			}

			const dmgString = ab.getFormattedDamages();
			if (dmgString) {
				$abilityInfo.append('<div class="info damages">Damages : ' + dmgString + '</div>');
			}

			const specialString = ab.getFormattedEffects();
			if (specialString) {
				$abilityInfo.append('<div class="info special">Effects : ' + specialString + '</div>');
			}

			if (ab.hasUpgrade()) {
				if (!ab.isUpgraded()) {
					$abilityInfo.append(
						'<div class="info upgrade">' +
							(ab.isUpgradedPerUse() ? 'Uses' : 'Rounds') +
							' left before upgrading : ' +
							ab.usesLeftBeforeUpgrade() +
							'</div>',
					);
				}

				$abilityInfo.append('<div class="info upgrade">Upgrade : ' + ab.upgrade + '</div>');
			}
		});
	}

	checkAbilities() {
		let game = this.game,
			oneUsableAbility = false;
		for (let i = 0; i < 4; i++) {
			const ab = game.activeCreature.abilities[i];
			ab.message = '';
			const req = ab.require();
			ab.message = ab.used ? game.msg.abilities.alreadyUsed : ab.message;

			// Tooltip for passive ability to display if there is any usable abilities or not
			if (i === 0) {
				const b = this.selectedAbility == -1 ? 4 : this.selectedAbility; // Checking usable abilities
				for (let j = 0 + 1; j < 4; j++) {
					if (
						game.activeCreature.abilities[j].require() &&
						!game.activeCreature.abilities[j].used
					) {
						ab.message = game.msg.abilities.passiveCycle; // Message if there is any usable abilities
						break;
					} else {
						ab.message = game.msg.abilities.passiveUnavailable; // Message if there is no usable abilities
					}
				}
			}
			if (ab.message == game.msg.abilities.passiveCycle) {
				this.abilitiesButtons[i].changeState(ButtonStateEnum.slideIn);
			} else if (req && !ab.used && ab.trigger == 'onQuery') {
				this.abilitiesButtons[i].changeState(ButtonStateEnum.slideIn);
				oneUsableAbility = true;
			} else if (
				ab.message == game.msg.abilities.noTarget ||
				(ab.trigger != 'onQuery' && req && !ab.used)
			) {
				this.abilitiesButtons[i].changeState(ButtonStateEnum.noClick);
			} else {
				this.abilitiesButtons[i].changeState(ButtonStateEnum.disabled);
			}

			// Charge
			this.abilitiesButtons[i].$button.next('.desc').find('.charge').remove();
			if (ab.getCharge !== undefined) {
				this.abilitiesButtons[i].$button
					.next('.desc')
					.append(
						'<div class="charge">Charge : ' +
							ab.getCharge().value +
							'/' +
							ab.getCharge().max +
							'</div>',
					);
			}

			// Message
			this.abilitiesButtons[i].$button.next('.desc').find('.message').remove();
			if (ab.message !== '') {
				this.abilitiesButtons[i].$button
					.next('.desc')
					.append('<div class="message">' + ab.message + '</div>');
			}
		}

		// No action possible
		if (!oneUsableAbility && game.activeCreature.remainingMove === 0) {
			//game.skipTurn( { tooltip: "Finished" } ); // Autoskip
			game.activeCreature.noActionPossible = true;
			this.btnSkipTurn.changeState(ButtonStateEnum.slideIn);
		}
	}

	updateTimer() {
		const game = this.game,
			date = new Date() - game.pauseTime;

		// TurnTimePool
		if (game.turnTimePool >= 0) {
			let remainingTime =
				game.turnTimePool - Math.round((date - game.activeCreature.player.startTime) / 1000);

			if (game.timePool > 0) {
				remainingTime = Math.min(
					remainingTime,
					Math.round(
						(game.activeCreature.player.totalTimePool -
							(date - game.activeCreature.player.startTime)) /
							1000,
					),
				);
			}

			const id = game.activeCreature.player.id;
			$j('.p' + id + ' .turntime').text(time.getTimer(remainingTime));
			// Time Alert
			if (remainingTime < 6) {
				$j('.p' + id + ' .turntime').addClass('alert');
			} else {
				$j('.p' + id + ' .turntime').removeClass('alert');
			}

			// Time Bar
			const timeRatio = (date - game.activeCreature.player.startTime) / 1000 / game.turnTimePool;
			this.timeBar.setSize(1 - timeRatio);
		} else {
			$j('.turntime').text('∞');
		}

		// TotalTimePool
		if (game.timePool >= 0) {
			game.players.forEach((player) => {
				let remainingTime =
					player.id == game.activeCreature.player.id
						? player.totalTimePool - (date - player.startTime)
						: player.totalTimePool;
				remainingTime = Math.max(Math.round(remainingTime / 1000), 0);
				$j('.p' + player.id + ' .timepool').text(time.getTimer(remainingTime));
			});

			// Time Bar
			const poolRatio =
				(game.activeCreature.player.totalTimePool - (date - game.activeCreature.player.startTime)) /
				1000 /
				game.timePool;
			this.poolBar.setSize(poolRatio);
		} else {
			$j('.timepool').text('∞');
		}
	}

	/**
	 * Delete and add element to the Queue container based on the game's queues
	 */
	updateQueueDisplay() {
		const game = this.game;
		this.queue.setQueue(game.queue, game.turn);
	}

	xrayQueue(creaID) {
		this.queue.xray(creaID);
	}

	bouncexrayQueue(creaID) {
		this.queue.xray(creaID);
		this.queue.bounce(creaID);
	}

	updateFatigue() {
		this.queue.refresh();
	}

	endGame() {
		this.toggleScoreboard(true);
		this.btnFlee.changeState(ButtonStateEnum.hidden);
		this.btnExit.changeState(ButtonStateEnum.normal);
	}

	showGameSetup() {
		this.toggleScoreboard();
		this.updateQueueDisplay();
		$j('#matchMaking').show();
		$j('#gameSetupContainer').show();
		$j('#loader').addClass('hide');
		this.queue.empty(Queue.IMMEDIATE);
	}

	/**
	 * Make the user confirm attempts to navigate away (refresh, back button, close
	 * tab, etc) to prevent accidentally ending the game.
	 *
	 * webpack-dev-server reloads in the development environment will bypass this check.
	 */
	confirmWindowUnload() {
		this.ignoreNextConfirmUnload = false;

		const confirmUnload = (event) => {
			const confirmation =
				'A game is in progress and cannot be restored, are you sure you want to leave?';

			if (this.ignoreNextConfirmUnload) {
				delete event['returnValue'];
				return;
			}

			// https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload#example
			event.preventDefault();
			event.returnValue = confirmation;
			return confirmation;
		};

		window.addEventListener('beforeunload', confirmUnload);

		// If running in webpack-dev-server, allow Live Reload events to bypass this check.
		if (process.env.NODE_ENV === 'development') {
			// https://stackoverflow.com/a/61579190/1414008
			window.addEventListener('message', ({ data: { type } }) => {
				if (type === 'webpackInvalid') {
					this.ignoreNextConfirmUnload = true;
					window.location.reload();
				}
			});
		}
	}

	#makeCreatureGrid(rasterElement) {
		const getLink = (type) => {
			const stats = this.game.retrieveCreatureStats(type);
			const snakeCaseName = stats.name.replace(' ', '_');
			return `<a href="#${snakeCaseName}" class="vignette realm${stats.realm} type${type}" creature="${type}">
						<div class="tooltip">
							<div class="content">${stats.name}</div>
						</div>
						<div class="overlay"></div>
						<div class="border"></div>
					</a>`;
		};

		const tmpElement = document.createElement('div');
		const rasterWrapper = document.createElement('div');
		rasterWrapper.setAttribute('id', 'creatureraster');
		rasterElement.appendChild(rasterWrapper);

		for (const realm of 'AEGLPSW'.split('')) {
			for (const i of '1234567'.split('')) {
				const type = realm + i;
				tmpElement.innerHTML = getLink(type);
				rasterWrapper.appendChild(tmpElement.firstChild);
			}
		}

		return rasterElement;
	}

	static #getQuickInfo(ui, quickInfoDomElement) {
		const quickInfo = new QuickInfo(quickInfoDomElement);

		const creatureFormatter = (creature) => {
			const name = capitalize(creature.name);
			const trapOrLocation = capitalize(
				creature?.hexagons[0]?.trap ? creature?.hexagons[0]?.trap?.name : ui.game.combatLocation,
			);
			const nameColorClasses =
				creature && creature.player ? `p${creature.player.id} player-text bright` : '';

			return `<div class="vignette hex">
			<div class="hexinfo frame">
			<p class="name ${nameColorClasses}">${name}</p>
			<p>${trapOrLocation}</p>
			</div>
			</div>
			`;
		};

		const playerFormatter = (player) =>
			`<div class="vignette active p${player.id}">
				<div class="playerinfo frame p${player.id}">
				<p class="name">${player.name}</p>
				<p class="points"><span>${player.getScore().total}</span> Points</p>
				<p class="plasma"><span>${player.plasma}</span> Plasma</p>
				<p class="units"><span>${player.getNbrOfCreatures() + ' / ' + ui.game.creaLimitNbr}</span> Units</p>
				<p><span class="activePlayer turntime">&#8734;</span> / <span class="timepool">&#8734;</span></p>
			</div></div>`;

		const hexFormatter = (hex) => {
			const name = capitalize(
				hex.creature ? hex.creature.name : hex.drop ? hex.drop.name : hex.coord,
			);
			const trapOrLocation = capitalize(hex.trap ? hex.trap.name : ui.game.combatLocation);
			const nameColorClasses =
				hex.creature && hex.creature.player ? `p${hex.creature.player.id} player-text bright` : '';
			return `<div class="vignette hex">
			<div class="hexinfo frame">
			<p class="name ${nameColorClasses}">${name}</p>
			<p>${trapOrLocation}</p>
			</div>
			</div>
			`;
		};

		const gameFormatter = (game) => {
			return `<div class="vignette hex">
			<div class="hexinfo frame">
			<p class="name">Ancient Beast</p>
			<p>${version}</p>
			</div>
			</div>
			`;
		};

		/**
		 * NOTE: Throttling here because we want to
		 * skip a hex 'mouse out' if there's a
		 * 'mouse enter' soon after. We don't want a
		 * transition between 2 different hexes that
		 * have the same contents.
		 */
		const throttledSet = throttle(
			(str) => {
				quickInfo.set(str);
			},
			50,
			{ leading: false },
		);

		const showCurrentPlayer = () => {
			throttledSet(playerFormatter(ui.game.activePlayer));
		};

		const showHex = (hex) => {
			throttledSet(hexFormatter(hex));
		};

		const showCreature = (creature) => {
			throttledSet(creatureFormatter(creature));
		};

		const showGameInfo = () => {
			throttledSet(gameFormatter(ui.game));
		};

		const showDefault = () => {
			showCurrentPlayer();
		};

		ui.game.signals.creature.add((message) => {
			if (['abilityend', 'activate'].includes(message)) {
				showDefault();
			}
		});

		ui.game.signals.ui.add((message, payload) => {
			if (
				[
					'toggleMusicPlayer',
					'toggleDash',
					'toggleScore',
					'toggleMetaPowers',
					'closeInterfaceScreens',
					'vignettecreaturemouseleave',
					'vignetteturnendmouseleave',
				].includes(message)
			) {
				showDefault();
			} else if ('vignettecreaturemouseenter' === message) {
				showCreature(payload.creature);
			} else if ('vignetteturnendmouseenter' === message) {
				showGameInfo();
			}
		});

		ui.game.signals.hex.add((message, { hex }) => {
			if (message === 'over' && (hex.creature || hex.drop || hex.trap)) {
				showHex(hex);
			} else {
				showDefault();
			}
		});

		return quickInfo;
	}

	static #getQueue(ui, queueDomElement) {
		/**
		 * NOTE:
		 * Sets up event handlers for the Queue.
		 * Creates Queue.
		 * Attaches events to the Queue.
		 * Returns Queue.
		 */
		const ifGameNotFrozen = utils.ifGameNotFrozen(ui.game);

		const onCreatureClick = ifGameNotFrozen((creature) => {
			/**
			 * NOTE:
			 * If showing the active player's Dark Priest, open the dash using
			 * another method which restores any previously selected creature
			 * for materialization.
			 */
			if (creature.isDarkPriest() && creature.id === ui.game.activeCreature.id) {
				ui.toggleDash();
			} else {
				ui.showCreature(creature.type, creature.player.id, 'portrait');
			}
		});

		const onCreatureMouseEnter = ifGameNotFrozen((creature) => {
			const creatures = ui.game.creatures.filter((c) => c instanceof Creature);
			const otherCreatures = creatures.filter((c) => c.id !== creature.id);

			otherCreatures.forEach((c) => {
				c.xray(true);
				c.hexagons.forEach((hex) => {
					hex.cleanOverlayVisualState();
				});
			});
			creature.hexagons.forEach((hex) => {
				hex.overlayVisualState('hover h_player' + creature.team);
			});

			ui.game.grid.showMovementRange(creature);
			ui.queue.xray(creature.id);
		});

		const onCreatureMouseLeave = (maybeCreature) => {
			// The mouse over adds a coloured hex to the creature, so when we mouse leave we have to remove them
			const creatures = ui.game.creatures.filter((c) => c instanceof Creature);
			creatures.forEach((creature) => {
				creature.hexagons.forEach((hex) => {
					hex.cleanOverlayVisualState();
				});
			});

			ui.game.grid.redoLastQuery();
			creatures.forEach((creature) => {
				creature.xray(false);
			});

			ui.queue.xray(-1);
			ui.quickInfo.clear();
		};

		const onTurnEndClick = throttle(() => {
			ui.game.soundsys.playSFX('sounds/AncientBeast');
		}, 2000);

		const onTurnEndMouseEnter = ifGameNotFrozen(() => {
			ui.game.grid.showGrid(true);
			ui.game.grid.showCurrentCreatureMovementInOverlay(ui.game.activeCreature);
		});

		const onTurnEndMouseLeave = () => {
			ui.game.grid.showGrid(false);
			ui.game.grid.cleanOverlay();
			ui.game.grid.redoLastQuery();
		};

		const SIGNAL_CREATURE_CLICK = 'vignettecreatureclick';
		const SIGNAL_CREATURE_MOUSE_ENTER = 'vignettecreaturemouseenter';
		const SIGNAL_CREATURE_MOUSE_LEAVE = 'vignettecreaturemouseleave';
		const SIGNAL_DELAY_CLICK = 'vignettedelayclick';
		const SIGNAL_DELAY_MOUSE_ENTER = 'vignettedelaymouseenter';
		const SIGNAL_DELAY_MOUSE_LEAVE = 'vignettedelaymouseleave';
		const SIGNAL_TURN_END_CLICK = 'vignetteturnendlick';
		const SIGNAL_TURN_END_MOUSE_ENTER = 'vignetteturnendmouseenter';
		const SIGNAL_TURN_END_MOUSE_LEAVE = 'vignetteturnendmouseleave';

		ui.game.signals.ui.add((msg, payload) => {
			switch (msg) {
				case SIGNAL_CREATURE_CLICK:
					onCreatureClick(payload.creature);
					break;
				case SIGNAL_CREATURE_MOUSE_ENTER:
					onCreatureMouseEnter(payload.creature);
					break;
				case SIGNAL_CREATURE_MOUSE_LEAVE:
					onCreatureMouseLeave(payload.creature);
					break;
				case SIGNAL_TURN_END_CLICK:
					onTurnEndClick(payload.turnNumber);
					break;
				case SIGNAL_TURN_END_MOUSE_ENTER:
					onTurnEndMouseEnter(payload.turnNumber);
					break;
				case SIGNAL_TURN_END_MOUSE_LEAVE:
					onTurnEndMouseLeave(payload.turnNumber);
					break;
			}
		});

		const queueEventHandlers = {
			onCreatureClick: (creature) =>
				ui.game.signals.ui.dispatch(SIGNAL_CREATURE_CLICK, { creature }),
			onCreatureMouseEnter: (creature) =>
				ui.game.signals.ui.dispatch(SIGNAL_CREATURE_MOUSE_ENTER, { creature }),
			onCreatureMouseLeave: (creature) =>
				ui.game.signals.ui.dispatch(SIGNAL_CREATURE_MOUSE_LEAVE, { creature }),
			onDelayClick: () => ui.game.signals.ui.dispatch(SIGNAL_DELAY_CLICK, {}),
			onDelayMouseEnter: () => ui.game.signals.ui.dispatch(SIGNAL_DELAY_MOUSE_ENTER, {}),
			onDelayMouseLeave: () => ui.game.signals.ui.dispatch(SIGNAL_DELAY_MOUSE_LEAVE, {}),
			onTurnEndClick: (turnNumber) =>
				ui.game.signals.ui.dispatch(SIGNAL_TURN_END_CLICK, { turnNumber }),
			onTurnEndMouseEnter: (turnNumber) =>
				ui.game.signals.ui.dispatch(SIGNAL_TURN_END_MOUSE_ENTER, { turnNumber }),
			onTurnEndMouseLeave: (turnNumber) =>
				ui.game.signals.ui.dispatch(SIGNAL_TURN_END_MOUSE_LEAVE, { turnNumber }),
		};

		return new Queue(queueDomElement, queueEventHandlers);
	}
}

const utils = {
	ifGameNotFrozen: (game) => {
		// NOTE: Higher order function
		// Filters out function calls made when the game is frozen.
		return (fn) => {
			return (...args) => {
				if (game.freezedInput) {
					return;
				} else {
					return fn(...args);
				}
			};
		};
	},
};
