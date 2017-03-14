/*	Class UI
*
*	Object containing UI DOM element, update functions and event managment on UI.
*
*/
var UI = Class.create( {

	/*	Attributes
	*
	*	NOTE : attributes and variables starting with $ are jquery element
	*	and jquery function can be called dirrectly from them.
	*
	*	$display :		UI container
	*	$queue :		Queue container
	*	$textbox :		Chat and log container
	*	$activebox :	Current active creature panel (left panel) container
	*	$dash :			Overview container
	*	$grid :			Creature grid container
	*
	*	selectedCreature :	String :	ID of the visible creature card
	*	selectedPlayer :	Integer :	ID of the selected player in the dash
	*
	*/


	/*	Constructor
	*
	*	Create attributes and default buttons
	*
	*/
	initialize: function() {
		this.$display = $j("#ui");
		this.$queue = $j("#queuewrapper");
		this.$dash = $j("#dash");
		this.$grid = $j("#creaturegrid");
		this.$activebox = $j("#activebox");

		// Chat
		this.chat = new Chat();

		// Buttons Objects
		this.buttons = [];
		this.abilitiesButtons = [];

		// Dash Button
		this.btnToggleDash = new Button( {
			$button : $j(".toggledash"),
			click : function(e) { G.UI.toggleDash(); },
		});
		this.buttons.push(this.btnToggleDash);

		// Audio Button
		this.btnAudio = new Button( {
			$button : $j("#audio.button"),
			click : function(e) { if(!G.UI.dashopen) {
				G.UI.showMusicPlayer();
			}}
		});
		this.buttons.push(this.btnAudio);

		// Skip Turn Button
		this.btnSkipTurn = new Button( {
			$button : $j("#skip.button"),
			click : function(e) { if(!G.UI.dashopen) {
				if(G.turnThrottle) return;
				G.gamelog.add( { action: "skip" } );
				G.skipTurn();
			}},
		});
		this.buttons.push(this.btnSkipTurn);

		// Delay Unit Button
		this.btnDelay = new Button( {
			$button : $j("#delay.button"),
			click : function(e) { if(!G.UI.dashopen) {
				if (G.turnThrottle) return;
				if (G.activeCreature.hasWait ||
						!G.activeCreature.delayable ||
						G.queue.isCurrentEmpty()) {
					return;
				}
				G.gamelog.add( { action: "delay" } );
				G.delayCreature();
			}},
		});
		this.buttons.push(this.btnDelay);

		// Flee Match Button
		this.btnFlee = new Button( {
			$button : $j("#flee.button"),
			click : function(e) { if(!G.UI.dashopen) {
				if( G.turn < G.minimumTurnBeforeFleeing ) {
					alert("You cannot flee the match in the first 10 rounds.");
					return;
				}
				if( G.activeCreature.player.isLeader() ) {
					alert("You cannot flee the match while being in lead.");
					return;
				}

				if(window.confirm("Are you sure you want to flee the match?")) {
					G.gamelog.add( {action: "flee" } );
					G.activeCreature.player.flee();
				}
			} },
			state : "disabled",
		});
		this.buttons.push(this.btnFlee);

		// ProgessBar
		this.healthBar = new ProgessBar( { $bar : $j("#leftpanel .progressbar .bar.healthbar"), color : "red" } );
		this.energyBar = new ProgessBar( { $bar : $j("#leftpanel .progressbar .bar.energybar"), color : "yellow" } );
		this.timeBar = new ProgessBar( { $bar : $j("#rightpanel .progressbar .timebar"), color : "white" } );
		this.poolBar = new ProgessBar( { $bar : $j("#rightpanel .progressbar .poolbar"), color : "grey" } );

		this.showAbilityCosts = function(abilityId) {
			var creature = G.activeCreature;
			var ab = creature.abilities[abilityId];
			if(ab.costs !== undefined) {
				if( typeof ab.costs.energy == "number" ) {
					var costsEnergy = ab.costs.energy + creature.stats.reqEnergy;
					G.UI.energyBar.previewSize(costsEnergy / creature.stats.energy);
				}else{
					G.UI.energyBar.previewSize( 0 );
				}
				if( typeof ab.costs.health == "number" ) {
					G.UI.healthBar.previewSize(ab.costs.health / creature.stats.health);
				}else{
					G.UI.healthBar.previewSize( 0 );
				}
			}
		};

		this.hideAbilityCosts = function() {
			G.UI.energyBar.previewSize( 0 );
			G.UI.healthBar.previewSize( 0 );
		};

		// Volume Sliders
		$j("#effects_volume").slider( {
			step: 0.2,
			value: 5,
			min: 0,
			max: 10,
			slide: function( event, ui ) {
				G.soundsys.setEffectsVolume( ui.value/5 );
			}
		});

		var hotkeys = {
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

		// Binding Hotkeys
		$j(document).keydown(function(e) {
			if(G.freezedInput) return;

			var keypressed = e.keyCode || e.which;
			//console.log(keypressed); // For debugging

			var prevD = false;

			$j.each(hotkeys, function(k, v) {
				if(v==keypressed) {
					// Context filter
					if(G.UI.dashopen) {
						switch(k) {
							case "close": G.UI.closeDash(); break;
							case "ultimate": G.UI.closeDash(); break;
							case "dash_materializeButton": G.UI.materializeButton.triggerClick(); break;
							case "dash_up": G.UI.gridSelectUp(); break;
							case "dash_down": G.UI.gridSelectDown(); break;
							case "dash_left": G.UI.gridSelectLeft(); break;
							case "dash_right": G.UI.gridSelectRight(); break;
						}
					}else{
						switch(k) {
							case "close": G.UI.chat.hide(); break; // Close chat if opened
							case "cycle": G.UI.abilitiesButtons[0].triggerClick(); break; // TODO: Make this cycle through usable abilities
							case "attack": G.UI.abilitiesButtons[1].triggerClick(); break;
							case "ability": G.UI.abilitiesButtons[2].triggerClick(); break;
							case "ultimate": G.UI.abilitiesButtons[3].triggerClick(); break;
							case "overview": G.UI.btnToggleDash.triggerClick(); break;
							case "audio": G.UI.btnAudio.triggerClick(); break;
							case "skip": G.UI.btnSkipTurn.triggerClick(); break;
							case "delay": G.UI.btnDelay.triggerClick(); break;
							case "flee": G.UI.btnFlee.triggerClick(); break;
							case "chat": G.UI.chat.toggle(); break;
							case "pause": G.togglePause(); break; // Might get deprecated
							case "show_grid": G.grid.showGrid(true); break;

							case "grid_up": G.grid.selectHexUp(); break;
							case "grid_down": G.grid.selectHexDown(); break;
							case "grid_left": G.grid.selectHexLeft(); break;
							case "grid_right": G.grid.selectHexRight(); break;

							case "grid_confirm": G.grid.confirmHex(); break;
						}
					}
					prevD = true;
				}
			});
			if(prevD) {
				e.preventDefault();
				return false;
			}
		});

		$j(document).keyup(function(e) {
			if(G.freezedInput) return;

			var keypressed = e.keyCode || e.which;

			$j.each(hotkeys,function(k, v) {
				if(v==keypressed) {
					switch(k) {
						case "show_grid": G.grid.showGrid(false); break;
					}
				}
			});
		});

		// Mouse Shortcut
		$j("#dash").bind('mousedown', function(e) {
			if(G.freezedInput) return;

			switch (e.which) {
				case 1:
					// Left mouse button pressed
					break;
				case 2:
					// Middle mouse button pressed
					if(G.UI.dashopen) {
						G.UI.materializeButton.triggerClick();
					}
					break;
				case 3:
					// Right mouse button pressed
					if(G.UI.dashopen) {
						G.UI.closeDash();
					}
					break;
			}
		});
		// TODO: Function to exit dash via Tab or Esc hotkeys

		$j("#combatwrapper, #dash, #toppanel").bind('mousewheel', function(e, delta, deltaX, deltaY) {
			if(G.freezedInput) return;

			// Dash
			if(G.UI.dashopen ) {
				if(delta > 0) { // Wheel up
					G.UI.gridSelectPrevious();
				}else if(delta < 0) { // Wheel down
					G.UI.gridSelectNext();
				}

			// Abilities
			}else{
				if(delta > 0) { // Wheel up
					var b = ( G.UI.selectedAbility == -1 ) ? 4 :  G.UI.selectedAbility ;

					for (var i = (b-1); i > 0; i--) {
						if( G.activeCreature.abilities[i].require() && !G.activeCreature.abilities[i].used ) {
							G.UI.abilitiesButtons[i].triggerClick();
							return;
						}
					}

					G.activeCreature.queryMove();
				// TODO: Allow to cycle between the usable active abilities by pressing the passive one's icon
				}else if(delta < 0) { // Wheel down
					var b = ( G.UI.selectedAbility == -1 ) ? 0 :  G.UI.selectedAbility ;

					for (var i = (b+1); i < 4; i++) {
						if( G.activeCreature.abilities[i].require() && !G.activeCreature.abilities[i].used ) {
							G.UI.abilitiesButtons[i].triggerClick();
							return;
						}
					}

					G.activeCreature.queryMove();

				}
			}
		});

		for (var i = 0; i < 4; i++) {
			var b = new Button( {
				$button : $j("#abilities > div:nth-child("+(i+1)+") > .ability"),
				abilityId : i,
				css : {
					disabled	: {},
					glowing		: { "cursor": "pointer" },
					selected	: {},
					active		: {},
					noclick		: {},
					normal		: { "cursor": "default" },
				}
			});
			this.buttons.push(b);
			this.abilitiesButtons.push(b);
		}

		this.materializeButton = new Button( {
			$button : $j("#materialize_button"),
			css : {
				disabled	: {},
				glowing		: { "cursor": "pointer" },
				selected	: {},
				active		: {},
				noclick		: {},
				normal		: { "cursor": "default" },
			}
		});

		this.$dash.children("#playertabswrapper").addClass("numplayer"+G.playerMode);

		this.selectedCreature = "";
		this.selectedPlayer = 0;
		this.selectedAbility = -1;

		this.queueAnimSpeed = 500; // ms
		this.dashAnimSpeed = 250; // ms

		this.materializeToggled = false;
		this.dashopen = false;

		this.glowInterval = setInterval(function() {

			var opa =  0.5+Math.floor( (1 + Math.sin(  Math.floor( new Date()*Math.PI*0.20 )/100 ) ) / 4 *100)/100;

			G.UI.buttons.each(function() {
				this.$button.css("opacity","");

				if(this.state == "glowing") {
					this.$button.css("opacity",opa);
				}
			});

			opaWeak = opa/2;

			G.grid.allHexs.each(function() {

				if( this.overlayClasses.match(/creature/) ) {

					if( this.overlayClasses.match(/selected|active/) ) {

						if( this.overlayClasses.match(/weakDmg/) ) {

							this.overlay.alpha = opaWeak;
							return;
						}

						this.overlay.alpha = opa;
					}
				}
			});
		},10);


		if(G.turnTimePool) $j(".turntime").text(zfill(Math.floor(G.turnTimePool/60), 2)+":"+zfill(G.turnTimePool%60, 2));
		if(G.timePool) $j(".timepool").text(zfill(Math.floor(G.timePool/60), 2)+":"+zfill(G.timePool%60, 2));

		$j("#tabwrapper a").removeAttr("href"); // Empty links

		// Show UI
		this.$display.show();
		this.$dash.hide();
	},


	resizeDash: function() {
		var zoom1 = $j("#cardwrapper").innerWidth() / $j("#card").outerWidth();
		var zoom2 = $j("#cardwrapper").innerHeight() / ( $j("#card").outerHeight() + $j("#materialize_button").outerHeight() );
		var zoom = Math.min(zoom1, zoom2);
		zoom = Math.min(zoom,1);
		$j("#cardwrapper_inner").css( {
			scale: zoom,
			"left": ($j("#cardwrapper").innerWidth()-$j("#card").innerWidth()*zoom)/2,
			position: "absolute",
			margin: 0
		});

		var zoom1 = $j("#creaturegridwrapper").innerWidth()/$j("#creaturegrid").innerWidth();
		var zoom2 = $j("#creaturegridwrapper").innerHeight()/$j("#creaturegrid").innerHeight();
		zoom = Math.min(zoom1, zoom2);
		zoom = Math.min(zoom, 1);
		$j("#creaturegrid").css( {
			scale: zoom,
			"left": ($j("#creaturegridwrapper").innerWidth()-$j("#creaturegrid").innerWidth()*zoom)/2,
			position: "absolute",
			margin: 0
		});
	},


	/*	showCreature(creatureType, player)
	*
	*	creatureType :	String :	Creature type
	*	player :		Integer :	Player ID
	*
	*	Query a creature in the available creatures of the active player
	*
	*/
	showCreature: function(creatureType, player) {

		if(!this.dashopen) {
			this.$dash.show().css("opacity", 0);
			this.$dash.transition( { opacity: 1 }, this.dashAnimSpeed, "linear");
		}

		this.dashopen = true;

		if( player === undefined ) {
			player = G.activeCreature.player.id;
		}

		// Set dash active
		this.$dash.addClass("active");
		this.$dash.children("#tooltip").removeClass("active");
		this.$dash.children("#playertabswrapper").addClass("active");
		this.changePlayerTab(G.activeCreature.team);
		this.resizeDash();

		this.$dash.children("#playertabswrapper").children(".playertabs").unbind('click').bind('click', function(e) {
			if(G.freezedInput) return;
			G.UI.showCreature("--", $j(this).attr("player")-0);
		});

		// Update player info
		for (var i = G.players.length - 1; i >= 0; i--) {
			$j("#dash .playertabs.p"+i+" .vignette").css("background-image","url('" + G.players[i].avatar + "')");
			$j("#dash .playertabs.p"+i+" .name").text(G.players[i].name);
			$j("#dash .playertabs.p"+i+" .plasma").text("Plasma "+G.players[i].plasma);
			$j("#dash .playertabs.p"+i+" .score").text("Score "+G.players[i].getScore().total);
			$j("#dash .playertabs.p"+i+" .units").text("Units "+G.players[i].getNbrOfCreatures()+" / "+G.creaLimitNbr);
		}

		// Change to the player tab
		if(player != G.UI.selectedPlayer) { this.changePlayerTab(player); }

		this.$grid.children(".vignette").removeClass("active")
		.filter("[creature='"+creatureType+"']").addClass("active");

		this.selectedCreature = creatureType;

		var stats = G.retreiveCreatureStats(creatureType);

		// TODO card animation
		if( $j.inArray(creatureType, G.players[player].availableCreatures)>0 || creatureType=="--") {
			// Retreive the selected unit
			var crea = undefined;
			G.UI.selectedCreatureObj = undefined;
			G.players[player].creatures.each(function() {
				if(this.type == creatureType) {
					crea = this;
					G.UI.selectedCreatureObj = this;
				}
			});

			// Card A
			$j("#card .sideA").css( { "background-image": "url('../cards/margin.png'), url('../units/artwork/" + stats.name + ".jpg')" } );
			$j("#card .sideA .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin" + stats.type.substring(0, 1));
			$j("#card .sideA .type").text(stats.type);
			$j("#card .sideA .name").text(stats.name);
			$j("#card .sideA .hexs").html(stats.size + "&#11041;");

			// Card B
			$j("#card .sideB").css( { "background-image": "url('../cards/margin.png'), url('../cards/" + stats.type.substring(0, 1) + ".jpg')" } );
			$j.each(stats.stats,function(key, value) {
				var $stat = $j("#card .sideB ." + key + " .value");
				$stat.removeClass("buff debuff");
				if(crea) {
					if(key=="health") {
						$stat.text(crea.health + "/" + crea.stats[key]);
					}else if(key=="movement") {
						$stat.text(crea.remainingMove + "/" + crea.stats[key]);
					}else if(key=="energy") {
						$stat.text(crea.energy + "/" + crea.stats[key]);
					}else if(key=="endurance") {
						$stat.text(crea.endurance + "/" + crea.stats[key]);
					}else{
						$stat.text(crea.stats[key]);
					}
					if(crea.stats[key] > value) { // Buff
						$stat.addClass("buff");
					}else if(crea.stats[key] < value) { // Debuff
						$stat.addClass("debuff");
					}
				}else{
					$stat.text(value);
				}
			});
			$j.each(G.abilities[stats.id],function(key, value) {
				$ability = $j("#card .sideB .abilities .ability:eq(" + key + ")");
				$ability.children('.icon').css( { "background-image": "url('../units/abilities/" + stats.name + " " + key + ".svg')" } );
				$ability.children(".wrapper").children(".info").children("h3").text(stats.ability_info[key].title);
				$ability.children(".wrapper").children(".info").children("#desc").text(stats.ability_info[key].desc);
				$ability.children(".wrapper").children(".info").children("#info").text(stats.ability_info[key].info);
				$ability.children(".wrapper").children(".info").children("#upgrade").text("Upgrade: " + stats.ability_info[key].upgrade);

				if( key !== 0){
					$ability.children(".wrapper").children(".info").children("#cost").text(" - costs " + stats.ability_info[key].costs.energy + " energy pts.");
				}
				else{
					$ability.children(".wrapper").children(".info").children("#cost").text(" - this ability is passive.");
				}
			});

			var summonedOrDead = false;
			G.players[player].creatures.each(function() {
				if(this.type == creatureType) {
					summonedOrDead = true;
				}
			});

			// Materialize button
			this.materializeButton.changeState("disabled");
			$j("#card .sideA").addClass("disabled").unbind("click");

			if(G.activeCreature.player.getNbrOfCreatures() > G.creaLimitNbr) {
				$j('#materialize_button p').text(G.msg.ui.dash.materialize_overload);
			}else if(
				!summonedOrDead &&
				G.activeCreature.player.id === player &&
				G.activeCreature.type === "--" &&
				G.activeCreature.abilities[3].used === false
			)
			{
				var lvl = creatureType.substring(1, 2)-0;
				var size = G.retreiveCreatureStats(creatureType).size-0;
				plasmaCost = lvl+size;

				// Messages (TODO: text strings in a new language file)
				if(plasmaCost>G.activeCreature.player.plasma) {
					$j('#materialize_button p').text("Low Plasma! Cannot materialize the selected unit");
				}else{
					$j('#materialize_button p').text("Materialize unit at target location for " + plasmaCost + " plasma");

					// Bind button
					this.materializeButton.click = function(e) {
						G.UI.materializeToggled = true;
						G.UI.selectAbility(3);
						G.UI.closeDash(true);
						G.activeCreature.abilities[3].materialize(G.UI.selectedCreature);
					};
					$j("#card .sideA").on("click",this.materializeButton.click);
					$j("#card .sideA").removeClass("disabled");
					this.materializeButton.changeState("glowing");

				}

			}else{
				if (
					G.activeCreature.player.id === player &&
					G.activeCreature.type === "--" &&
					G.activeCreature.abilities[3].used === true
				) {
					$j('#materialize_button p').text("Materialization has already been used this round");
				}else if(
					G.activeCreature.player.id === player &&
					G.activeCreature.type === "--"
				) {
					$j('#materialize_button p').text("Please select an available unit from the left grid");
				}else if (G.activeCreature.type != "--") {
					$j('#materialize_button p').text("The current active unit cannot materialize others");
				}else if (
					G.activeCreature.type ==="--" &&
					G.activeCreature.player.id != player
				) {
					$j('#materialize_button p').text("Switch to your own tab to be able to materialize");

					// Bind button
					this.materializeButton.click = function(e) {
						G.UI.showCreature("--", G.activeCreature.player.id);
					};
					$j("#card .sideA").on("click",this.materializeButton.click);
					$j("#card .sideA").removeClass("disabled");
					this.materializeButton.changeState("glowing");

				}
			}

		}else{

			// Card A
			$j("#card .sideA").css( { "background-image": "url('../cards/margin.png'), url('../units/artwork/" + stats.name + ".jpg')" } );
			$j("#card .sideA .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin"+stats.type.substring(0, 1));
			$j("#card .sideA .type").text(stats.type);
			$j("#card .sideA .name").text(stats.name);
			$j("#card .sideA .hexs").text(stats.size + "H");

			// Card B
			$j.each(stats.stats,function(key, value) {
				var $stat = $j("#card .sideB ." + key + " .value");
				$stat.removeClass("buff debuff");
				$stat.text(value);
			});

			// Abilities
			$j.each(stats.ability_info,function(key, value) {
				$ability = $j("#card .sideB .abilities .ability:eq(" + key + ")");
				$ability.children('.icon').css( { "background-image": "url('../units/abilities/" + stats.name+" " + key + ".svg')" } );
				$ability.children(".wrapper").children(".info").children("h3").text(stats.ability_info[key].title);
				$ability.children(".wrapper").children(".info").children("#desc").html(stats.ability_info[key].desc);
				$ability.children(".wrapper").children(".info").children("#info").html(stats.ability_info[key].info);
			});

			// Materialize button
			$j('#materialize_button').removeClass("glowing").unbind('click');
			$j("#card .sideA").addClass("disabled").unbind('click');
			$j('#materialize_button p').text("This unit is currently under heavy development");
		}
	},


	selectAbility: function(i) {
		this.checkAbilities();
		this.selectedAbility = i;
		if( i>-1 ) {
			G.UI.showAbilityCosts(i);
			this.abilitiesButtons[i].changeState("active");
		}
		else {
			G.UI.hideAbilityCosts();
		}
	},


	/*	changePlayerTab(id)
	*
	*	id :	Integer :	player id
	*
	*	Change to the specified player tab in the dash
	*
	*/
	changePlayerTab: function(id) {
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
		G.players[id].availableCreatures.each(function() {
			G.UI.$grid.find(".vignette[creature='"+this+"']").removeClass("locked");

			var lvl = this.substring(1, 2)-0;
			var size = G.retreiveCreatureStats(this).size-0;
			plasmaCost = lvl+size;

			if( plasmaCost > G.players[id].plasma ) {
				G.UI.$grid.find(".vignette[creature='"+this+"']").addClass("notsummonable");
			}
		});

		G.players[id].creatures.each(function() {
			var $crea = G.UI.$grid.find(".vignette[creature='" + this.type + "']");
			$crea.removeClass("notsummonable");
			if(this.dead === true) {
				$crea.addClass("dead");
			}else{
				$crea.addClass("queued");
			}
		});

		// Bind creature vignette click
		this.$grid.find(".vignette").unbind('click').bind("click", function(e) {
			e.preventDefault();
			if(G.freezedInput) return;

			if($j(this).hasClass("locked")) {
				G.UI.$dash.children("#tooltip").text("Creature locked.");
			}

			var creatureType = $j(this).attr("creature");
			G.UI.showCreature(creatureType,G.UI.selectedPlayer);
		});

	},

	showMusicPlayer: function() {
		this.$dash.addClass("active");

		this.showCreature(G.activeCreature.type, G.activeCreature.team);

		this.selectedPlayer = -1;

		this.$dash // Dash class
			.removeClass("selected0 selected1 selected2 selected3");

		$j("#tabwrapper").hide();
		$j("#musicplayerwrapper").show();
	},

	/*	toggleDash()
	*
	*	Show the dash and hide some buttons
	*
	*/
	toggleDash: function() {
		if(!this.$dash.hasClass("active")) {
			this.showCreature(G.activeCreature.type, G.activeCreature.team);
		}else{
			this.closeDash();
		}

	},

	closeDash: function(materialize) {
		this.$dash.removeClass("active");
		this.$dash.transition( { opacity: 0, queue: false }, this.dashAnimSpeed, "linear", function() {
			G.UI.$dash.hide();
		});
		if(!materialize && G.activeCreature ) {
			G.activeCreature.queryMove();
		}
		this.dashopen = false;
		this.materializeToggled = false;
	},

	gridSelectUp: function() {
		var b = G.UI.selectedCreature ;

		if( b == "--") {
			G.UI.showCreature("W1");
			return;
		}

		if( G.realms.indexOf(b[0])-1 > -1 ) {
			var r = G.realms[ G.realms.indexOf(b[0])-1 ];
			G.UI.showCreature(r+b[1]);
		}else{ // End of the grid
			//G.UI.showCreature("--");
		}
	},

	gridSelectDown: function() {
		var b = G.UI.selectedCreature ;

		if( b == "--") {
			G.UI.showCreature("A1");
			return;
		}

		if( G.realms.indexOf(b[0])+1 < G.realms.length ) {
			var r = G.realms[ G.realms.indexOf(b[0])+1 ];
			G.UI.showCreature(r+b[1]);
		}else{ // End of the grid
			//G.UI.showCreature("--");
		}
	},

	gridSelectLeft: function() {
		var b = ( G.UI.selectedCreature == "--" ) ? "A0" :  G.UI.selectedCreature ;

		if( b[1]-1 < 1 ) { // End of row
			return;
		}else{
			G.UI.showCreature( b[0] + (b[1]-1) );
		}
	},

	gridSelectRight: function() {
		var b = ( G.UI.selectedCreature == "--" ) ? "A8" :  G.UI.selectedCreature ;

		if( b[1]-0+1 > 7 ) { // End of row
			return;
		}else{
			G.UI.showCreature( b[0] + (b[1]-0+1) );
		}
	},

	gridSelectNext: function() {
		var b = ( G.UI.selectedCreature == "--" ) ? "A0" :  G.UI.selectedCreature ;

		if( b[1]-0+1 > 7 ) { // End of row
			if( G.realms.indexOf(b[0])+1 < G.realms.length ) {
				var r = G.realms[ G.realms.indexOf(b[0])+1 ];

				// Test If Valid Creature
				if( $j.inArray( r+"1" , G.players[this.selectedPlayer].availableCreatures)>0	) {
					var valid = true;
					for (var i = 0; i < G.players[ this.selectedPlayer ].creatures.length; i++) {
						var crea = G.players[ this.selectedPlayer ].creatures[i];
						if( crea instanceof Creature && crea.type == r+"1" && crea.dead ) {
							var valid = false;
						}
					}

					if( valid ) {
						G.UI.showCreature( r+"1" );
						return;
					}
				}
				G.UI.selectedCreature = r+"1";
			}else{
				return;
			}
		}else{

			// Test If Valid Creature
			if( $j.inArray( b[0]+(b[1]-0+1), G.players[this.selectedPlayer].availableCreatures)>0	) {
				var valid = true;
				for (var i = 0; i < G.players[ this.selectedPlayer ].creatures.length; i++) {
					var crea = G.players[ this.selectedPlayer ].creatures[i];
					if( crea instanceof Creature && crea.type == b[0]+(b[1]-0+1) && crea.dead ) {
						var valid = false;
					}
				}

				if( valid ) {
					G.UI.showCreature( b[0] + (b[1]-0+1) );
					return;
				}
			}
			G.UI.selectedCreature = b[0] + (b[1]-0+1);
		}
		G.UI.gridSelectNext();
	},

	gridSelectPrevious: function() {
		var b = ( G.UI.selectedCreature == "--" ) ? "W8" :  G.UI.selectedCreature ;

		if( b[1]-1 < 1 ) { // End of row
			if( G.realms.indexOf(b[0])-1 > -1 ) {
				var r = G.realms[ G.realms.indexOf(b[0])-1 ];

				// Test if valid creature
				if( $j.inArray( r+"7", G.players[this.selectedPlayer].availableCreatures)>0	) {
					var valid = true;
					for (var i = 0; i < G.players[ this.selectedPlayer ].creatures.length; i++) {
						var crea = G.players[ this.selectedPlayer ].creatures[i];
						if( crea instanceof Creature && crea.type == r+"7" && crea.dead ) {
							var valid = false;
						}
					}

					if( valid ) {
						G.UI.showCreature( r+"7" );
						return;
					}
				}
				G.UI.selectedCreature = r+"7";
			}else{
				return;
			}
		}else{

			// Test if valid creature
			if( $j.inArray( b[0] + (b[1]-1), G.players[this.selectedPlayer].availableCreatures)>0 ) {
				var valid = true;
				for (var i = 0; i < G.players[ this.selectedPlayer ].creatures.length; i++) {
					var crea = G.players[ this.selectedPlayer ].creatures[i];
					if( crea instanceof Creature && crea.type == b[0] + (b[1]-1) && crea.dead ) {
						var valid = false;
					}
				}

				if( valid ) {
					G.UI.showCreature( b[0] + (b[1]-1) );
					return;
				}
			}
			G.UI.selectedCreature = b[0] + (b[1]-1);
		}
		G.UI.gridSelectPrevious();
	},

	/*	updateActiveBox()
	*
	*	Update activebox with new current creature's abilities
	*
	*/
	updateActivebox: function() {
		var creature = G.activeCreature;
		var $abilitiesButtons = $j("#abilities .ability");
		$abilitiesButtons.unbind("click");

		this.$activebox.find("#abilities").clearQueue().transition( { y: "-420px" }, 500, 'easeInQuart', function() { // Hide panel
			$j(this).removeClass("p0 p1 p2 p3").addClass("p"+creature.player.id);

			G.UI.energyBar.setSize(creature.oldEnergy/creature.stats.energy);
			G.UI.healthBar.setSize(creature.oldHealth/creature.stats.health);

			G.UI.updateAbilityButtonsContent();

			// Change ability buttons
			G.UI.abilitiesButtons.each(function() {
				var ab = creature.abilities[this.abilityId];
				this.css.normal = {
					"background-image": "url('../units/abilities/" + creature.name + " " + this.abilityId + ".svg')"				};
				var $desc = this.$button.next(".desc");
				$desc.find("span.title").text(ab.title);
				$desc.find("p").html(ab.desc);

				this.click = function() {
					if(G.UI.selectedAbility != this.abilityId) {
						if(G.UI.dashopen) return false;
						G.grid.clearHexViewAlterations();
						var ab = G.activeCreature.abilities[this.abilityId];
					// Passive ability icon can cycle between usable abilities
                                        if(this.abilityId == 0)
                                                {
							var b = ( G.UI.selectedAbility == -1 ) ? 4 :  G.UI.selectedAbility ;
							for (var i = (b-1); i > 0; i--)
							{
							if( G.activeCreature.abilities[i].require() && !G.activeCreature.abilities[i].used )
								{
								G.UI.abilitiesButtons[i].triggerClick();
								}
							}
						}
					if(ab.require() == true && this.abilityId != 0) // Colored frame around selected ability
						{
							G.UI.selectAbility(this.abilityId);
						}
						// Activate Ability
						G.activeCreature.abilities[this.abilityId].use();
					}else{
						G.grid.clearHexViewAlterations();
						G.UI.selectAbility(-1);
						// Cancel Ability
						G.UI.closeDash();
						G.activeCreature.queryMove();
					}
				};

				this.mouseover = function() {
					if(G.UI.selectedAbility == -1) {
						G.UI.showAbilityCosts(this.abilityId);
					};
				}
				this.mouseleave = function() {
					if(G.UI.selectedAbility == -1) {
						G.UI.hideAbilityCosts();
					}
				}
				this.changeState(); // Apply changes
			});
			G.UI.$activebox.children("#abilities").transition( { y: "0px" }, 500, 'easeOutQuart'); // Show panel
		});

		this.updateInfos();
	},

	updateAbilityButtonsContent: function() {
		var creature = G.activeCreature;

		// Change ability buttons
		this.abilitiesButtons.each(function() {
			var ab = creature.abilities[this.abilityId];
			var $desc = this.$button.next(".desc");

			// Change the ability's frame when it gets upgraded
			if(ab.isUpgraded()) this.$button.addClass('upgraded');
			else this.$button.removeClass('upgraded');

			// Add extra ability info
			var $abilityInfo = $desc.find(".abilityinfo_content");
			$abilityInfo.find(".info").remove();

			var costs_string = ab.getFormatedCosts();
			if (costs_string) {
				$abilityInfo.append(
					'<div class="info costs">' +
					'Costs : ' + costs_string +
					'</div>'
				);
			}
			var dmg_string = ab.getFormatedDamages();
			if (dmg_string) {
				$abilityInfo.append(
					'<div class="info damages">' +
					'Damages : ' + dmg_string +
					'</div>'
				);
			}
			var special_string = ab.getFormatedEffects();
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
	},

	checkAbilities : function() {
		var oneUsableAbility = false;

		for (var i = 0; i < 4; i++) {
			var ab = G.activeCreature.abilities[i];
			ab.message = "";
			var req = ab.require();
			ab.message = (ab.used) ? G.msg.abilities.alreadyused : ab.message;
			if( req && !ab.used && ab.trigger == "onQuery") {
				this.abilitiesButtons[i].changeState("glowing");
				oneUsableAbility = true;
			}else if( ab.message==G.msg.abilities.notarget || ( ab.trigger != "onQuery" && req && !ab.used ) ) {
				this.abilitiesButtons[i].changeState("noclick");
			}else{
				this.abilitiesButtons[i].changeState("disabled");
			}
			if(i===0) // Tooltip for passive ability to display if there is any usable abilities or not
				{
					var b = ( G.UI.selectedAbility == -1 ) ? 4 :  G.UI.selectedAbility ; // Checking usable abilities
					for (var j = (b-1); j > 0; j--)
					{
						if( G.activeCreature.abilities[j].require() && !G.activeCreature.abilities[j].used )
						{
							ab.message =G.msg.abilities.passivecycle; // Message if there is any usable abilities
							break;
						}
						else
						{
							ab.message =G.msg.abilities.passiveunavailable; // Message if there is no usable abilities
						}
					}
				}

			// Charge
			this.abilitiesButtons[i].$button.next(".desc").find(".charge").remove();
			if( ab.getCharge !== undefined ) {
				this.abilitiesButtons[i].$button.next(".desc").append('<div class="charge">Charge : ' + ab.getCharge().value + "/" + ab.getCharge().max + '</div>');
			}

			// Message
			this.abilitiesButtons[i].$button.next(".desc").find(".message").remove();
			if( ab.message !== "" ) {
				this.abilitiesButtons[i].$button.next(".desc").append('<div class="message">' + ab.message + '</div>');
			}
		}

		// No action possible
		if( !oneUsableAbility && G.activeCreature.remainingMove === 0 ) {
			//G.skipTurn( { tooltip: "Finished" } ); // Autoskip
			G.activeCreature.noActionPossible = true;
			this.btnSkipTurn.changeState("glowing");
		}
	},

	/*	updateInfos()
	*
	*/
	updateInfos:function() {
		$j("#playerbutton, #playerinfo")
			.removeClass("p0 p1 p2 p3")
			.addClass("p"+G.activeCreature.player.id);
		$j("#playerinfo .name").text(G.activeCreature.player.name);
		$j("#playerinfo .points span").text(G.activeCreature.player.getScore().total);
		$j("#playerinfo .plasma span").text(G.activeCreature.player.plasma);
		$j("#playerinfo .units span").text(G.activeCreature.player.getNbrOfCreatures()+" / "+G.creaLimitNbr); // TODO: Needs to update instantly!
	},

	showStatModifiers: function(stat) { // Broken and deprecated

		if( G.UI.selectedCreatureObj instanceof Creature ) {
			var buffDebuff = G.UI.selectedCreatureObj.getBuffDebuff(stat);
			var atLeastOneBuff = false;
			// Might not be needed
			$j(card).find("."+stat+" .modifiers").html("");
			// Effects
			$j.each(buffDebuff.objs.effects, function(key, value) {
				//var string = G.UI.selectedCreatureObj.abilities[0].getFormatedDamages(value.alterations);
				if( value.alterations[stat] ) $j(card).find("." + stat + " .modifiers").append("<div>" + value.name + " : " + (value.alterations[stat] > 0 ? "+" : "")+value.alterations[stat] + "</div>");
				atLeastOneBuff = true;
			});
			// Drops
			$j.each(buffDebuff.objs.drops, function(key, value) {
				//var string = G.UI.selectedCreatureObj.abilities[0].getFormatedDamages(value.alterations);
				if( value.alterations[stat] ) $j(card).find("." + stat + " .modifiers").append("<div>" + value.name + " : "+(value.alterations[stat] > 0 ? "+" : "")+value.alterations[stat] + "</div>");
				atLeastOneBuff = true;
			});

			if(!atLeastOneBuff) {
				$j(card).find("."+stat+" .modifiers").html('This stat doesn\'t have any modifiers');
			}
		}

	},

	/*	updateTimer()
	*
	*/
	updateTimer:function() {
		var date = new Date() - G.pauseTime;

		// TurnTimePool
		if( G.turnTimePool >= 0 ) {
			var remainingTime = G.turnTimePool - Math.round((date - G.activeCreature.player.startTime) / 1000);
			if(G.timePool > 0)
				remainingTime = Math.min(remainingTime, Math.round( (G.activeCreature.player.totalTimePool-(date - G.activeCreature.player.startTime)) / 1000) );
			var minutes = Math.floor(remainingTime / 60);
			var seconds = remainingTime - minutes * 60;
			var id = G.activeCreature.player.id;
			$j(".p"+id+" .turntime").text(zfill(minutes, 2)+ ":" + zfill(seconds, 2));
			// Time Alert
			if( remainingTime < 6 )
				$j(".p"+id+" .turntime").addClass("alert");
			else
				$j(".p"+id+" .turntime").removeClass("alert");

			// Time Bar
			var timeRatio = ( (date - G.activeCreature.player.startTime) / 1000 ) / G.turnTimePool;
			G.UI.timeBar.setSize( 1 - timeRatio );
		}else{
			$j(".turntime").text("∞");
		}

		// TotalTimePool
		if( G.timePool >= 0 ) {
			G.players.each(function() {
				var remainingTime = (this.id == G.activeCreature.player.id) ? this.totalTimePool - (date - this.startTime) : this.totalTimePool;
				remainingTime = Math.max(Math.round(remainingTime / 1000), 0);
				var minutes = Math.floor(remainingTime / 60);
				var seconds = remainingTime - minutes * 60;
				$j(".p" + this.id + " .timepool").text(zfill(minutes, 2) + ":" + zfill(seconds, 2));
			});

			// Time Bar
			var poolRatio = ( G.activeCreature.player.totalTimePool - (date - G.activeCreature.player.startTime) ) / 1000 / G.timePool;
			G.UI.poolBar.setSize( poolRatio );
		}else{
			$j(".timepool").text("∞");
		}

	},


	/*	updateQueueDisplay()
	*
	*	Delete and add element to the Queue container based on the game's queues
	*
	*/
	updateQueueDisplay: function(excludeActiveCreature) { // Ugly as hell need rewrite

		if (G.queue.isNextEmpty() || !G.activeCreature) return false; // Abort to avoid infinite loop

		var queueAnimSpeed = this.queueAnimSpeed;
		var transition = "linear";

		// Set transition duration for stat indicators
		this.$queue.find('.vignette .stats').css( { transition: "height " + queueAnimSpeed + "ms" } );

		// Updating
		var $vignettes = this.$queue.find('.vignette[verified!="-1"]').attr("verified", 0);

		var deleteVignette = function(vignette) {

			if( $j( vignette ).hasClass("roundmarker") ) {
					$j( vignette ).attr("verified", -1).transition( { x: -80, queue: false }, queueAnimSpeed, transition, function() { this.remove(); } );
			}else{
				if( $j( vignette ).hasClass("active") ) {
					$j( vignette ).attr("verified", -1).transition( { x: -100, queue: false }, queueAnimSpeed, transition, function() { this.remove(); } );
				}else{
					$j( vignette ).attr("verified", -1).transition( { x: "-=80", queue: false }, queueAnimSpeed, transition, function() { this.remove(); } );
				}
			}

			// Updating
			$vignettes = G.UI.$queue.find('.vignette[verified!="-1"]');
		};

		var appendVignette = function(pos, vignette) {
			var $v, index, offset;
			// Create element
			if( $vignettes.length === 0 ) {
				$v = $j( vignette ).prependTo( G.UI.$queue );
				index = $v.index('#queuewrapper .vignette[verified != "-1"]');
				offset = (index-(!!index))*80 + (!!index)*100 -80;
			}else if( $vignettes[pos] ) {
				$v = $j( vignette ).insertAfter( $vignettes[pos] );
				index = $v.index('#queuewrapper .vignette[verified != "-1"]');
				offset = (index-(!!index))*80 + (!!index)*100 -80;

			}else{
				$v = $j( vignette ).appendTo( G.UI.$queue );
				index = $v.index('#queuewrapper .vignette[verified != "-1"]');
				offset = (index-(!!index)) * 80 + (!!index) * 100 + 1000;
			}

			// Animation
			$v.attr("verified",1)
				.css( { x: offset } )
				.transition( { queue: true }, queueAnimSpeed, transition); // Dont know why but it must be here

			// Updating
			$vignettes = G.UI.$queue.find('.vignette[verified != "-1"]');
		};

		var updatePos = function() {

			$vignettes.each(function() {
				var index = $j(this).index('#queuewrapper .vignette[verified != "-1"]');
				var offset = (index-(!!index)) * 80 + (!!index) * 100;
				$j(this).css( { "z-index": 0-index } ).transition( { x: offset, queue: false }, queueAnimSpeed, transition);
			});
		};

		this.$queue.find('.vignette[verified != "-1"]').each(function() {
			if( $j(this).attr("turn") < G.turn ) {
				deleteVignette( this );
			}
		});

		var completeQueue = G.queue.queue.slice(0);
		if (!excludeActiveCreature) {
			completeQueue.unshift(G.activeCreature);
		}
		completeQueue = completeQueue.concat(["nextround"], G.queue.nextQueue);

		var u = 0;

		// Updating
		for (var i = 0; i < completeQueue.length; i++) {
			var queueElem;
			// Round Marker
			if( typeof completeQueue[i] == "string" ) {

				queueElem = '<div turn="' + (G.turn+u) + '" roundmarker="1" class="vignette roundmarker"><div class="frame"></div><div class="stats">Round ' + (G.turn + 1) + '</div></div>';

				// If this element does not exists
				if( $vignettes[i] === undefined ) {
					// Create it
					appendVignette(i, queueElem);
				}else{
					// While its not the round marker
					while (i < $vignettes.length &&
							$j($vignettes[i]).attr("roundmarker") === undefined) {
						deleteVignette($vignettes[i]);
					}
				}
				u++;

			// Creature Vignette
			}else{

				queueElem = '<div turn="' + (G.turn+u) + '" creatureid="' + completeQueue[i].id + '" class="vignette hidden p' + completeQueue[i].team + " type" + completeQueue[i].type + '"><div class="frame"></div><div class="overlay_frame"></div><div class="stats"></div></div>';

				// If this element does not exists
				if( $vignettes[i] === undefined ) {
					// Create it
					appendVignette(i, queueElem);
				}else{
					// While it's not the right creature
					while (true) {
						var v = $vignettes[i];
						var $v = $j(v);
						var vid = parseInt($v.attr("creatureid"));
						if (vid === completeQueue[i].id) {
							break;
						}

						// Check if the vignette exists at all; if not delete
						if (!isNaN(vid) && $j.grep(completeQueue, function(item) {
							return item.id === vid;
						}).length === 0) {
							deleteVignette(v);
							continue;
						}

						if (isNaN(vid)) { // Is Round Marker
							// Create element before
							appendVignette(i-1, queueElem);
						} else {
							// See if the creature has moved up the queue
							var found = false;
							for (var j = 0; j < i && !found; j++) {
								if (vid === completeQueue[j].id) {
									found = true;
								}
							}
							if (found) {
								// Create element before
								appendVignette(i-1, queueElem);
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
		deleteVignette( this.$queue.find('.vignette[verified="0"]') );

		updatePos();

		this.updateFatigue();

		// Set active creature
		this.$queue.find('.vignette.active').removeClass("active"); // Avoid bugs
		this.$queue.find('.vignette[verified="1"]')
			.first().clearQueue().addClass("active")
			.css( { transformOrigin: '0px 0px' } )
			.transition( { scale : 1.25, x : 0 }, queueAnimSpeed, transition);

		// Add mouseover effect

		this.$queue.find('.vignette.roundmarker').unbind("mouseover").unbind("mouseleave").bind("mouseover", function() {
			G.grid.showGrid(true);
		}).bind("mouseleave",function() {
			G.grid.showGrid(false);
		});

		this.$queue.find('.vignette').not(".roundmarker").unbind("mousedown").unbind("mouseover").unbind("mouseleave").bind("mouseover", function() {
			if(G.freezedInput) return;
			var creaID = $j(this).attr("creatureid")-0;
			G.grid.showMovementRange(creaID);
			G.creatures.each(function() {
				if(this instanceof Creature) {
					this.xray(false);
					if(this.id != creaID) { this.xray(true); }
				}
			});
			G.UI.xrayQueue(creaID);
		}).bind("mouseleave",function() { // On mouseleave cancel effect
			if(G.freezedInput) return;
			G.grid.redoLastQuery();
			G.creatures.each(function() {
				if(this instanceof Creature) {
					this.xray(false);
				}
			});
			G.UI.xrayQueue(-1);
		}).bind("mousedown",function() { // Show dash on click
			if(G.freezedInput) return;
			var creaID = $j(this).attr("creatureid")-0;
			G.UI.showCreature(G.creatures[creaID].type,G.creatures[creaID].player.id);
		});

	},

	xrayQueue : function(creaID) {
		this.$queue.find('.vignette').removeClass("xray");
		if(creaID>0) this.$queue.find('.vignette[creatureid="'+creaID+'"]').addClass("xray");
	},

	updateFatigue : function() {

		G.creatures.each(function() {
			if (this instanceof Creature) {
				var textElement = $j('#queuewrapper .vignette[creatureid="' + this.id + '"]').children(".stats");
				textElement.css({background: 'black'});
				var text;
				if (this.stats.frozen) {
					text = "Frozen";
					textElement.css({background: 'darkturquoise'});
				} else if (this.materializationSickness) {
					text = "Sickened";
				} else if (this.protectedFromFatigue || this.stats.fatigueImmunity) {
					text = "Protected";
				} else if (this.endurance > 0) {
					text = this.endurance + "/" + this.stats.endurance;
				} else if (this.stats.endurance === 0) {
					text = "Fragile";
					// Display message if the creature has first become fragile
					if (this.fatigueText !== text) {
						G.log("%CreatureName" + this.id + "% has become fragile");
					}
				} else {
					text = "Fatigued";
				}

				if(this.type == "--") { // If Dark Priest
					this.abilities[0].require(); // Update protectedFromFatigue
				}

				textElement.text(text);
				this.fatigueText = text;
			}
		});

	}

});

var Chat = Class.create( {
	/*	Constructor
	*
	*	Chat/Log Functions
	*
	*/
	initialize: function() {
		this.$chat = $j("#chat");
		this.$content = $j("#chatcontent");
		this.$chat.bind( 'click',function() { G.UI.chat.toggle(); } );
		$j("#combatwrapper, #toppanel, #dash, #endscreen").bind('click',function() { G.UI.chat.hide(); } );
	},


	show : function() { this.$chat.addClass("focus"); },
	hide : function() { this.$chat.removeClass("focus"); },
	toggle : function() { this.$chat.toggleClass("focus"); this.$content.parent().scrollTop(this.$content.height()); },

	addMsg : function(msg,htmlclass) {
		var time = new Date(new Date() - G.startMatchTime);
		this.$content.append("<p class='"+htmlclass+"'><i>"+zfill(time.getUTCHours(), 2)+":"+zfill(time.getMinutes(), 2)+":"+zfill(time.getSeconds(), 2)+"</i> "+msg+"</p>");
		this.$content.parent().scrollTop(this.$content.height());
	},
});


var Button = Class.create( {
	/*	Constructor
	*
	*	Create attributes and default buttons
	*
	*/
	initialize: function(opts) {

		defaultOpts = {
			click : function() {},
			mouseover : function() {},
			mouseleave : function() {},
			clickable : true,
			state : "normal", // disabled,normal,glowing,selected,active
			$button : undefined,
			attributes : {},
			css : {
				disabled	: {},
				glowing		: {},
				selected	: {},
				active		: {},
				normal		: {},
			}
		};

		opts = $j.extend(defaultOpts, opts);
		$j.extend(this, opts);
		this.changeState(this.state);
	},


	changeState : function(state) {
		var btn = this;

		state = state || this.state;
		this.state = state;
		this.$button.unbind("click").unbind("mouseover").unbind("mouseleave");
		if( state != "disabled" ) {
			this.$button.bind("click",function() {
				if(G.freezedInput || !btn.clickable) return;
				btn.click();
			} );
			this.$button.bind("mouseover",function() {
				if(G.freezedInput || !btn.clickable) return;
				btn.mouseover();
			} );
			this.$button.bind("mouseleave",function() {
				if(G.freezedInput || !btn.clickable) return;
				btn.mouseleave();
			} );
		}
		this.$button.removeClass("disabled glowing selected active noclick");
		this.$button.css( this.css["normal"] );

		if( state != "normal" ) {
			this.$button.addClass(state);
			this.$button.css( this.css[state] );
		}
	},

	triggerClick : function() {
		if(G.freezedInput || !this.clickable) return;
		this.click();
	},

	triggerMouseover : function() {
		if(G.freezedInput || !this.clickable) return;
		this.mouseover();
	},

	triggerMouseleave : function() {
		if(G.freezedInput || !this.clickable) return;
		this.mouseleave();
	},
});

var ProgessBar = Class.create( {

	initialize: function(opts) {
		defaultOpts = {
			height : 318,
			width : 9,
			color : "red",
			$bar : undefined
		};

		opts = $j.extend(defaultOpts, opts);
		$j.extend(this,opts);

		this.$bar.append('<div class="previewbar"></div>');
		this.$preview = this.$bar.children(".previewbar");

		this.setSize(1);
	},

	/*	setSize
	*
	*	percentage :	Float :	Size between 0 and 1
	*
	*/
	setSize: function(percentage) {
		this.$bar.css( {
			width : this.width,
			height : this.height*percentage,
			"background-color" : this.color,
		});
	},

	/*	animSize
	*
	*	percentage :	Float :	size between 0 and 1
	*
	*/
	animSize: function(percentage) {
		this.$bar.transition( {
			queue : false,
			width : this.width,
			height : this.height*percentage,
		},500,"linear");
	},

	/*	previewSize
	*
	*	percentage :	Float :	size between 0 and 1
	*
	*/
	previewSize: function(percentage) {
		this.$preview.css( {
			width : this.width-2,
			height : (this.height-2)*percentage,
		},500,"linear");
	}
});
