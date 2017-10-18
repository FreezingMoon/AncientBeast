/* Class UI
 *
 * Object containing UI DOM element, update functions and event managment on UI.
 *
 */
var UI = class UI {
	/* Attributes
	 *
	 * NOTE : attributes and variables starting with $ are jquery element
	 * and jquery function can be called dirrectly from them.
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

	/* Constructor
	 *
	 * Create attributes and default buttons
	 *
	 */
	constructor(game) {
		this.game = game;
		this.$display = $j("#ui");
		this.$queue = $j("#queuewrapper");
		this.$dash = $j("#dash");
		this.$grid = $j("#creaturegrid");
		this.$activebox = $j("#activebox");

		// Chat
		this.chat = new Chat(game);

		// Buttons Objects
		this.buttons = [];
		this.abilitiesButtons = [];

		// Dash Button
		this.btnToggleDash = new Button({
			$button: $j(".toggledash"),
			click: (e) => {
				this.toggleDash();
			},
		}, game);
		this.buttons.push(this.btnToggleDash);

		// Audio Button
		this.btnAudio = new Button({
			$button: $j("#audio.button"),
			click: (e) => {
				if (!this.dashopen) {
					this.showMusicPlayer();
				}
			}
		}, game);
		this.buttons.push(this.btnAudio);

		// Skip Turn Button
		this.btnSkipTurn = new Button({
			$button: $j("#skip.button"),
			click: (e) => {
				if (!this.dashopen) {
					if (game.turnThrottle) {
						return;
					}

					game.gamelog.add({
						action: "skip"
					});
					game.skipTurn();
				}
			},
		}, game);
		this.buttons.push(this.btnSkipTurn);

		// Delay Unit Button
		this.btnDelay = new Button({
			$button: $j("#delay.button"),
			click: (e) => {
				if (!this.dashopen) {
					let creature = game.activeCreature;

					if (game.turnThrottle || creature.hasWait || !creature.delayable || game.queue.isCurrentEmpty()) {
						return;
					}

					game.gamelog.add({
						action: "delay"
					});
					game.delayCreature();
				}
			},
		}, game);
		this.buttons.push(this.btnDelay);

		// Flee Match Button
		this.btnFlee = new Button({
			$button: $j("#flee.button"),
			click: (e) => {
				if (!this.dashopen) {
					if (game.turn < game.minimumTurnBeforeFleeing) {
						alert("You cannot flee the match in the first 10 rounds.");
						return;
					}

					if (game.activeCreature.player.isLeader()) {
						alert("You cannot flee the match while being in lead.");
						return;
					}

					if (window.confirm("Are you sure you want to flee the match?")) {
						game.gamelog.add({
							action: "flee"
						});
						game.activeCreature.player.flee();
					}
				}
			},
			state: "disabled",
		}, game);
		this.buttons.push(this.btnFlee);

		// ProgressBar
		this.healthBar = new ProgressBar({
			$bar: $j("#leftpanel .progressbar .bar.healthbar"),
			color: "red"
		}, game);

		this.energyBar = new ProgressBar({
			$bar: $j("#leftpanel .progressbar .bar.energybar"),
			color: "yellow"
		}, game);

		this.timeBar = new ProgressBar({
			$bar: $j("#rightpanel .progressbar .timebar"),
			color: "white"
		}, game);

		this.poolBar = new ProgressBar({
			$bar: $j("#rightpanel .progressbar .poolbar"),
			color: "grey"
		}, game);

		// Volume Sliders
		$j("#effects_volume").slider({
			step: 0.2,
			value: 5,
			min: 0,
			max: 10,
			slide: (event, ui) => {
				game.soundsys.setEffectsVolume(ui.value / 5);
			}
		});

		let hotkeys = {
			overview: 9, // Tab TODO: This should open/close score screen
			cycle: 81, // Q TODO: Make this work
			attack: 87, // W
			ability: 69, // E
			ultimate: 82, // R
			audio: 65, // A TODO: Make this work
			skip: 83, // S
			delay: 68, // D
			flee: 70, // F
			chat: 13, // Return TODO: Should open, send & hide chat
			close: 27, // Escape
			//pause: 80, // P, might get deprecated
			show_grid: 16, // Shift
			dash_up: 38, // Up arrow
			dash_down: 40, // Down arrow
			dash_left: 37, // Left arrow
			dash_right: 39, // Right arrow
			dash_materializeButton: 13, // Return

			grid_up: 38, // Up arrow
			grid_down: 40, // Down arrow
			grid_left: 37, // Left arrow
			grid_right: 39, // Right arrow
			grid_confirm: 32 // Space
		};

		// Remove hex grid if window loses focus
		$j(window).blur((e) => {
			game.grid.showGrid(false);
		});

		// Binding Hotkeys
		$j(document).keydown((e) => {
			if (game.freezedInput) {
				return;
			}

			let keypressed = e.keyCode || e.which;
			//console.log(keypressed); // For debugging

			let prevD = false;
			let modifierPressed = (e.metaKey || e.altKey || e.ctrlKey);

			$j.each(hotkeys, (k, v) => {
				if (!modifierPressed && v == keypressed) {
					// Context filter
					if (this.dashopen) {
						switch (k) {
							case "close":
								this.closeDash();
								break;
							case "ultimate":
								this.closeDash();
								break;
							case "dash_materializeButton":
								this.materializeButton.triggerClick();
								break;
							case "dash_up":
								this.gridSelectUp();
								break;
							case "dash_down":
								this.gridSelectDown();
								break;
							case "dash_left":
								this.gridSelectLeft();
								break;
							case "dash_right":
								this.gridSelectRight();
								break;
						}
					} else {
						switch (k) {
							case "close":
								this.chat.hide();
								break; // Close chat if opened
							case "cycle":
								this.selectNextAbility();
								break;
							case "attack":
								this.abilitiesButtons[1].triggerClick();
								break;
							case "ability":
								this.abilitiesButtons[2].triggerClick();
								break;
							case "ultimate":
								this.abilitiesButtons[3].triggerClick();
								break;
							case "overview":
								this.btnToggleDash.triggerClick();
								break;
							case "audio":
								this.btnAudio.triggerClick();
								break;
							case "skip":
								this.btnSkipTurn.triggerClick();
								break;
							case "delay":
								this.btnDelay.triggerClick();
								break;
							case "flee":
								this.btnFlee.triggerClick();
								break;
							case "chat":
								this.chat.toggle();
								break;
							case "pause":
								game.togglePause();
								break; // Might get deprecated
							case "show_grid":
								game.grid.showGrid(true);
								break;

							case "grid_up":
								game.grid.selectHexUp();
								break;
							case "grid_down":
								game.grid.selectHexDown();
								break;
							case "grid_left":
								game.grid.selectHexLeft();
								break;
							case "grid_right":
								game.grid.selectHexRight();
								break;

							case "grid_confirm":
								game.grid.confirmHex();
								break;
						}
					}

					prevD = true;
				}
			});

			if (prevD) {
				e.preventDefault();
				return false;
			}
		});

		$j(document).keyup((e) => {
			if (game.freezedInput) {
				return;
			}

			let keypressed = e.keyCode || e.which;

			$j.each(hotkeys, (k, v) => {
				if (v == keypressed) {
					switch (k) {
						case "show_grid":
							game.grid.showGrid(false);
							break;
					}
				}
			});
		});

		// Mouse Shortcut
		$j("#dash").bind('mousedown', (e) => {
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
		// TODO: Function to exit dash via Tab or Esc hotkeys

		$j("#combatwrapper, #dash, #toppanel").bind('mousewheel', (e, delta, deltaX, deltaY) => {
			if (game.freezedInput) {
				return;
			}

			// Dash
			if (this.dashopen) {
				if (delta > 0) { // Wheel up
					this.gridSelectPrevious();
				} else if (delta < 0) { // Wheel down
					this.gridSelectNext();
				}
				// Abilities
			} else {
				if (delta > 0) { // Wheel up
					this.selectNextAbility();
					// TODO: Allow to cycle between the usable active abilities by pressing the passive one's icon
				} else if (delta < 0) { // Wheel down
					this.selectPreviousAbility();
				}
			}
		});

		for (let i = 0; i < 4; i++) {
			let b = new Button({
				$button: $j("#abilities > div:nth-child(" + (i + 1) + ") > .ability"),
				abilityId: i,
				css: {
					disabled: {
						"cursor": "help"
					},
					glowing: {
						"cursor": "pointer"
					},
					selected: {},
					active: {},
					noclick: {
						"cursor": "help"
					},
					normal: {
						"cursor": "default"
					},
				}
			}, game);
			this.buttons.push(b);
			this.abilitiesButtons.push(b);
		}

		this.materializeButton = new Button({
			$button: $j("#materialize_button"),
			css: {
				disabled: {},
				glowing: {
					"cursor": "pointer"
				},
				selected: {},
				active: {},
				noclick: {},
				normal: {
					"cursor": "default"
				},
			}
		}, game);

		this.$dash.children("#playertabswrapper").addClass("numplayer" + game.playerMode);

		this.selectedCreature = "";
		this.selectedPlayer = 0;
		this.selectedAbility = -1;

		this.queueAnimSpeed = 500; // ms
		this.dashAnimSpeed = 250; // ms

		this.materializeToggled = false;
		this.dashopen = false;

		this.glowInterval = setInterval(() => {
			let opa = 0.5 + Math.floor((1 + Math.sin(Math.floor(new Date() * Math.PI * 0.20) / 100)) / 4 * 100) / 100;

			this.buttons.forEach((btn) => {
				btn.$button.css("opacity", "");

				if (btn.state == "glowing") {
					btn.$button.css("opacity", opa);
				}
			});

			let opaWeak = opa / 2;

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
			$j(".turntime").text(time.getTimer(game.turnTimePool));
		}

		if (game.timePool) {
			$j(".timepool").text(time.getTimer(game.timePool));
		}

		$j("#tabwrapper a").removeAttr("href"); // Empty links

		// Show UI
		this.$display.show();
		this.$dash.hide();
	}

	showAbilityCosts(abilityId) {
		let game = this.game,
			creature = game.activeCreature,
			ab = creature.abilities[abilityId];

		if (ab.costs !== undefined) {
			if (typeof ab.costs.energy == "number") {
				let costsEnergy = ab.costs.energy + creature.stats.reqEnergy;
				this.energyBar.previewSize(costsEnergy / creature.stats.energy);
			} else {
				this.energyBar.previewSize(0);
			}
			if (typeof ab.costs.health == "number") {
				this.healthBar.previewSize(ab.costs.health / creature.stats.health);
			} else {
				this.healthBar.previewSize(0);
			}
		}
	}

	hideAbilityCosts() {
		this.energyBar.previewSize(0);
		this.healthBar.previewSize(0);
	}

	selectNextAbility() {
		let game = this.game,
			b = (this.selectedAbility == -1) ? 4 : this.selectedAbility;

		for (let i = (b - 1); i > 0; i--) {
			let creature = game.activeCreature;

			if (creature.abilities[i].require() && !creature.abilities[i].used) {
				this.abilitiesButtons[i].triggerClick();
				return;
			}
		}

		game.activeCreature.queryMove();
	}

	selectPreviousAbility() {
		let game = this.game,
			b = (this.selectedAbility == -1) ? 0 : this.selectedAbility;

		for (let i = (b + 1); i < 4; i++) {
			let creature = game.activeCreature;

			if (creature.abilities[i].require() && !creature.abilities[i].used) {
				this.abilitiesButtons[i].triggerClick();
				return;
			}
		}

		game.activeCreature.queryMove();
	}

	resizeDash() {
		let zoom1 = $j("#cardwrapper").innerWidth() / $j("#card").outerWidth(),
			zoom2 = $j("#cardwrapper").innerHeight() / ($j("#card").outerHeight() + $j("#materialize_button").outerHeight()),
			zoom = Math.min(zoom1, zoom2, 1);

		$j("#cardwrapper_inner").css({
			scale: zoom,
			"left": ($j("#cardwrapper").innerWidth() - $j("#card").innerWidth() * zoom) / 2,
			position: "absolute",
			margin: 0
		});

		zoom1 = $j("#creaturegridwrapper").innerWidth() / $j("#creaturegrid").innerWidth();
		zoom2 = $j("#creaturegridwrapper").innerHeight() / $j("#creaturegrid").innerHeight();
		zoom = Math.min(zoom1, zoom2, 1);

		$j("#creaturegrid").css({
			scale: zoom,
			"left": ($j("#creaturegridwrapper").innerWidth() - $j("#creaturegrid").innerWidth() * zoom) / 2,
			position: "absolute",
			margin: 0
		});
	}

	/* showCreature(creatureType, player)
	 *
	 * creatureType :	String :	Creature type
	 * player :		Integer :	Player ID
	 *
	 * Query a creature in the available creatures of the active player
	 *
	 */
	showCreature(creatureType, player) {
		let game = this.game;

		if (!this.dashopen) {
			this.$dash.show().css("opacity", 0);
			this.$dash.transition({
				opacity: 1
			}, this.dashAnimSpeed, "linear");
		}

		this.dashopen = true;

		if (player === undefined) {
			player = game.activeCreature.player.id;
		}

		// Set dash active
		this.$dash.addClass("active");
		this.$dash.children("#tooltip").removeClass("active");
		this.$dash.children("#playertabswrapper").addClass("active");
		this.changePlayerTab(game.activeCreature.team);
		this.resizeDash();

		this.$dash
			.children("#playertabswrapper")
			.children(".playertabs")
			.unbind('click')
			.bind('click', (e) => {
				if (game.freezedInput) {
					return;
				}

				this.showCreature("--", $j(this).attr("player") - 0);
			});

		// Update player info
		for (let i = game.players.length - 1; i >= 0; i--) {
			$j("#dash .playertabs.p" + i + " .vignette").css("background-image", "url('" + game.players[i].avatar + "')");
			$j("#dash .playertabs.p" + i + " .name").text(game.players[i].name);
			$j("#dash .playertabs.p" + i + " .plasma").text("Plasma " + game.players[i].plasma);
			$j("#dash .playertabs.p" + i + " .score").text("Score " + game.players[i].getScore().total);
			$j("#dash .playertabs.p" + i + " .units").text("Units " + game.players[i].getNbrOfCreatures() + " / " + game.creaLimitNbr);
		}

		// Change to the player tab
		if (player != this.selectedPlayer) {
			this.changePlayerTab(player);
		}

		this.$grid.children(".vignette").removeClass("active")
			.filter("[creature='" + creatureType + "']").addClass("active");

		this.selectedCreature = creatureType;

		let stats = game.retreiveCreatureStats(creatureType);

		// TODO card animation
		if ($j.inArray(creatureType, game.players[player].availableCreatures) > 0 || creatureType == "--") {
			// Retreive the selected unit
			this.selectedCreatureObj = undefined;
			game.players[player].creatures.forEach((creature) => {
				if (creature.type == creatureType) {
					this.selectedCreatureObj = creature;
				}
			});

			// Card A
			$j("#card .sideA").css({
				"background-image": "url('../cards/margin.png'), url('../units/artwork/" + stats.name + ".jpg')"
			});
			$j("#card .sideA .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin" + stats.type.substring(0, 1));
			$j("#card .sideA .type").text(stats.type);
			$j("#card .sideA .name").text(stats.name);
			$j("#card .sideA .hexes").html(stats.size + '<span>&#11041;</span>');

			// Card B
			$j("#card .sideB").css({
				"background-image": "url('../cards/margin.png'), url('../cards/" + stats.type.substring(0, 1) + ".jpg')"
			});
			$j.each(stats.stats, (key, value) => {
				let $stat = $j("#card .sideB ." + key + " .value");
				$stat.removeClass("buff debuff");
				if (this.selectedCreatureObj) {
					if (key == "health") {
						$stat.text(this.selectedCreatureObj.health + "/" + this.selectedCreatureObj.stats[key]);
					} else if (key == "movement") {
						$stat.text(this.selectedCreatureObj.remainingMove + "/" + this.selectedCreatureObj.stats[key]);
					} else if (key == "energy") {
						$stat.text(this.selectedCreatureObj.energy + "/" + this.selectedCreatureObj.stats[key]);
					} else if (key == "endurance") {
						$stat.text(this.selectedCreatureObj.endurance + "/" + this.selectedCreatureObj.stats[key]);
					} else {
						$stat.text(this.selectedCreatureObj.stats[key]);
					}
					if (this.selectedCreatureObj.stats[key] > value) { // Buff
						$stat.addClass("buff");
					} else if (this.selectedCreatureObj.stats[key] < value) { // Debuff
						$stat.addClass("debuff");
					}
				} else {
					$stat.text(value);
				}
			});
			$j.each(game.abilities[stats.id], (key, value) => {
				let $ability = $j("#card .sideB .abilities .ability:eq(" + key + ")");
				$ability.children('.icon').css({
					"background-image": "url('../units/abilities/" + stats.name + " " + key + ".svg')"
				});
				$ability.children(".wrapper").children(".info").children("h3").text(stats.ability_info[key].title);
				$ability.children(".wrapper").children(".info").children("#desc").text(stats.ability_info[key].desc);
				$ability.children(".wrapper").children(".info").children("#info").text(stats.ability_info[key].info);
				$ability.children(".wrapper").children(".info").children("#upgrade").text("Upgrade: " + stats.ability_info[key].upgrade);

				if (key !== 0) {
					$ability.children(".wrapper").children(".info").children("#cost").text(" - costs " + stats.ability_info[key].costs.energy + " energy pts.");
				} else {
					$ability.children(".wrapper").children(".info").children("#cost").text(" - this ability is passive.");
				}
			});

			let summonedOrDead = false;
			game.players[player].creatures.forEach((creature) => {
				if (creature.type == creatureType) {
					summonedOrDead = true;
				}
			});

			// Materialize button
			this.materializeButton.changeState("disabled");
			$j("#card .sideA").addClass("disabled").unbind("click");

			let activeCreature = game.activeCreature;
			if (activeCreature.player.getNbrOfCreatures() > game.creaLimitNbr) {
				$j('#materialize_button p').text(game.msg.dash.materialize_overload);
			} else if (!summonedOrDead && activeCreature.player.id === player && activeCreature.type === "--" && activeCreature.abilities[3].used === false) {
				let lvl = creatureType.substring(1, 2) - 0,
					size = game.retreiveCreatureStats(creatureType).size - 0,
					plasmaCost = lvl + size;

				// Messages (TODO: text strings in a new language file)
				if (plasmaCost > activeCreature.player.plasma) {
					$j('#materialize_button p').text("Low Plasma! Cannot materialize the selected unit");
				} else {
					$j('#materialize_button p').text("Materialize unit at target location for " + plasmaCost + " plasma");

					// Bind button

					this.materializeButton.click = (e) => {
						this.materializeToggled = false;
						this.selectAbility(3);
						this.closeDash();
						activeCreature.abilities[3].materialize(this.selectedCreature);
					};
					$j("#card .sideA").on("click", this.materializeButton.click);
					$j("#card .sideA").removeClass("disabled");
					this.materializeButton.changeState("glowing");
				}
			} else {
				if (activeCreature.player.id === player && activeCreature.type === "--" && activeCreature.abilities[3].used === true) {
					$j('#materialize_button p').text("Materialization has already been used this round");
				} else if (activeCreature.player.id === player && activeCreature.type === "--") {
					$j('#materialize_button p').text("Please select an available unit from the left grid");
				} else if (activeCreature.type != "--") {
					$j('#materialize_button p').text("The current active unit cannot materialize others");
				} else if (activeCreature.type === "--" && activeCreature.player.id != player) {
					$j('#materialize_button p').text("Switch to your own tab to be able to materialize");

					// Bind button
					this.materializeButton.click = (e) => {
						this.showCreature(creatureType, activeCreature.player.id);
					};
					$j("#card .sideA").on("click", this.materializeButton.click);
					$j("#card .sideA").removeClass("disabled");
					this.materializeButton.changeState("glowing");
				}
			}
		} else {
			// Card A
			$j("#card .sideA").css({
				"background-image": "url('../cards/margin.png'), url('../units/artwork/" + stats.name + ".jpg')"
			});
			$j("#card .sideA .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin" + stats.type.substring(0, 1));
			$j("#card .sideA .type").text(stats.type);
			$j("#card .sideA .name").text(stats.name);
			$j("#card .sideA .hexes").text(stats.size + "H");

			// Card B
			$j.each(stats.stats, (key, value) => {
				let $stat = $j("#card .sideB ." + key + " .value");
				$stat.removeClass("buff debuff");
				$stat.text(value);
			});

			// Abilities
			$j.each(stats.ability_info, (key, value) => {
				let $ability = $j("#card .sideB .abilities .ability:eq(" + key + ")");
				$ability.children('.icon').css({
					"background-image": "url('../units/abilities/" + stats.name + " " + key + ".svg')"
				});
				$ability.children(".wrapper").children(".info").children("h3").text(stats.ability_info[key].title);
				$ability.children(".wrapper").children(".info").children("#desc").html(stats.ability_info[key].desc);
				$ability.children(".wrapper").children(".info").children("#info").html(stats.ability_info[key].info);
				// Check for an upgrade
				if (stats.ability_info[key].upgrade) {
					$ability.children(".wrapper").children(".info").children("#upgrade").text("Upgrade: " + stats.ability_info[key].upgrade);
				} else {
					$ability.children(".wrapper").children(".info").children("#upgrade").text(" ");
				}
			});

			// Materialize button
			$j('#materialize_button').removeClass("glowing").unbind('click');
			$j("#card .sideA").addClass("disabled").unbind('click');
			$j('#materialize_button p').text("This unit is currently under heavy development");
		}
	}

	selectAbility(i) {
		this.checkAbilities();
		this.selectedAbility = i;

		if (i > -1) {
			this.showAbilityCosts(i);
			this.abilitiesButtons[i].changeState("active");
		} else {
			this.hideAbilityCosts();
		}
	}

	/* changePlayerTab(id)
	 *
	 * id :	Integer :	player id
	 *
	 * Change to the specified player tab in the dash
	 */
	changePlayerTab(id) {
		let game = this.game;

		this.selectedPlayer = id;
		this.$dash // Dash class
			.removeClass("selected0 selected1 selected2 selected3")
			.addClass("selected" + id);

		this.$grid.find(".vignette") // Vignettes class
			.removeClass("active dead queued notsummonable")
			.addClass("locked");

		$j("#tabwrapper").show();
		$j("#musicplayerwrapper").hide();

		// Change creature status
		game.players[id].availableCreatures.forEach((creature) => {
			this.$grid.find(".vignette[creature='" + creature + "']").removeClass("locked");

			let lvl = creature.substring(1, 2) - 0,
				size = game.retreiveCreatureStats(creature).size - 0,
				plasmaCost = lvl + size;

			if (plasmaCost > game.players[id].plasma) {
				this.$grid.find(".vignette[creature='" + creature + "']").addClass("notsummonable");
			}
		});

		game.players[id].creatures.forEach((creature) => {
			let $crea = this.$grid.find(".vignette[creature='" + creature.type + "']");

			$crea.removeClass("notsummonable");
			if (creature.dead === true) {
				$crea.addClass("dead");
			} else {
				$crea.addClass("queued");
			}
		});

		// Bind creature vignette click
		this.$grid.find(".vignette").unbind('click').bind("click", (e) => {
			e.preventDefault();
			if (game.freezedInput) {
				return;
			}

			if ($j(e.currentTarget).hasClass("locked")) {
				this.$dash.children("#tooltip").text("Creature locked.");
			}

			let creatureType = $j(e.currentTarget).attr("creature"); // CreatureType
			this.showCreature(creatureType, this.selectedPlayer);
		});
	}

	showMusicPlayer() {
		let game = this.game;

		this.$dash.addClass("active");
		this.showCreature(game.activeCreature.type, game.activeCreature.team);
		this.selectedPlayer = -1;

		// Dash class
		this.$dash.removeClass("selected0 selected1 selected2 selected3");

		$j("#tabwrapper").hide();
		$j("#musicplayerwrapper").show();
	}

	/* toggleDash()
	 *
	 * Show the dash and hide some buttons
	 * Takes optional 'randomize' parameter to select a random creature from the grid.
	 */

	toggleDash(randomize) {
    		let game = this.game;
		
		if (!this.$dash.hasClass("active")) {
			if (randomize) {
				const activePlayer = game.players[game.activeCreature.player.id];
				const deadOrSummonedTypes = activePlayer.creatures.map(creature => creature.type)
				const availableTypes = activePlayer.availableCreatures.filter(el => !deadOrSummonedTypes.includes(el))
				// Optional: randomize array to grab a new creature every toggle
				for (let i = availableTypes.length - 1; i > 0; i--) {
					let j = Math.floor(Math.random() * (i + 1));
					let temp = availableTypes[i];
					availableTypes[i] = availableTypes[j];
					availableTypes[j] = temp;
				}
				// Grab the first creature we can afford (if none, default to priest)
				let typeToPass = "--";
				availableTypes.some(creature => {
					const lvl = creature.substring(1, 2) - 0;
					const size = game.retreiveCreatureStats(creature).size - 0;
					const plasmaCost = lvl + size;
					return plasmaCost <= activePlayer.plasma ? ((typeToPass = creature), true) : false;
				});
				this.showCreature(typeToPass, game.activeCreature.team);
			} else {
				this.showCreature(game.activeCreature.type, game.activeCreature.team);
			}
		} else {
			this.closeDash();
		}
	}

	closeDash() {
		let game = this.game;
		
		this.$dash.removeClass("active");
		this.$dash.transition({
			opacity: 0,
			queue: false
		}, this.dashAnimSpeed, "linear", () => {
			this.$dash.hide();
		});
		
		if (this.materializeToggled && game.activeCreature && game.activeCreature.type === "--") {
			game.activeCreature.queryMove();
		}
		
		this.dashopen = false;
		this.materializeToggled = false;
	}

	gridSelectUp() {
		let game = this.game,
			b = this.selectedCreature;

		if (b == "--") {
			this.showCreature("W1");
			return;
		}

		if (game.realms.indexOf(b[0]) - 1 > -1) {
			let r = game.realms[game.realms.indexOf(b[0]) - 1];
			this.showCreature(r + b[1]);
		} else { // End of the grid
			//this.showCreature("--");
		}
	}

	gridSelectDown() {
		let game = this.game,
			b = this.selectedCreature;

		if (b == "--") {
			this.showCreature("A1");
			return;
		}

		if (game.realms.indexOf(b[0]) + 1 < game.realms.length) {
			let r = game.realms[game.realms.indexOf(b[0]) + 1];
			this.showCreature(r + b[1]);
		} else { // End of the grid
			//this.showCreature("--");
		}
	}

	gridSelectLeft() {
		let b = (this.selectedCreature == "--") ? "A0" : this.selectedCreature;

		if (b[1] - 1 < 1) { // End of row
			return;
		} else {
			this.showCreature(b[0] + (b[1] - 1));
		}
	}

	gridSelectRight() {
		let b = (this.selectedCreature == "--") ? "A8" : this.selectedCreature;

		if (b[1] - 0 + 1 > 7) { // End of row
			return;
		} else {
			this.showCreature(b[0] + (b[1] - 0 + 1));
		}
	}

	gridSelectNext() {
		let game = this.game,
			b = (this.selectedCreature == "--") ? "A0" : this.selectedCreature,
			valid;

		if (b[1] - 0 + 1 > 7) { // End of row
			if (game.realms.indexOf(b[0]) + 1 < game.realms.length) {
				let r = game.realms[game.realms.indexOf(b[0]) + 1];

				// Test If Valid Creature
				if ($j.inArray(r + "1", game.players[this.selectedPlayer].availableCreatures) > 0) {
					valid = true;

					for (let i = 0, len = game.players[this.selectedPlayer].creatures.length; i < len; i++) {
						let creature = game.players[this.selectedPlayer].creatures[i];

						if (creature instanceof Creature && creature.type == r + "1" && creature.dead) {
							valid = false;
						}
					}

					if (valid) {
						this.showCreature(r + "1");
						return;
					}
				}

				this.selectedCreature = r + "1";
			} else {
				return;
			}
		} else {
			// Test If Valid Creature
			if ($j.inArray(b[0] + (b[1] - 0 + 1), game.players[this.selectedPlayer].availableCreatures) > 0) {
				valid = true;

				for (let i = 0, len = game.players[this.selectedPlayer].creatures.length; i < len; i++) {
					let creature = game.players[this.selectedPlayer].creatures[i];

					if (creature instanceof Creature && creature.type == b[0] + (b[1] - 0 + 1) && creature.dead) {
						valid = false;
					}
				}

				if (valid) {
					this.showCreature(b[0] + (b[1] - 0 + 1));
					return;
				}
			}

			this.selectedCreature = b[0] + (b[1] - 0 + 1);
		}

		this.gridSelectNext();
	}

	gridSelectPrevious() {
		let game = this.game,
			b = (this.selectedCreature == "--") ? "W8" : this.selectedCreature,
			valid;

		if (b[1] - 1 < 1) { // End of row
			if (game.realms.indexOf(b[0]) - 1 > -1) {
				let r = game.realms[game.realms.indexOf(b[0]) - 1];

				// Test if valid creature
				if ($j.inArray(r + "7", game.players[this.selectedPlayer].availableCreatures) > 0) {
					valid = true;

					for (let i = 0, len = game.players[this.selectedPlayer].creatures.length; i < len; i++) {
						let creature = game.players[this.selectedPlayer].creatures[i];

						if (creature instanceof Creature && creature.type == r + "7" && creature.dead) {
							valid = false;
						}
					}

					if (valid) {
						this.showCreature(r + "7");
						return;
					}
				}

				this.selectedCreature = r + "7";
			} else {
				return;
			}
		} else {
			// Test if valid creature
			if ($j.inArray(b[0] + (b[1] - 1), game.players[this.selectedPlayer].availableCreatures) > 0) {
				valid = true;

				for (let i = 0, len = game.players[this.selectedPlayer].creatures.length; i < len; i++) {
					let creature = game.players[this.selectedPlayer].creatures[i];

					if (creature instanceof Creature && creature.type == b[0] + (b[1] - 1) && creature.dead) {
						valid = false;
					}
				}

				if (valid) {
					this.showCreature(b[0] + (b[1] - 1));
					return;
				}
			}

			this.selectedCreature = b[0] + (b[1] - 1);
		}

		this.gridSelectPrevious();
	}

	/* updateActiveBox()
	 *
	 * Update activebox with new current creature's abilities
	 */
	updateActivebox() {
		let game = this.game,
			creature = game.activeCreature,
			$abilitiesButtons = $j("#abilities .ability");

		$abilitiesButtons.unbind("click");
		this.$activebox.find("#abilities").clearQueue().transition({
			y: "-420px"
		}, 500, 'easeInQuart', () => { // Hide panel
			$j(this).removeClass("p0 p1 p2 p3").addClass("p" + creature.player.id);

			this.energyBar.setSize(creature.oldEnergy / creature.stats.energy);
			this.healthBar.setSize(creature.oldHealth / creature.stats.health);
			this.updateAbilityButtonsContent();

			// Change ability buttons
			this.abilitiesButtons.forEach((btn) => {
				let ab = creature.abilities[btn.abilityId];
				btn.css.normal = {
					"background-image": "url('../units/abilities/" + creature.name + " " + btn.abilityId + ".svg')"
				};
				let $desc = btn.$button.next(".desc");
				$desc.find("span.title").text(ab.title);
				$desc.find("p").html(ab.desc);

				btn.click = () => {
					if (this.selectedAbility != btn.abilityId) {
						if (this.dashopen) {
							return false;
						}

						game.grid.clearHexViewAlterations();
						let ab = game.activeCreature.abilities[btn.abilityId];
						// Passive ability icon can cycle between usable abilities
						if (btn.abilityId == 0) {
							let b = (this.selectedAbility == -1) ? 4 : this.selectedAbility;
							for (let i = (b - 1); i > 0; i--) {
								if (game.activeCreature.abilities[i].require() && !game.activeCreature.abilities[i].used) {
									this.abilitiesButtons[i].triggerClick();
								}
							}
						}

						// Colored frame around selected ability
						if (ab.require() == true && btn.abilityId != 0) {
							this.selectAbility(btn.abilityId);
						}
						// Activate Ability
						game.activeCreature.abilities[btn.abilityId].use();
					} else {
						game.grid.clearHexViewAlterations();
						// Cancel Ability
						this.closeDash();
						game.activeCreature.queryMove();
						this.selectAbility(-1);
					}
				};

				btn.mouseover = () => {
					if (this.selectedAbility == -1) {
						this.showAbilityCosts(btn.abilityId);
					};
				};

				btn.mouseleave = () => {
					if (this.selectedAbility == -1) {
						this.hideAbilityCosts();
					}
				};

				btn.changeState(); // Apply changes
			});

			this.$activebox.children("#abilities").transition({
				y: "0px"
			}, 500, 'easeOutQuart'); // Show panel
		});

		this.updateInfos();
	}

	updateAbilityButtonsContent() {
		let game = this.game,
			creature = game.activeCreature;

		// Change ability buttons
		this.abilitiesButtons.forEach((btn) => {
			let ab = creature.abilities[btn.abilityId];
			let $desc = btn.$button.next(".desc");

			// Change the ability's frame when it gets upgraded
			if (ab.isUpgraded()) {
				btn.$button.addClass('upgraded');
			} else {
				btn.$button.removeClass('upgraded');
			}

			// Add extra ability info
			let $abilityInfo = $desc.find(".abilityinfo_content");
			$abilityInfo.find(".info").remove();

			let costs_string = ab.getFormattedCosts();
			if (costs_string) {
				$abilityInfo.append(
					'<div class="info costs">' +
					'Costs : ' + costs_string +
					'</div>'
				);
			}

			let dmg_string = ab.getFormattedDamages();
			if (dmg_string) {
				$abilityInfo.append(
					'<div class="info damages">' +
					'Damages : ' + dmg_string +
					'</div>'
				);
			}

			let special_string = ab.getFormattedEffects();
			if (special_string) {
				$abilityInfo.append(
					'<div class="info special">' +
					'Effects : ' + special_string +
					'</div>'
				);
			}

			if (ab.hasUpgrade()) {
				if (!ab.isUpgraded()) {
					$abilityInfo.append(
						'<div class="info upgrade">' +
						(ab.isUpgradedPerUse() ? 'Uses' : 'Rounds') +
						' left before upgrading : ' + ab.usesLeftBeforeUpgrade() +
						'</div>'
					);
				}

				$abilityInfo.append(
					'<div class="info upgrade">' +
					'Upgrade : ' + ab.upgrade +
					'</div>'
				);
			}
		});
	}

	checkAbilities() {
		let game = this.game,
			oneUsableAbility = false;

		for (let i = 0; i < 4; i++) {
			let ab = game.activeCreature.abilities[i];
			ab.message = "";
			let req = ab.require();
			ab.message = (ab.used) ? game.msg.abilities.alreadyused : ab.message;
			if (req && !ab.used && ab.trigger == "onQuery") {
				this.abilitiesButtons[i].changeState("glowing");
				oneUsableAbility = true;
			} else if (ab.message == game.msg.abilities.notarget || (ab.trigger != "onQuery" && req && !ab.used)) {
				this.abilitiesButtons[i].changeState("noclick");
			} else {
				this.abilitiesButtons[i].changeState("disabled");
			}

			// Tooltip for passive ability to display if there is any usable abilities or not
			if (i === 0) {
				let b = (this.selectedAbility == -1) ? 4 : this.selectedAbility; // Checking usable abilities

				for (let j = (b - 1); j > 0; j--) {
					if (game.activeCreature.abilities[j].require() && !game.activeCreature.abilities[j].used) {
						ab.message = game.msg.abilities.passivecycle; // Message if there is any usable abilities
						break;
					} else {
						ab.message = game.msg.abilities.passiveunavailable; // Message if there is no usable abilities
					}
				}
			}

			// Charge
			this.abilitiesButtons[i].$button.next(".desc").find(".charge").remove();
			if (ab.getCharge !== undefined) {
				this.abilitiesButtons[i].$button.next(".desc").append('<div class="charge">Charge : ' + ab.getCharge().value + "/" + ab.getCharge().max + '</div>');
			}

			// Message
			this.abilitiesButtons[i].$button.next(".desc").find(".message").remove();
			if (ab.message !== "") {
				this.abilitiesButtons[i].$button.next(".desc").append('<div class="message">' + ab.message + '</div>');
			}
		}

		// No action possible
		if (!oneUsableAbility && game.activeCreature.remainingMove === 0) {
			//game.skipTurn( { tooltip: "Finished" } ); // Autoskip
			game.activeCreature.noActionPossible = true;
			this.btnSkipTurn.changeState("glowing");
		}
	}

	/* updateInfos()
	 */
	updateInfos() {
		let game = this.game;

		$j("#playerbutton, #playerinfo")
			.removeClass("p0 p1 p2 p3")
			.addClass("p" + game.activeCreature.player.id);
		$j("#playerinfo .name").text(game.activeCreature.player.name);
		$j("#playerinfo .points span").text(game.activeCreature.player.getScore().total);
		$j("#playerinfo .plasma span").text(game.activeCreature.player.plasma);
		// TODO: Needs to update instantly!
		$j("#playerinfo .units span").text(game.activeCreature.player.getNbrOfCreatures() + " / " + game.creaLimitNbr);
	}

	// Broken and deprecated
	showStatModifiers(stat) {
		if (this.selectedCreatureObj instanceof Creature) {
			let buffDebuff = this.selectedCreatureObj.getBuffDebuff(stat);
			let atLeastOneBuff = false;

			// Might not be needed
			$j(card).find("." + stat + " .modifiers").html("");
			// Effects
			$j.each(buffDebuff.objs.effects, (key, value) => {
				//let string = this.selectedCreatureObj.abilities[0].getFormattedDamages(value.alterations);
				if (value.alterations[stat]) {
					$j(card).find("." + stat + " .modifiers").append("<div>" + value.name + " : " + (value.alterations[stat] > 0 ? "+" : "") + value.alterations[stat] + "</div>");
				}

				atLeastOneBuff = true;
			});
			// Drops
			$j.each(buffDebuff.objs.drops, (key, value) => {
				//let string = this.selectedCreatureObj.abilities[0].getFormattedDamages(value.alterations);
				if (value.alterations[stat]) {
					$j(card).find("." + stat + " .modifiers").append("<div>" + value.name + " : " + (value.alterations[stat] > 0 ? "+" : "") + value.alterations[stat] + "</div>");
				}

				atLeastOneBuff = true;
			});

			if (!atLeastOneBuff) {
				$j(card).find("." + stat + " .modifiers").html('This stat doesn\'t have any modifiers');
			}
		}
	}

	/* updateTimer()
	 */
	updateTimer() {
		let game = this.game,
			date = new Date() - game.pauseTime;

		// TurnTimePool
		if (game.turnTimePool >= 0) {
			let remainingTime = game.turnTimePool - Math.round((date - game.activeCreature.player.startTime) / 1000);

			if (game.timePool > 0) {
				remainingTime = Math.min(remainingTime, Math.round((game.activeCreature.player.totalTimePool - (date - game.activeCreature.player.startTime)) / 1000));
			}

			let id = game.activeCreature.player.id;
			$j(".p" + id + " .turntime").text(time.getTimer(remainingTime));
			// Time Alert
			if (remainingTime < 6) {
				$j(".p" + id + " .turntime").addClass("alert");
			} else {
				$j(".p" + id + " .turntime").removeClass("alert");
			}

			// Time Bar
			let timeRatio = ((date - game.activeCreature.player.startTime) / 1000) / game.turnTimePool;
			this.timeBar.setSize(1 - timeRatio);
		} else {
			$j(".turntime").text("∞");
		}

		// TotalTimePool
		if (game.timePool >= 0) {
			game.players.forEach((player) => {
				let remainingTime = (player.id == game.activeCreature.player.id) ? player.totalTimePool - (date - player.startTime) : player.totalTimePool;
				remainingTime = Math.max(Math.round(remainingTime / 1000), 0);
				$j(".p" + player.id + " .timepool").text(time.getTimer(remainingTime));
			});

			// Time Bar
			let poolRatio = (game.activeCreature.player.totalTimePool - (date - game.activeCreature.player.startTime)) / 1000 / game.timePool;
			this.poolBar.setSize(poolRatio);
		} else {
			$j(".timepool").text("∞");
		}
	}

	/* updateQueueDisplay()
	 *
	 * Delete and add element to the Queue container based on the game's queues
	 * TODO: Ugly as hell need rewrite
	 */
	updateQueueDisplay(excludeActiveCreature) {
		let game = this.game;

		// Abort to avoid infinite loop
		if (game.queue.isNextEmpty() || !game.activeCreature) {
			return false;
		}

		let queueAnimSpeed = this.queueAnimSpeed;
		let transition = "linear";

		// Set transition duration for stat indicators
		this.$queue.find('.vignette .stats').css({
			transition: "height " + queueAnimSpeed + "ms"
		});

		// Updating
		let $vignettes = this.$queue.find('.vignette[verified!="-1"]').attr("verified", 0);

		let deleteVignette = (vignette) => {

			if ($j(vignette).hasClass("roundmarker")) {
				$j(vignette).attr("verified", -1).transition({
					x: -80,
					queue: false
				}, queueAnimSpeed, transition, () => {
					vignette.remove();
				});
			} else {
				if ($j(vignette).hasClass("active")) {
					$j(vignette).attr("verified", -1).transition({
						x: -100,
						queue: false
					}, queueAnimSpeed, transition, () => {
						vignette.remove();
					});
				} else {
					$j(vignette).attr("verified", -1).transition({
						x: "-=80",
						queue: false
					}, queueAnimSpeed, transition, () => {
						vignette.remove();
					});
				}
			}

			// Updating
			$vignettes = this.$queue.find('.vignette[verified!="-1"]');
		};

		let appendVignette = (pos, vignette) => {
			let $v, index, offset;
			// Create element
			if ($vignettes.length === 0) {
				$v = $j(vignette).prependTo(this.$queue);
				index = $v.index('#queuewrapper .vignette[verified != "-1"]');
				offset = (index - (!!index)) * 80 + (!!index) * 100 - 80;
			} else if ($vignettes[pos]) {
				$v = $j(vignette).insertAfter($vignettes[pos]);
				index = $v.index('#queuewrapper .vignette[verified != "-1"]');
				offset = (index - (!!index)) * 80 + (!!index) * 100 - 80;
			} else {
				$v = $j(vignette).appendTo(this.$queue);
				index = $v.index('#queuewrapper .vignette[verified != "-1"]');
				offset = (index - (!!index)) * 80 + (!!index) * 100 + 1000;
			}

			// Animation
			$v.attr("verified", 1)
				.css({
					x: offset
				})
				.transition({
					queue: true
				}, queueAnimSpeed, transition); // Dont know why but it must be here

			// Updating
			$vignettes = this.$queue.find('.vignette[verified != "-1"]');
		};

		let updatePos = () => {
			$vignettes.each((pos, vignette) => {
				let index = $j(vignette).index('#queuewrapper .vignette[verified != "-1"]');
				let offset = (index - (!!index)) * 80 + (!!index) * 100;
				$j(vignette).css({
					"z-index": 0 - index
				}).transition({
					x: offset,
					queue: false
				}, queueAnimSpeed, transition);
			});
		};

		this.$queue.find('.vignette[verified != "-1"]').each((pos, vignette) => {
			if ($j(vignette).attr("turn") < game.turn) {
				deleteVignette(vignette);
			}
		});

		let completeQueue = game.queue.queue.slice(0);
		if (!excludeActiveCreature) {
			completeQueue.unshift(game.activeCreature);
		}

		completeQueue = completeQueue.concat(["nextround"], game.queue.nextQueue);

		let u = 0;
		// Updating
		for (let i = 0, len = completeQueue.length; i < len; i++) {
			let queueElem;
			// Round Marker
			if (typeof completeQueue[i] == "string") {
				queueElem = '<div turn="' + (game.turn + u) + '" roundmarker="1" class="vignette roundmarker"><div class="frame"></div><div class="stats">Round ' + (game.turn + 1) + '</div></div>';

				// If this element does not exists
				if ($vignettes[i] === undefined) {
					// Create it
					appendVignette(i, queueElem);
				} else {
					// While its not the round marker
					while (i < $vignettes.length && $j($vignettes[i]).attr("roundmarker") === undefined) {
						deleteVignette($vignettes[i]);
					}
				}

				u++;
				// Creature Vignette
			} else {
				queueElem = '<div turn="' + (game.turn + u) + '" creatureid="' + completeQueue[i].id + '" class="vignette hidden p' + completeQueue[i].team + " type" + completeQueue[i].type + '"><div class="frame"></div><div class="overlay_frame"></div><div class="stats"></div></div>';

				// If this element does not exists
				if ($vignettes[i] === undefined) {
					// Create it
					appendVignette(i, queueElem);
				} else {
					// While it's not the right creature
					while (true) {
						let v = $vignettes[i];
						let $v = $j(v);
						let vid = parseInt($v.attr("creatureid"));

						if (vid === completeQueue[i].id) {
							break;
						}

						// Check if the vignette exists at all; if not delete
						if (!isNaN(vid) && $j.grep(completeQueue, (item) => item.id === vid).length === 0) {
							deleteVignette(v);
							continue;
						}

						if (isNaN(vid)) { // Is Round Marker
							// Create element before
							appendVignette(i - 1, queueElem);
						} else {
							// See if the creature has moved up the queue
							let found = false;
							for (let j = 0; j < i && !found; j++) {
								if (vid === completeQueue[j].id) {
									found = true;
								}
							}

							if (found) {
								// Create element before
								appendVignette(i - 1, queueElem);
							} else {
								// Remove element
								deleteVignette(v);
							}
						}
					}
				}
			}

			// Tag as verified
			$j($vignettes[i]).attr("verified", 1);
		}

		// Delete non verified
		deleteVignette(this.$queue.find('.vignette[verified="0"]'));

		updatePos();

		this.updateFatigue();

		// Set active creature
		this.$queue.find('.vignette.active').removeClass("active"); // Avoid bugs
		this.$queue.find('.vignette[verified="1"]')
			.first().clearQueue().addClass("active")
			.css({
				transformOrigin: '0px 0px'
			})
			.transition({
				scale: 1.25,
				x: 0
			}, queueAnimSpeed, transition);

		// Add mouseover effect

		this.$queue.find('.vignette.roundmarker').unbind("mouseover").unbind("mouseleave").bind("mouseover", (e) => {
			game.grid.showGrid(true);
		}).bind("mouseleave", (e) => {
			game.grid.showGrid(false);
		});

		this.$queue.find('.vignette').not(".roundmarker").unbind("mousedown").unbind("mouseover").unbind("mouseleave").bind("mouseover", (e) => {
			if (game.freezedInput) {
				return;
			}

			let creaID = $j(e.currentTarget).attr("creatureid") - 0;
			game.creatures.forEach((creature) => {
				if (creature instanceof Creature) {
					creature.xray(false);

					if (creature.id != creaID) {
						creature.xray(true);
						creature.hexagons.forEach((hex) => {
							hex.cleanOverlayVisualState();
						});
					} else {
						creature.hexagons.forEach((hex) => {
							hex.overlayVisualState("hover h_player" + creature.team);
						});
					}
				}
			});

			game.grid.showMovementRange(creaID);
			this.xrayQueue(creaID);
		}).bind("mouseleave", (e) => { // On mouseleave cancel effect
			if (game.freezedInput) {
				return;
			}

			// the mouse over adds a coloured hex to the creature, so when we mouse leave we have to remove them
			game.creatures.forEach((creature) => {
				if (creature instanceof Creature) {
					creature.hexagons.forEach((hex) => {
						hex.cleanOverlayVisualState();
					});
				}
			});

			game.grid.redoLastQuery();
			game.creatures.forEach((creature) => {
				if (creature instanceof Creature) {
					creature.xray(false);
				}
			});

			this.xrayQueue(-1);
		}).bind("mousedown", (e) => { // Show dash on click
			if (game.freezedInput) {
				return;
			}

			let creaID = $j(e.currentTarget).attr("creatureid") - 0;
			this.showCreature(game.creatures[creaID].type, game.creatures[creaID].player.id);
		});
	}

	xrayQueue(creaID) {
		this.$queue.find('.vignette').removeClass("xray");
		if (creaID > 0) {
			this.$queue.find('.vignette[creatureid="' + creaID + '"]').addClass("xray");
		}
	}
	
	bouncexrayQueue(creaID) {
	    this.xrayQueue(creaID);
		if (creaID > 0) 
			var $queueItem = this.$queue.find('.vignette[creatureid="' + creaID + '"]:first');
			if($queueItem.length > 0 && $queueItem.data("playingEffect") != true) {
			    $queueItem.data("playingEffect",true);
                $queueItem.effect( "bounce", { distance:-20,times: 1 },400,
                    setTimeout(function(){$queueItem.data("playingEffect",false); }, 600)
                );
			}
	}

	updateFatigue() {
		let game = this.game;

		game.creatures.forEach((creature) => {
			if (creature instanceof Creature) {
				let textElement = $j('#queuewrapper .vignette[creatureid="' + creature.id + '"]').children(".stats");

				textElement.css({
					background: 'black'
				});

				let text;
				if (creature.stats.frozen) {
					text = "Frozen";
					textElement.css({
						background: 'darkturquoise'
					});
				} else if (creature.materializationSickness) {
					text = "Sickened";
				} else if (creature.protectedFromFatigue || creature.stats.fatigueImmunity) {
					text = "Protected";
				} else if (creature.endurance > 0) {
					text = creature.endurance + "/" + creature.stats.endurance;
				} else if (creature.stats.endurance === 0) {
					text = "Fragile";
					// Display message if the creature has first become fragile
					if (creature.fatigueText !== text) {
						game.log("%CreatureName" + creature.id + "% has become fragile");
					}
				} else {
					text = "Fatigued";
				}

				if (creature.type == "--") { // If Dark Priest
					creature.abilities[0].require(); // Update protectedFromFatigue
				}

				textElement.text(text);
				this.fatigueText = text;
			}
		});
	}
};

