/*	Class UI
*
*	Object containing UI DOM element, update functions and event managment on UI.
*
*/
var UI = Class.create({

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
	*	selectedCreature : 	String : 	ID of the visible creature card
	*	selectedPlayer : 	Integer : 	ID of the selected player in the dash
	*
	*/


	/*	Constructor
	*	
	* 	Create attributes and default buttons
	*
	*/
	initialize: function(){
		this.$display = $j("#ui");
		this.$queue = $j("#queuewrapper");
		this.$dash = $j("#dash");
		this.$grid = $j("#creaturegrid");

		this.$button = $j("#end.button");
		this.$button.bind('click',function(e){ G.endTurn() });

		this.$button = $j("#toggledash.button");
		this.$button.bind('click',function(e){ G.UI.toggleDash() });

		this.$textbox = $j("#textbox > #textcontent");

		this.$activebox = $j("#activebox");

		this.selectedCreature = "";
		this.selectedPlayer = 0;
	},


	/*	queryCreature(fnCallback,optArgs)
	*	
	*	fnCallback : 	Function : 	Callback function used like this fnCallback(creatureType,optArgs)
	*	optArgs : 		Any : 		Optional argument for Callback function
	*
	* 	Query a creature in the available creatures of the active player
	*
	*/
	queryCreature: function(fnCallback,optArgs){
		G.UI.$dash.addClass("active"); //Show dash
		G.UI.$dash.children("#playertabswrapper").removeClass("active"); //Remove Player Tabs
		G.UI.changePlayerTab(G.activeCreature.team); //Change to active player grid

		this.$grid.children('.vignette:not([class*="locked"])').unbind('click').bind("click",function(){
			var creatureType = $j(this).attr("creature");
			if(creatureType == G.UI.selectedCreature){
				fnCallback(creatureType,optArgs); //Call the callback function
				G.UI.$dash.removeClass("active"); //Hide dash
				G.UI.$grid.children(".vignette").removeClass("active")
				G.UI.selectedCreature = "";
			}else{
				G.UI.showCreature(creatureType,G.UI.selectedPlayer);
			}
		});
	},


	/*	showCreature(creatureType,player)
	*	
	*	creatureType : 	String : 	Creature type
	*	player : 		Integer : 	Player ID
	*
	* 	Query a creature in the available creatures of the active player
	*
	*/
	showCreature: function(creatureType,player){
		if(player != G.UI.selectedPlayer){this.changePlayerTab(player);}

		this.$grid.children(".vignette").removeClass("active")
		.filter("[creature='"+creatureType+"']").addClass("active");

		this.selectedCreature = creatureType;
		//TODO Show card
	},


	/*	changePlayerTab(id)
	*
	*	id : 	Integer : 	player id
	*
	*	Change to the specified player tab in the dash
	*
	*/
	changePlayerTab: function(id){
		this.selectedPlayer = id;
		this.$dash //Dash class
		.removeClass("selected0 selected1 selected2 selected3")
		.addClass("selected"+id);

		this.$grid.children(".vignette") //vignettes class
		.removeClass("active");

		//change creature status
		G.players[id].availableCreatures.each(function(){
			G.UI.$grid.children(".vignette[creature='"+this+"']").removeClass("locked");
		});

		//Bind creature vignette click
		this.$grid.children(".vignette").unbind('click').bind("click",function(){
			var creatureType = $j(this).attr("creature");
			G.UI.showCreature(creatureType,G.UI.selectedPlayer);
		});

	},


	/*	toggleDash()
	*
	*	Show the dash and hide some buttons
	*
	*/
	toggleDash: function(){
		this.$dash.toggleClass("active");
		this.$dash.children("#playertabswrapper").addClass("active");
		this.changePlayerTab(G.activeCreature.team);

		this.$dash.children("#playertabswrapper").children(".playertabs").unbind('click').bind('click',function(e){
			G.UI.changePlayerTab($j(this).attr("player")-0);
		});

		//Change player infos
		for (var i = G.players.length - 1; i >= 0; i--) {
			$j("#dash .playertabs.p"+i+" .plasma").text("Plasma "+G.players[i].plasma);
		};

		//TODO Change Dash button to return
	},


	/*	updateActiveBox()
	*
	*	Update activebox with new current creature's abilities
	*
	*/
	updateActivebox: function(){

		var $abilitiesButtons = G.UI.$activebox.children("#abilities").children(".ability");
		$abilitiesButtons.unbind("click");

		this.$activebox.children("#abilities").transition({x:"-100px"},function(){//Hide panel	

			//Change active creature vignette
			G.UI.$activebox.children(".vignette").attr("class","vignette p"+G.activeCreature.team+" type"+G.activeCreature.type);

			//Change abilities buttons
			$abilitiesButtons.each(function(){
				var id = $j(this).attr("ability") - 0;
				$j(this).css("background-image","url('../bestiary/"+G.activeCreature.name+"/"+id+".svg')");
				$j(this).children(".desc").html(G.activeCreature.abilities[id].title+"<p>"+G.activeCreature.abilities[id].desc+"</p>");
				$j(this).bind('click', function(e){
					G.activeCreature.abilities[id].use() 
				});
			});

			G.UI.$activebox.children("#abilities").transition({x:"0px"}); //Show panel
		}); 
	},


	nextCreature: function(){
		this.$queue.children('div.vignette').first().attr("queue","-1").hide(750,function(){ this.remove(); });
		this.updateQueueDisplay();
		this.updateActivebox();
	},

	/*	updateQueueDisplay()
	*	
	* 	Delete and add element to the Queue container based on the game's queues
	*
	*/
	updateQueueDisplay: function(){ //Ugly as hell need rewrite

		var $vignettes = this.$queue.children('div.vignette');

		//QUEUE 0 (ACTIVE)
		if($vignettes.filter('[queue="0"]').size() == 0){
			$vignettes.each(function(){
				$j(this).attr("queue",$j(this).attr("queue")-1);
			});
		}

		//Prepend Current creature to queue after copying it
		var completeQueue = G.queue.slice(0);
		//completeQueue.unshift(G.activeCreature);

		var u = 0;
		
		while( $j(this.$queue).children('div.vignette').size() < 12 || 
			u < $j(this.$queue).children('div.vignette').attr("queue") ){
			var queue = (u==0)? completeQueue : G.nextQueue ;

			$Q = $vignettes.filter('[queue="'+u+'"]');

			for (var i = 0; i < queue.length; i++) {
				if($Q[i] == undefined){
					this.$queue.append('<div queue="'+u+'" creatureid="'+queue[i].id+'" initiative="'+queue[i].getInitiative()+'" class="vignette p'+queue[i].team+" type"+queue[i].type+'"></div>');
					$vignettes = this.$queue.children('div.vignette');
					$Q = $vignettes.filter('[queue="'+u+'"]');
					$Q.filter('[creatureid="'+queue[i].id+'"][queue="'+u+'"]').hide().show(750);
				}
				while( $j($Q[i]).attr("creatureid") != queue[i].id ){
					if( $j($Q[i]).attr("initiative") > queue[i].getInitiative() ) {
						$j($Q[i]).before('<div queue="'+u+'" creatureid="'+queue[i].id+'" initiative="'+queue[i].getInitiative()+'" class="vignette p'+queue[i].team+" type"+queue[i].type+'"></div>');
						this.$queue.children('div.vignette').filter('[creatureid="'+queue[i].id+'"][queue="'+u+'"]').hide().show(750);
					}else{
						$j($Q[i]).attr("queue","-1").hide(750,function(){
							this.remove();	
						});
					}
					$vignettes = this.$queue.children('div.vignette');
					$Q = $vignettes.filter('[queue="'+u+'"]');
				}
			};
			u++;
		}
	},

});

var uiButton = Class.create({
	initialize: function(cssClass,callbackFunction){
		//TODO
	},
});
