/*	HexGrid Class
*
*	Object containing grid and hexagons DOM element and methods concerning the whole grid 
*	Should only have one instance during the game.
*
*/
var HexGrid = Class.create({

	/*	Attributes
	*	
	*	NOTE : attributes and variables starting with $ are jquery element 
	*	and jquery function can be called dirrectly from them.
	*
	*	//Jquery attributes
	*	$display : 		Grid container 
	*	$creatureW : 	Creature Wrapper container
	*	$inptHexsW : 	Input Hexagons container
	*	$dispHexsW : 	Display Hexagons container
	*	$overHexsW : 	Overlay Hexagons container
	*	$allInptHex : 	Shortcut to all input hexagons DOM elements (for input events)
	*	$allDispHex : 	Shortcut to all display hexagons DOM elements (to change style of hexagons)
	*	
	*	//Normal attributes
	*	hexs : 				Array : 	Contain all hexs in row arrays (hexs[y][x])
	*	lastClickedHex : 	Hex : 		Last hex clicked!
	*
	*/


	/*	Constructor
	*	
	* 	Create attributes and populate JS grid with Hex objects
	*
	*/
	initialize: function(opts){
		defaultOpt = {
			nbrRow  		: 9,
			nbrHexsPerRow 	: 16,
			firstRowFull	: false,
		}

		opts = $j.extend(defaultOpt,opts);

		this.hexs 				= new Array(); //Hex Array
		this.traps 				= new Array(); //Traps Array
		this.allHexs			= new Array(); //All hexs
		this.lastClickedHex 	= []; //Array of hexagons containing last calculated pathfinding
		
		this.display 			= G.Phaser.add.group(undefined,"displayGrp");
		this.display.x = 230;
		this.display.y = 380;

		this.gridGroup 			= G.Phaser.add.group(this.display,"gridGrp");
		this.gridGroup._container.scale = {x:1,y:.75};

		this.trapGroup			= G.Phaser.add.group(this.gridGroup ,"trapGrp");
		this.dispHexsGroup		= G.Phaser.add.group(this.gridGroup ,"dispHexsGrp");
		this.overHexsGroup		= G.Phaser.add.group(this.gridGroup, "overHexsGrp");
		this.dropGroup 			= G.Phaser.add.group(this.display, "dropGrp");
		this.creatureGroup 		= G.Phaser.add.group(this.display, "creaturesGrp");
		this.inptHexsGroup		= G.Phaser.add.group(this.gridGroup, "inptHexsGrp");

		//Populate grid
		for (var row = 0; row < opts.nbrRow; row++) {
			this.hexs.push(new Array());
			for (var hex = 0; hex < opts.nbrHexsPerRow; hex++) {
				if( hex == opts.nbrHexsPerRow-1 ){
					if( row % 2 == 0 && !opts.firstRowFull ) continue;
					if( row % 2 == 1 && opts.firstRowFull ) continue;
				}
				this.hexs[row][hex] = new Hex(hex,row,this);	
				this.allHexs.push(this.hexs[row][hex]);
			};
		};

		this.selectedHex = this.hexs[0][0];
	},

	querySelf: function(o){
		var defaultOpt = {
			fnOnConfirm : function(crea,args){},
			fnOnSelect : function(crea,args){},
			fnOnCancel : function(crea,args){},
			args : {}
		};

		o = $j.extend(defaultOpt,o);

		o.fnOnConfirm(G.activeCreature,o.args);
	},

	/* 	queryDirection(o)
	*
	*	Shortcut to queryChoice with specific directions
	*	
	*	fnOnSelect : 		Function : 	Function applied when clicking on one of the available hexs.
	*	fnOnConfirm : 		Function : 	Function applied when clicking again on the same hex.
	*	fnOnCancel : 		Function : 	Function applied when clicking a non reachable hex
	*	team : 				Integer : 	0 = ennemies, 1 = allies, 2 = same team, 3 = both
	*	requireCreature : 	Boolean : 	Disable a choice if it does not contain a creature matching the team argument
	* 	args : 				Object : 	Object given to the events function (to easily pass variable for these function)
	*/
	queryDirection: function(o){
		var defaultOpt = {
			team : 0,
			id : 0,
			flipped : false,
			x : 0,
			y : 0,
			hexsDashed : [],
			directions : [1,1,1,1,1,1],
			includeCrea : true,
			stopOnCreature : true,
			distance : 0,
			sourceCreature : undefined,
		};

		o = $j.extend(defaultOpt,o);

		//This is alway true
		o.isDirectionsQuery = true;

		//Clean Direction
		G.grid.forEachHexs(function(){ this.direction = -1; });
		
		var choices = [] 

		for (var i = 0; i < o.directions.length; i++) {
			if(!!o.directions[i]){
				var dir = []
				var fx = 0

				if( o.sourceCreature instanceof Creature ){
					if( (!o.sourceCreature.player.flipped && i>2) || (o.sourceCreature.player.flipped && i<3) ){
						fx =  -1*(o.sourceCreature.size-1);
					}
				}

				switch(i){
					case 0: //Upright
						dir = G.grid.getHexMap(o.x+fx,o.y-8,0,o.flipped,diagonalup).reverse();
						break;
					case 1: //StraitForward
						dir = G.grid.getHexMap(o.x+fx,o.y,0,o.flipped,straitrow);
						break;
					case 2: //Downright
						dir = G.grid.getHexMap(o.x+fx,o.y,0,o.flipped,diagonaldown);
						break;
					case 3: //Downleft
						dir = G.grid.getHexMap(o.x+fx,o.y,-4,o.flipped,diagonalup);
						break;
					case 4: //StraitBackward
						dir = G.grid.getHexMap(o.x+fx,o.y,0,!o.flipped,straitrow);
						break;
					case 5: //Upleft
						dir = G.grid.getHexMap(o.x+fx,o.y-8,-4,o.flipped,diagonaldown).reverse();
						break;
					default:
						break;
				}

				if( o.distance > 0 ) dir = dir.slice(0,o.distance+1);

				dir.each(function(){ 
					this.direction = (o.flipped)?5-i:i; 
					if(o.stopOnCreature) o.hexsDashed.push(this); 
				});

				dir.filterCreature(o.includeCrea,o.stopOnCreature,o.id,o.team);

				if(dir.length==0) continue;

				if( o.stopOnCreature && o.includeCrea && (i==1 || i==4)){ // Only straight direction
					if(dir.last().creature instanceof Creature)
						dir = dir.concat(dir.last().creature.hexagons); //Add full creature
				}

				dir.each(function(){ o.hexsDashed.removePos(this); });
				
				choices.push(dir);
			}
		};
		
		o.choices = choices;	

		G.grid.queryChoice(o);
	},


	/*
	*	queryChoice(o)
	*	
	*	fnOnSelect : 		Function : 	Function applied when clicking on one of the available hexs.
	*	fnOnConfirm : 		Function : 	Function applied when clicking again on the same hex.
	*	fnOnCancel : 		Function : 	Function applied when clicking a non reachable hex
	*	team : 				Integer : 	0 = ennemies, 1 = allies, 2 = same team, 3 = both
	*	requireCreature : 	Boolean : 	Disable a choice if it does not contain a creature matching the team argument
	* 	args : 				Object : 	Object given to the events function (to easily pass variable for these function)
	*/
	queryChoice: function(o){
		var defaultOpt = {
			fnOnConfirm : function(choice,args){ G.activeCreature.queryMove(); },
			fnOnSelect : function(choice,args){
				choice.each(function(){
					if(this.creature instanceof Creature){
						this.overlayVisualState("creature selected player"+this.creature.team);	
					}else{
						this.displayVisualState("adj");
					}
					
				});
			},
			fnOnCancel : function(hex,args){G.activeCreature.queryMove()},
			team : 0, 
			requireCreature : 1,
			id : 0,
			args : {},
			flipped : false,
			choices : [],
			hexsDashed : [],
			isDirectionsQuery : false,
		};

		o = $j.extend(defaultOpt,o);

		var hexs = [];
		for (var i = 0; i < o.choices.length; i++) {
			var validChoice = true;

			if(o.requireCreature){
				validChoice = false;
				//Search each hex for a creature that matches the team argument
				for (var j = 0; j < o.choices[i].length; j++) {
					if( o.choices[i][j].creature instanceof Creature && o.choices[i][j].creature!=o.id ){
						var creaSource = G.creatures[o.id];
						var creaTarget = o.choices[i][j].creature;

						var isAllie = ( creaSource.team%2 == creaTarget.team%2 );
						switch(o.team){
							case 0: //Ennemies
								if(creaSource.team%2!=creaTarget.team%2) validChoice = true;
								break;
							case 1: //Allies
								if(creaSource.team%2==creaTarget.team%2) validChoice = true;
								break;
							case 2: //Same team
								if(creaSource.team==creaTarget.team) validChoice = true;
								break;
							case 3: //Both
								validChoice = true;
								break;
						}
					}
				}
			}

			if(validChoice) hexs = hexs.concat(o.choices[i]);
			else if(o.isDirectionsQuery){
				G.grid.forEachHexs(function(){ 
					if(o.choices[i][0].direction==this.direction) 
						o.hexsDashed.removePos(this); 
				});
			}
		};

		this.queryHexs({
			fnOnConfirm : function(hex,args){
				//Determine which set of hexs (choice) the hex is part of
				for (var i = 0; i < args.opt.choices.length; i++) {
					for (var j = 0; j < args.opt.choices[i].length; j++) {
						if(hex.pos==args.opt.choices[i][j].pos){
							args.opt.args.direction = hex.direction;
							args.opt.fnOnConfirm(args.opt.choices[i],args.opt.args);
							break;
						}
					};
				};
			},
			fnOnSelect : function(hex,args){
				//Determine which set of hexs (choice) the hex is part of
				for (var i = 0; i < args.opt.choices.length; i++) {
					for (var j = 0; j < args.opt.choices[i].length; j++) {
						if(hex.pos==args.opt.choices[i][j].pos){
							args.opt.args.direction = hex.direction;
							args.opt.fnOnSelect(args.opt.choices[i],args.opt.args);
							break;
						}
					};
				};
			},
			fnOnCancel : o.fnOnCancel,
			args : {opt : o},
			hexs : hexs,
			hexsDashed : o.hexsDashed,
			flipped : o.flipped,
			hideNonTarget : true,
			id : o.id
		});
	},

	/* 	queryCreature(o)
	*
	*	fnOnSelect : 	Function : 	Function applied when clicking on one of the available hexs.
	*	fnOnConfirm : 	Function : 	Function applied when clicking again on the same hex.
	*	fnOnCancel : 	Function : 	Function applied when clicking a non reachable hex
	*	team : 			Integer : 	0 = ennemies, 1 = allies, 2 = same team, 3 = both
	*	id : 			Integer : 	Creature ID
	* 	args : 			Object : 	Object given to the events function (to easily pass variable for these function)
	*/
	queryCreature: function(o){

		var defaultOpt = {
			fnOnConfirm : function(crea,args){ G.activeCreature.queryMove(); },
			fnOnSelect : function(crea,args){ crea.tracePosition({ overlayClass: "creature selected player"+crea.team }); },
			fnOnCancel : function(hex,args){G.activeCreature.queryMove()},
			optTest : function(crea){ return true; },
			args : {},
			hexs : [],
			hexsDashed : [],
			flipped : false,
			id : 0,
			team : 0,
		};

		o = $j.extend(defaultOpt,o);

		//Exclude everything but the creatures
		o.hexs.filter(function(){
			if( this.creature instanceof Creature && this.creature.id!=o.id ){

				if( !o.optTest(this) ) return false;

				var creaSource = G.creatures[o.id];
				var creaTarget = this.creature;

				var isAllie = creaSource.isAlly( creaTarget.team );
				switch(o.team){
					case 0: //Ennemies
						if( !isAllie ) return true;
						break;
					case 1: //Allies
						if( isAllie ) return true;
						break;
					case 2: //Same team
						if( creaSource.team==creaTarget.team ) return true;
						break;
					case 3: //Both
						return true;
						break;
				}
			}
			return false;
		});

		var extended = [];
		o.hexs.each(function(){	extended = extended.concat(this.creature.hexagons); });

		o.hexs = extended;

		this.queryHexs({
			fnOnConfirm : function(hex,args){
				var crea = hex.creature;
				args.opt.fnOnConfirm(crea,args.opt.args);
			},
			fnOnSelect : function(hex,args){
				var crea = hex.creature;
				args.opt.fnOnSelect(crea,args.opt.args);
			},
			fnOnCancel : o.fnOnCancel,
			args : {opt : o},
			hexs : o.hexs,
			hexsDashed : o.hexsDashed,
			flipped : o.flipped,
			hideNonTarget : true,
			id : o.id
		});

	},

	redoLastQuery: function(){
		this.queryHexs(this.lastQueryOpt);
	},


	/*	queryHexs(x, y, distance, size)
	*
	*	fnOnSelect : 	Function : 	Function applied when clicking on one of the available hexs.
	*	fnOnConfirm : 	Function : 	Function applied when clicking again on the same hex.
	*	fnOnCancel : 	Function : 	Function applied when clicking a non reachable hex
	* 	args : 			Object : 	Object given to the events function (to easily pass variable for these function)
	*	hexs : 			Array : 	Reachable hexs
	*/
	queryHexs: function(o){

		var defaultOpt = {
			fnOnConfirm : function(hex,args){ G.activeCreature.queryMove(); },
			fnOnSelect : function(hex,args){
				G.activeCreature.faceHex(hex,undefined,true);
				hex.overlayVisualState("creature selected player"+G.activeCreature.team);
			},
			fnOnCancel : function(hex,args){G.activeCreature.queryMove()},
			args : {},
			hexs : [],
			hexsDashed : [],
			size : 1,
			id : 0,
			flipped : false,
			hideNonTarget : false,
			ownCreatureHexShade : false,
		};

		o = $j.extend(defaultOpt,o);

		G.grid.lastClickedHex = [];

		//Save the last Query
		this.lastQueryOpt = $j.extend({},o); //Copy Obj

		//Block all hexs
		this.forEachHexs(function(){ 
			this.unsetReachable(); 
			if(o.hideNonTarget) this.setNotTarget();
			else this.unsetNotTarget();
			if( o.hexsDashed.indexOf(this) != -1 ){
				this.displayVisualState("dashed");
			}else{
				this.cleanDisplayVisualState("dashed");
			}
		});

		//Cleanup
		if(G.grid.materialize_overlay) G.grid.materialize_overlay.alpha = 0;

		//Creature hex shade
		// this.$allOverHex.removeClass("ownCreatureHexShade");

		if( !o.ownCreatureHexShade ){
			if( o.id instanceof Array ){
				o.id.each(function(){
					G.creatures[this].hexagons.each(function(){				
						this.overlayVisualState('ownCreatureHexShade')
					})
				});
			}else{
				if( o.id != 0 ){
					G.creatures[o.id].hexagons.each(function(){				
						this.overlayVisualState('ownCreatureHexShade')
					})
				}
			}		
		}




		//Set reachable the given hexs
		o.hexs.each(function(){ 
			this.setReachable();
			if(o.hideNonTarget) this.unsetNotTarget();
		});


		//ONCLICK
		var onConfirmFn = function(){
			var hex = this;
			var y = hex.y;
			var x = hex.x;
			
			//Clear display and overlay
			G.grid.updateDisplay();

			//Not reachable hex
			if( !hex.reachable ){
				G.grid.lastClickedHex = []; 
				if(hex.creature instanceof Creature){ //If creature
					var crea = hex.creature;
					//G.UI.showCreature(crea.type,crea.team);
				}else{ //If nothing
					o.fnOnCancel(hex,o.args); //ON CANCEL
				}
			}

			//Reachable hex
			else{

				//Offset Pos
				var offset = (o.flipped) ? o.size-1 : 0 ;
				var mult = (o.flipped) ? 1 : -1 ; //For FLIPPED player
				var availablePos = false;

				for (var i = 0; i < o.size; i++) {	//try next hexagons to see if they fits
					if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
					if(G.grid.hexs[y][x+offset-i*mult].isWalkable(o.size,o.id)){ 
						x += offset-i*mult;
						availablePos = true;
						break; 
					}
				};

				// if(!availablePos){
				// 	//Prevent Bugs
				// 	console.log("nowhere to go");
				// 	return;
				// }

				hex = G.grid.hexs[y][x]; //New coords
				var clickedtHex = hex;

				G.activeCreature.faceHex(clickedtHex,undefined,true,true);

				if( clickedtHex != G.grid.lastClickedHex ){
					G.grid.lastClickedHex = clickedtHex;
					//ONCLICK
					o.fnOnConfirm(clickedtHex,o.args);
				}else{
					//ONCONFIRM
					o.fnOnConfirm(clickedtHex,o.args);
				}

			}
		};

		
		//ONMOUSEOVER
		var onSelectFn = function(){
			var hex = this;
			var y = hex.y;
			var x = hex.x;

			//Xray
			G.grid.xray(hex);

			//Clear display and overlay
			G.grid.updateDisplay();
			G.UI.xrayQueue(-1);

			//Not reachable hex
			if( !hex.reachable ){
				if(G.grid.materialize_overlay) G.grid.materialize_overlay.alpha = 0;
				if(hex.creature instanceof Creature){ //If creature
					var crea = hex.creature;
					crea.hexagons.each(function(){
						this.overlayVisualState("hover h_player"+crea.team);	
					});
					G.UI.xrayQueue(crea.id);
				}else{ //If nothing
					hex.overlayVisualState("hover");
				}
			}else{ //Reachable hex


				//Offset Pos
				var offset = (o.flipped) ? o.size-1 : 0 ;
				var mult = (o.flipped) ? 1 : -1 ; //For FLIPPED player
				var availablePos = false;

				for (var i = 0; i < o.size; i++) {	//try next hexagons to see if they fit
					if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
					if(G.grid.hexs[y][x+offset-i*mult].isWalkable(o.size,o.id)){ 
						x += offset-i*mult;
						availablePos = true;
						break; 
					}
				};

				// if(!availablePos){
				// 	//Prevent Bugs
				// 	console.log("nowhere to go");
				// 	return;
				// }
				
				hex = G.grid.hexs[y][x]; //New coords
				o.fnOnSelect(hex,o.args);
			}
		};

		//ONRIGHTCLICK
		var onRightClickFn = function(){
			var hex = this;
			var y = hex.y;
			var x = hex.x;

			if(hex.creature instanceof Creature){ //If creature
				G.UI.showCreature( hex.creature.type, hex.creature.player.id );
			}else{
				G.UI.showCreature( G.activeCreature.type, G.activeCreature.player.id );
			}
		};


		this.forEachHexs(function(){ 
			this.onSelectFn	 = onSelectFn;
			this.onConfirmFn = onConfirmFn;
			this.onRightClickFn = onRightClickFn;
		});

	},


	/*	xray(hex)
	* 	
	*	hex : 	Hex : 	Hexagon to emphase
	*
	*	If hex contain creature call ghostOverlap for each creature hexs
	*
	*/
	xray: function(hex){
		//Clear previous ghost
		G.creatures.each(function(){ 
			if( this instanceof Creature ){ 
				this.xray(false);
			}
		});

		if(hex.creature instanceof Creature){
			hex.creature.hexagons.each(function(){ this.ghostOverlap(); });
		}else{
			hex.ghostOverlap();
		}
	},
	
	/*	hideCreatureHexs()
	* 	
	*	Ghosts hexs with creatures
	*
	*/
	hideCreatureHexs: function(except){
		G.creatures.each(function(){ 
			if( this instanceof Creature ){
				var hide = true;
				if(except instanceof Creature){
					if(except.id == this.id){
						hide = false;
					}
				}
				if(hide){
					// this.$display.addClass("ghosted_hidden");
					// this.$health.addClass("ghosted_hidden");
					for (var i = 0; i < this.size; i++) {
						if(this.hexagons[i]){
							// this.hexagons[i].$display.hide();
							// this.hexagons[i].$overlay.hide();
						}
					}
				}
			}
		});
	},
	
	/*	showCreatureHexs()
	* 	
	*	Unghosts hexs with creatures
	*
	*/
	showCreatureHexs: function(){
		G.creatures.each(function(){ 
			if( this instanceof Creature ){
				// this.display.overlayVisualState("ghosted_hidden");
				// this.health.overlayVisualState("ghosted_hidden");
				for (var i = 0; i < this.size; i++) {
					// if(this.hexagons[i]){
					// 	this.hexagons[i].display.alpha = 1;
					// 	this.hexagons[i].overlay.alpha = 1;
					// }
				}
			}
		});
	},
	
	/*	clearHexViewAlterations()
	* 	
	*	Removes all hex view alterations like hideCreatureHexs used
	*	Squashes bugs by making sure all view alterations are removed
	*	on a change of ability/change of turn/etc
	*	If you make a new hex view alteration call the function to remove
	*	the alteration in here to ensure it gets cleared at the right time
	*
	*/
	clearHexViewAlterations: function(){
		this.showCreatureHexs();
	},

	/*	updateDisplay()
	* 	
	*	Update overlay hexs with creature positions
	*
	*/
	updateDisplay: function(){ 
		this.cleanDisplay(); 
		this.cleanOverlay(); 
		this.hexs.each(function(){ this.each(function(){ 
			if( this.creature instanceof Creature ){
				if( this.creature.id == G.activeCreature.id ){
					this.overlayVisualState("active creature player"+this.creature.team);
					this.displayVisualState("creature player"+this.creature.team);
				}else{
					this.displayVisualState("creature player"+this.creature.team);
				}
			} 
		}); });	
	},


	/*	hexExists(y,x)
	*
	*	x : 	Integer : 	Coordinates to test
	*	y : 	Integer : 	Coordinates to test
	* 	
	*	Test if hex exists
	*
	*/
	hexExists: function(y,x){
		if( (y>=0) && (y<this.hexs.length) ){
			if( (x>=0) && (x<this.hexs[y].length) ) return true;
		}
		return false;
	},

	
	/*	isHexIn(hex,hexArray)
	*
	*	hex : 		Hex : 		Hex to look for
	*	hexarray : 	Array : 	Array of hexes to look for hex in
	* 	
	*	Test if hex exists inside array of hexes
	*
	*/
	isHexIn: function(hex,hexArray){
		for (var i = 0; i < hexArray.length; i++) {
			if(hexArray[i].x == hex.x && hexArray[i].y == hex.y){
				return true;
			}
		}
		return false;
	},
	
	
	/* 	getMovementRange(x,y,distance,size,id)
	*	
	*	x : 		Integer : 	Start position
	*	y : 		Integer : 	Start position
	*	distance : 	Integer : 	Distance from the start position
	*	size : 		Integer : 	Creature size
	*	id : 		Integer : 	Creature ID
	*
	*	return : 	Array : 	Set of the reachable hexs
	*/
	getMovementRange: function(x,y,distance,size,id){
		//	Populate distance (hex.g) in hexs by asking an impossible 
		//	destination to test all hexagons
		this.cleanReachable(); //If not pathfinding will bug
		this.cleanPathAttr(true); //Erase all pathfinding datas
		astar.search(G.grid.hexs[y][x],new Hex(-2,-2,null),size,id); 

		//Gather all the reachable hexs
		var hexs = [];
		this.forEachHexs(function(){
			//if not Too far or Impossible to reach
			if( this.g <= distance && this.g != 0 )
				hexs.push(G.grid.hexs[this.y][this.x]);
		});
		
		return hexs.extendToLeft(size);
	},


	/* 	getFlyingRange(x,y,distance,size,id)
	*	
	*	x : 		Integer : 	Start position
	*	y : 		Integer : 	Start position
	*	distance : 	Integer : 	Distance from the start position
	*	size : 		Integer : 	Creature size
	*	id : 		Integer : 	Creature ID
	*
	*	return : 	Array : 	Set of the reachable hexs
	*/
	getFlyingRange: function(x,y,distance,size,id){

		//Gather all the reachable hexs
		var hexs = G.grid.hexs[y][x].adjacentHex(distance);

		hexs.filter(function(){
			return this.isWalkable(size,id,true);
		});
	
		return hexs.extendToLeft(size);
	},


	/*	getHexMap(originx,originy,array)
	*
	*	array : 	Array : 	2-dimentions Array containing 0 or 1 (boolean)
	*	originx : 	Integer : 	Position of the array on the grid
	*	originy : 	Integer : 	Position of the array on the grid
	* 	offsetx : 	Integer : 	offset flipped for flipped players
	*	flipped : 	Boolean : 	If player is flipped or not
	*
	*	return : 	Array : 	Set of corresponding hexs
	*/
	getHexMap: function(originx,originy,offsetx,flipped,array){ //Heavy logic in here

		var array = array.slice(0); //Copy to not modify original
		originx += (flipped) ? 1-array[0].length-offsetx : -1+offsetx;
		var hexs = [];

		for (var y = 0; y < array.length; y++) {

			array[y] = array[y].slice(0); //Copy Row

			//Translating to flipped patern
			if(flipped && y%2!=0){ //Odd rows
				array[y].push(0);
			}

			//Translating even to odd row patern
			array[y].unshift(0);
			if(originy%2!=0 && y%2!=0){ //Even rows
				if(flipped) 
					array[y].pop(); //Remove last element as the array will be parse backward
				else
					array[y].splice(0,1); //Remove first element
			}

			//Gathering hexs
			for (var x = 0; x < array[y].length; x++) {
				if( !!array[y][x] ){
					xfinal = (flipped) ? array[y].length-1-x : x ; //Parse the array backward for flipped player
					if( this.hexExists(originy+y,originx+xfinal) ){
						hexs.push(this.hexs[originy+y][originx+xfinal]);
					}
				}
			}
		}

		return hexs;
	},


	showGrid : function(val){
		this.forEachHexs(function(){
			if(this.creature) this.creature.xray(val);
			if(this.drop) return;
			if(val) this.displayVisualState("showGrid");
			else this.cleanDisplayVisualState("showGrid");
		});
	},

	showMovementRange : function(id){
		var crea = G.creatures[id];
		if( crea.canFly ){
			var hexs = this.getFlyingRange(crea.x,crea.y,crea.stats.movement,crea.size,crea.id);
		}else{
			var hexs = this.getMovementRange(crea.x,crea.y,crea.stats.movement,crea.size,crea.id);
		}

		//Block all hexs
		this.forEachHexs(function(){ 
			this.unsetReachable(); 
		});

		//Set reachable the given hexs
		hexs.each(function(){ 
			this.setReachable();
		});

	},

	selectHexUp : function(){
		if( this.hexExists(this.selectedHex.y-1,this.selectedHex.x) ){
			var hex =  this.hexs[this.selectedHex.y-1][this.selectedHex.x];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	selectHexDown : function(){
		if( this.hexExists(this.selectedHex.y+1,this.selectedHex.x) ){
			var hex =  this.hexs[this.selectedHex.y+1][this.selectedHex.x];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	selectHexLeft : function(){
		if( this.hexExists(this.selectedHex.y,this.selectedHex.x-1) ){
			var hex =  this.hexs[this.selectedHex.y][this.selectedHex.x-1];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	selectHexRight : function(){
		if( this.hexExists(this.selectedHex.y,this.selectedHex.x+1) ){
			var hex =  this.hexs[this.selectedHex.y][this.selectedHex.x+1];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	confirmHex : function(){
		if(G.freezedInput) return;
		this.selectedHex.onConfirmFn();
	},

	orderCreatureZ : function(){

		var index = 0;

		for (var y = 0; y < this.hexs.length; y++) {
			for (var i = 1; i < G.creatures.length; i++) {

				if( G.creatures[i].y == y ){
					this.creatureGroup.remove( G.creatures[i].grp._container);
					this.creatureGroup.addAt( G.creatures[i].grp._container, index++ );
				}
			};

			if( this.materialize_overlay && this.materialize_overlay.posy == y){
				this.creatureGroup.remove( this.materialize_overlay);
				this.creatureGroup.addAt( this.materialize_overlay, index++ );
			}
		};

		//G.grid.creatureGroup.sort();
	},

	//******************//
	//Shortcut functions//
	//******************//

	/*	forEachHexs(f)
	*	
	*	f : Function : 	Function to execute
	* 	
	*	Execute f for each hexs
	*/
	forEachHexs: function(f){ this.hexs.each(function(){ this.each(function(){ f.apply(this); }); }); },

	/*	cleanPathAttr(includeG)
	*	
	*	includeG : 	Boolean : 	Include hex.g attribute
	* 	
	*	Execute hex.cleanPathAttr() function for all the grid. refer to the Hex class for more infos
	*/
	cleanPathAttr: function(includeG){ this.hexs.each(function(){ this.each(function(){ this.cleanPathAttr(includeG); }); }); },

	/*	cleanReachable()
	* 	
	*	Execute hex.setReachable() function for all the grid. refer to the Hex class for more infos
	*/
	cleanReachable: function(){ this.hexs.each(function(){ this.each(function(){ this.setReachable(); }); });	},

	/*	cleanDisplay(cssClass)
	* 	
	*	cssClass : 	String : 	Class(es) name(s) to remove with jQuery removeClass function
	*
	*	Shorcut for $allDispHex.removeClass()
	*/
	cleanDisplay: function(cssClass){
		this.forEachHexs(function(){ this.cleanDisplayVisualState(cssClass) });
	},
	cleanOverlay: function(cssClass){
		this.forEachHexs(function(){ this.cleanOverlayVisualState(cssClass) });
	},

	/*	previewCreature(creatureData)
	*
	*	pos : 			Object : 	Coordinates {x,y}
	*	creatureData : 	Object : 	Object containing info from the database (G.retreiveCreatureStats)
	*
	*	Draw a preview of the creature at the given coordinates
	*/
	previewCreature:function(pos,creatureData,player){

		this.updateDisplay(); //Retrace players creatures

		var creaHex = this.hexs[pos.y][pos.x-(creatureData.size-1)];

		if( !G.grid.materialize_overlay ){ //If sprite does not exists
			//Adding sprite
			this.materialize_overlay = this.creatureGroup.create(0,0, creatureData.name+'_cardboard');
			this.materialize_overlay.anchor.setTo(0.5,1);
			this.materialize_overlay.posy = pos.y;
		}else{
			this.materialize_overlay.loadTexture(creatureData.name+'_cardboard');
			if( this.materialize_overlay.posy != pos.y){
				this.materialize_overlay.posy = pos.y;	
				this.orderCreatureZ();
			}
		}


		//Placing sprite
		this.materialize_overlay.x = creaHex.displayPos.x + creatureData.display["offset-x"] + this.materialize_overlay.texture.width/2 + 1; //((!this.player.flipped) ? this.display["offset-x"] : 90*this.size-this.display.width-this.display["offset-x"]);
		this.materialize_overlay.y = creaHex.displayPos.y + creatureData.display["offset-y"] + this.materialize_overlay.texture.height;
		this.materialize_overlay.alpha = 0.5;

		if(player.flipped){
			this.materialize_overlay.scale.setTo(-1,1);
		}else{
			this.materialize_overlay.scale.setTo(1,1);
		}

		for (var i = 0; i < creatureData.size; i++) {
			this.hexs[pos.y][pos.x-i].overlayVisualState("creature selected player"+G.activeCreature.team);
		}
	},

	debugHex: function(hexs){
		$j(".debug").remove();
		var i = 0;
		hexs.each(function(){
			var a = G.grid.$creatureW.append('<div class=".debug" id="debug'+i+'"></div>').children("#debug"+i);
			a.css({
				position: 'absolute',
				width: 20,
				height: 20,
				"background-color": 'yellow'
			});
			a.css(this.displayPos);
			i++;
		});
	}

});//End of HexGrid Class


/*	Hex Class
*
*	Object containing hex informations, positions and DOM elements
*
*/
var Hex = Class.create({

	/*	Attributes
	*	
	*	NOTE : attributes and variables starting with $ are jquery element 
	*	and jquery function can be called dirrectly from them.
	*
	*	//Jquery attributes
	*	$display : 		Hex display element
	*	$overlay : 		Hex overlay element
	*	$input : 		Hex input element (bind controls on it)
	*	
	*	//Normal attributes
	*	x : 			Integer : 	Hex coordinates
	*	y : 			Integer : 	Hex coordinates
	*	pos : 			Object : 	Pos object for hex comparison {x,y}
	*
	*	f : 			Integer : 	Pathfinding score f = g + h
	*	g : 			Integer : 	Pathfinding distance from start
	*	h : 			Integer : 	Pathfinding distance to finish
	*	pathparent : 	Hex : 		Pathfinding parent hex (the one you came from)
	*
	*	blocked : 		Boolean : 	Set to true if an obstacle it on it. Restrict movement.
	*	creature : 		Creature : 	Creature object , undefined if empty
	*	reachable : 	Boolean : 	Set to true if accessible by current action
	*
	*	displayPos : 	Object : 	Pos object to position creature with absolute coordinates {left,top}
	*
	*/


	/*	Constructor(x,y)
	*	
	*	x : 			Integer : 	Hex coordinates
	*	y : 			Integer : 	Hex coordinates
	*
	*/
	initialize: function(x, y, grid) {

		this.x = x;
		this.y = y;
		this.pos = {x:x, y:y};
		this.coord = String.fromCharCode(64+this.y+1)+(this.x+1);
		
		//pathfinding
		this.f = 0;
		this.g = 0;
		this.h = 0;
		this.pathparent = null;

		this.blocked = false;
		this.creature = undefined;
		this.reachable = true;
		this.direction = -1; //Used for queryDirection
		this.drop = undefined; //Drop items
		this.displayClasses = "";
		this.overlayClasses = "";

		this.displayPos = {y:y*78};
		this.displayPos.x = (y%2 == 0) ? 46+x*90 : x*90;

		this.originalDisplayPos = $j.extend({},this.displayPos);

		if(grid){

			//10px is the offset from the old version

			this.display 	= grid.dispHexsGroup.create(this.displayPos.x-10, this.displayPos.y, 'hex');
			this.display.alpha = 0;
			
			this.overlay 	= grid.overHexsGroup.create(this.displayPos.x-10, this.displayPos.y, 'hex');
			this.overlay.alpha = 0;

			this.input 		= grid.inptHexsGroup.create(this.displayPos.x-10, this.displayPos.y, 'input');
			this.input.inputEnabled = true;
			this.input.input.pixelPerfect = true;
			this.input.input.pixelPerfectAlpha = 1;
			this.input.input.useHandCursor = false;

			//Binding Events
			this.input.events.onInputOver.add(function(){
				if(G.freezedInput) return;
				G.grid.selectedHex = this;
				this.onSelectFn();
			}, this);

			this.input.events.onInputOut.add(function(){
				if(G.freezedInput) return;
				G.grid.redoLastQuery();
				G.grid.xray( new Hex(-1,-1) ); //Clear Xray
				G.UI.xrayQueue( -1 ); //Clear Xray Queue
			}, this);

			this.input.events.onInputUp.add(function(Sprite,Pointer){
				if(G.freezedInput) return;
				switch (Pointer.button) {
					case 0:
						//Left mouse button pressed
						this.onConfirmFn();
						break;
					case 1:
						//Middle mouse button pressed
						break;
					case 2:
						//Right mouse button pressed
						this.onRightClickFn();
						break;
				}
			}, this);
			
		}

		this.displayPos.y = this.displayPos.y*.75+30;

		this.onSelectFn = function(){};
		this.onConfirmFn = function(){};
		this.onRightClickFn = function(){};

		this.trap = undefined;
	},


	/*	adjacentHex(distance)
	*
	*	distance : 	integer : 	Distance form the current hex
	*
	*	return : 	Array : 	Array containing Hexs
	*
	*	This function return an array containing all hexs of the grid 
	* 	at the distance given of the current hex.
	*
	*/
	adjacentHex: function(distance){
		var adjHex = [];
		for (var i = -distance; i <= distance; i++) {
			var deltaY = i;
			if(this.y%2 == 0){
				//evenrow
				for ( var deltaX = ( Math.ceil(Math.abs(i)/2) - distance ); 
				deltaX <= ( distance - Math.floor(Math.abs(i)/2) ); 
				deltaX++) {
					var x = this.x + deltaX;
					var y = this.y + deltaY;
					if(!(deltaY==0 && deltaX==0) && //exclude current hex
					y < G.grid.hexs.length && y >= 0 &&	x < G.grid.hexs[y].length && x >=0){  //exclude inexisting hexs
						adjHex.push(G.grid.hexs[y][x]);
					};
				};
			}else{
				//oddrow
				for ( var deltaX = ( Math.floor(Math.abs(i)/2) - distance ); 
				deltaX <= ( distance - Math.ceil(Math.abs(i)/2) ); 
				deltaX++) { 
					var x = this.x + deltaX;
					var y = this.y + deltaY;
					if(!(deltaY==0 && deltaX==0) && //exclude current hex
					y < G.grid.hexs.length && y >= 0 && x < G.grid.hexs[y].length && x >=0){ //exclude inexisting hexs
						adjHex.push(G.grid.hexs[y][x]);
					};
				};
			}
		};
		return adjHex;
	},


	/*	ghostOverlap()
	*
	*	add ghosted class to creature on hexs behind this hex
	*
	*/
	ghostOverlap: function(){
		for (var i = 1; i <= 3; i++) {
			if(this.y%2 == 0){
				if(i == 1){
					for (var j = 0; j <= 1; j++) {
						if(G.grid.hexExists(this.y+i,this.x+j)){
							if(G.grid.hexs[this.y+i][this.x+j].creature instanceof Creature){
								var ghostedCreature = G.grid.hexs[this.y+i][this.x+j].creature;
							}
						}
					}
				}else{
					if(G.grid.hexExists(this.y+i,this.x)){
						if(G.grid.hexs[this.y+i][this.x].creature instanceof Creature){
							var ghostedCreature = G.grid.hexs[this.y+i][this.x].creature;
						}
					}
				}
			}else{
				if(i == 1){
					for (var j = 0; j <= 1; j++) {
						if(G.grid.hexExists(this.y+i,this.x-j)){
							if(G.grid.hexs[this.y+i][this.x-j].creature instanceof Creature){
								var ghostedCreature = G.grid.hexs[this.y+i][this.x-j].creature;
							}
						}
					}
				}else{
					if(G.grid.hexExists(this.y+i,this.x)){
						if(G.grid.hexs[this.y+i][this.x].creature instanceof Creature){
							var ghostedCreature = G.grid.hexs[this.y+i][this.x].creature;
						}
					}
				}
			}
			if(ghostedCreature instanceof Creature){
				ghostedCreature.xray(true);
			}
		};
	},


	/*	cleanPathAttr(includeG)
	*
	*	includeG : 	Boolean : 	Set includeG to True if you change the start of the calculated path.
	*
	*	This function reset all the pathfinding attribute to 
	*	0 to calculate new path to another hex.
	*
	*/
	cleanPathAttr: function(includeG){
		this.f = 0;
		this.g = (includeG) ? 0 : this.g ;
		this.h = 0;
		this.pathparent = null;
	},


	/*	isWalkable(size, id)
	*
	*	size : 				Integer : 	Size of the creature
	*	id : 				Integer : 	ID of the creature
	* 	ignoreReachable : 	Boolean : 	Take into account the reachable property
	*
	*	return : 	Boolean : 	True if this hex is walkable
	*
	*/
	isWalkable: function(size,id,ignoreReachable){
		var blocked = false;
		
		for (var i = 0; i < size; i++) {
			//For each Hex of the creature
			if( (this.x-i) >= 0 && (this.x-i) < G.grid.hexs[this.y].length ){ //if hex exists
				var hex = G.grid.hexs[this.y][this.x-i];
				//Verify if blocked. If it's blocked by one attribute, OR statement will keep it status
				blocked = blocked || hex.blocked ;
				if(!ignoreReachable){ blocked = blocked || !hex.reachable ; }
				if(hex.creature instanceof Creature){

					if( id instanceof Array ){
						var isNotMovingCreature = ( id.indexOf(hex.creature.id) == -1);
					}else{
						var isNotMovingCreature = ( hex.creature.id != id );
					}

					blocked = blocked || isNotMovingCreature; //Not blocked if this block contains the moving creature
				}
				 
			}else{
				//Blocked by grid boundaries
				blocked = true;
			}
		};
		return !blocked; //Its walkable if it's NOT blocked
	},


	/*	setBlocked()
	*
	*	Set Hex.blocked to True for this hex and change $display class
	*
	*/
	setBlocked: function(){
		this.blocked = true;
		this.updateStyle();
	},


	/*	unsetBlocked()
	*
	*	Set Hex.blocked to False for this hex and change $display class
	*
	*/
	unsetBlocked: function(){
		this.blocked = false;
		this.updateStyle();
	},


	/*	overlayVisualState
	*
	*	Change the appearance of the overlay hex
	*
	*/
	overlayVisualState: function(classes){
		classes=(classes)?classes:"";
		this.overlayClasses += " "+classes+" ";
		this.updateStyle();
	},

	/*	displayVisualState
	*
	*	Change the appearance of the display hex
	*
	*/
	displayVisualState: function(classes){
		classes=(classes)?classes:"";
		this.displayClasses += " "+classes+" ";
		this.updateStyle();
	},

	/*	cleanOverlayVisualState
	*
	*	Clear the appearance of the overlay hex
	*
	*/
	cleanOverlayVisualState: function(classes){
		var classes = classes || "creature weakDmg active moveto selected hover h_player0 h_player1 h_player2 h_player3 player0 player1 player2 player3";

		var a = classes.split(' ');
		for (var i = 0; i < a.length; i++) {
			var regex = new RegExp("\\b"+a[i]+"\\b", 'g');
			this.overlayClasses = this.overlayClasses.replace(regex,'');
		};

		this.updateStyle();
	},

	/*	cleanDisplayVisualState
	*
	*	Clear the appearance of the display hex
	*
	*/
	cleanDisplayVisualState: function(classes){
		classes = classes || "adj hover creature player0 player1 player2 player3";

		var a = classes.split(' ');
		for (var i = 0; i < a.length; i++) {
			var regex = new RegExp("\\b"+a[i]+"\\b", 'g');
			this.displayClasses = this.displayClasses.replace(regex,'');
		};

		this.updateStyle();
	},


	/*	setReachable()
	*
	*	Set Hex.reachable to True for this hex and change $display class
	*
	*/
	setReachable: function(){
		this.reachable = true;
		this.input.input.useHandCursor = true;
		this.updateStyle();
	},

	/*	unsetReachable()
	*
	*	Set Hex.reachable to False for this hex and change $display class
	*
	*/
	unsetReachable: function(){
		this.reachable = false;
		this.input.input.useHandCursor = false;
		this.updateStyle();
	},


	unsetNotTarget: function(){
		this.displayClasses = this.displayClasses.replace(/\bhidden\b/g,'');
		this.updateStyle();
	},

	setNotTarget: function(){
		this.displayClasses += " hidden ";
		this.updateStyle();
	},

	updateStyle: function(){

		//Display Hex

		var targetAlpha = 0;

		targetAlpha = this.reachable || !!this.displayClasses.match(/creature/g);
		targetAlpha = !this.displayClasses.match(/hidden/g) && targetAlpha;
		targetAlpha = !!this.displayClasses.match(/showGrid/g) || targetAlpha;
		targetAlpha = !!this.displayClasses.match(/dashed/g) || targetAlpha;

		if(this.displayClasses.match(/0|1|2|3/)){
			var p = this.displayClasses.match(/0|1|2|3/);
			this.display.loadTexture("hex_p"+p);
			G.grid.dispHexsGroup.bringToTop(this.display);
		}else if(this.displayClasses.match(/adj/)){
			this.display.loadTexture("hex_path");
		}else if(this.displayClasses.match(/dashed/)){
			this.display.loadTexture("hex_dashed");
		}else{
			this.display.loadTexture("hex");
		}

		this.display.alpha = targetAlpha;

		//Display Coord
		if( !!this.displayClasses.match(/showGrid/g) ){
			if( !(this.coordText && this.coordText.exists) ) {
				this.coordText = G.Phaser.add.text(this.originalDisplayPos.x+45, this.originalDisplayPos.y+63, this.coord, {font: "30pt Play", fill: "#000000", align: "center"});
				this.coordText.anchor.setTo(0.5, 0.5);
				G.grid.overHexsGroup.add(this.coordText);
			}
		}else if(this.coordText && this.coordText.exists){
			this.coordText.destroy();
		}
		

		//Overlay Hex

		var targetAlpha = 0;

		targetAlpha = !!this.overlayClasses.match(/hover|creature/g);

		if( this.overlayClasses.match(/0|1|2|3/) ){
			var p = this.overlayClasses.match(/0|1|2|3/);

			if( this.overlayClasses.match(/hover/) ){
				this.overlay.loadTexture("hex_hover_p"+p);
			}else{
				this.overlay.loadTexture("hex_p"+p);
			}
			G.grid.overHexsGroup.bringToTop(this.overlay);
		}else{
			this.overlay.loadTexture("hex");
		}

		this.overlay.alpha = targetAlpha;

	},

	//---------TRAP FUNCTION---------//

	createTrap: function(type, effects, owner, opt){
		if(!!this.trap) this.destroyTrap();
		this.trap = new Trap(this.x,this.y,type,effects,owner,opt);
		return this.trap;
	},

	activateTrap: function(trigger, target){
		if(!this.trap) return;
		this.trap.effects.each(function(){
			if( trigger.test(this.trigger) &&  this.requireFn() ){
				G.log("Trap triggered");
				this.activate(target);
			}
		});
	},

	destroyTrap: function(){
		if(!this.trap) return;
		delete G.grid.traps[this.trap.id];
		this.trap.destroy();
		delete this.trap;
	},

	//---------DROP FUNCTION---------//

	pickupDrop: function(crea){
		if(!this.drop) return;
		this.drop.pickup(crea);
	},

});//End of Hex Class


/*	Trap Class
*
*	Object containing hex informations, positions and DOM elements
*
*/
var Trap = Class.create({

	/*	Constructor(x,y)
	*	
	*	x : 			Integer : 	Hex coordinates
	*	y : 			Integer : 	Hex coordinates
	*
	*/
	initialize: function(x, y, type, effects, owner, opt) {
		this.hex 		= G.grid.hexs[y][x];
		this.type 		= type;
		this.effects 	= effects;
		this.owner 		= owner;

		this.creationTurn = G.turn;

		var o = {
			turnLifetime : 0,
			fullTurnLifetime : false,
			ownerCreature : undefined, //needed for fullTurnLifetime
		};

		$j.extend(this,o,opt);

		//register
		G.grid.traps.push(this);
		this.id 		= trapID++;
		this.hex.trap 	= this;

		for (var i = this.effects.length - 1; i >= 0; i--) {
			this.effects[i].trap = this;
		};

		this.display = G.grid.trapGroup.create(this.hex.originalDisplayPos.x, this.hex.originalDisplayPos.y, 'trap_'+type);

	},

	destroy: function(){
		this.display.destroy();

		//unregister
		var i = G.grid.traps.indexOf(this);
		G.grid.traps.splice(i,1);
		this.hex.trap 	= undefined;
		delete this;
	},

	hide: function(duration, timer){
		timer = timer-0; //avoid undefined
		duration = duration-0; //avoid undefined
		G.Phaser.add.tween(this.display).to({alpha:0}, duration, Phaser.Easing.Linear.None)
	},

	show: function(duration){
		duration = duration-0; //avoid undefined
		G.Phaser.add.tween(this.display).to({alpha:1}, duration, Phaser.Easing.Linear.None)
	},

});


/*	Array Prototypes
*
*	Extend Array type for more flexibility and ease of use
*
*/

	/*	findPos(obj)
	*	
	*	obj : 		Object : 	Anything with pos attribute. Could be Hex of Creature.
	*
	*	return : 	Object : 	Object found in the array. False if nothing
	*
	*	Find an object in the current Array based on its pos attribute
	*
	*/
	Array.prototype.findPos = function(obj) {
	  for(var i=0;i<this.length;i++) {
		if(this[i].pos == obj.pos) { return this[i]; }
	  }
	  return false;
	};


	/*	removePos(obj)
	*	
	*	obj : 		Object : 	Anything with pos attribute. Could be Hex of Creature.
	*
	*	return : 	Boolean : 	True if success. False if failed.
	*
	*	Remove an object in the current Array based on its pos attribute
	*
	*/
	Array.prototype.removePos = function(obj) {
	  for(var i=0;i<this.length;i++) {
		if(this[i].pos == obj.pos) { this.splice(i,1); return true;}
	  }
	  return false;
	};


	/*	each(f)
	*	
	*	f : 		Function : 	Function to apply to each array's entry
	*
	*	Apply a function for each entries of the array
	*
	*/
	Array.prototype.each = function(f) {
		if(!f.apply) return;
		for(var i=0;i<this.length;i++) {
			f.apply(this[i], [i, this]);   
		}
		return this;
	};


	/*	filter(f)
	*	
	*	f : 		Function : 	Function to apply to each array's entry
	*
	*	If f return false remove the element from the array
	*
	*/
	Array.prototype.filter = function(f) {
		if(!f.apply) return;
		for(var i=0;i<this.length;i++) {
			if( !f.apply(this[i], [i, this]) ){
				this.splice(i,1);
				i--;
			}
		}
		return this;
	};

	/*	filterCreature(hexs,reverse,includeCrea,stopOnCreature)
	*
	*	includeCrea : 		Boolean : 	Add creature hexs to the array
	*	stopOnCreature : 	Boolean : 	Cut the array when finding a creature
	*	id : 				Integer : 	Creature id to remove
	*
	*	return : 		Array : 	filtered array
	*/
	Array.prototype.filterCreature = function(includeCrea,stopOnCreature,id){
		var creaHexs = [];

		for (var i = 0; i < this.length; i++) {
		 	if(this[i].creature instanceof Creature){
		 		if(!includeCrea || this[i].creature.id==id){
		 			if(this[i].creature.id==id){
		 				this.splice(i,1);
		 				i--;
		 				continue;	
		 			}else{
		 				this.splice(i,1);
		 				i--;
		 			}
		 		}else{
		 			creaHexs = creaHexs.concat(this[i].creature.hexagons);
		 		}
		 		if(stopOnCreature){
		 			this.splice(i+1,99);
		 			break;
		 		}
		 	}
		}
		return this.concat(creaHexs);
	},


	/*	extendToLeft(size)
	*	
	*	size : 		Integer : 	Size to extend
	*
	*	return : 	Array : 	The hex array with all corresponding hexs at the left
	*/
	Array.prototype.extendToLeft = function(size) {
		var ext = [];
		for(var i=0;i<this.length;i++) {
			for (var j = 0; j < size; j++) {
				//NOTE : This code produce array with doubles.
				if( G.grid.hexExists(this[i].y,this[i].x-j) )
					ext.push(G.grid.hexs[this[i].y][this[i].x-j]);
			}
		}
		return ext;
	};


	/*	extendToLeft(size)
	*	
	*	size : 		Integer : 	Size to extend
	*
	*	return : 	Array : 	The hex array with all corresponding hexs at the left
	*/
	Array.prototype.extendToRight = function(size) {
		var ext = [];
		for(var i=0;i<this.length;i++) {
			for (var j = 0; j < size; j++) {
				//NOTE : This code produce array with doubles.
				if( G.grid.hexExists(this[i].y,this[i].x+j) )
					ext.push(G.grid.hexs[this[i].y][this[i].x+j]);
			}
		}
		return ext;
	};



	/*	each()
	*
	*	Return the last element of the array
	*
	*/
	Array.prototype.last = function() {
		return this[this.length-1];
	};


	/*	orderByInitiative()
	*
	*	Used by game.queue
	*	TODO need a separate class to not add confusion
	*
	*/
	Array.prototype.orderByInitiative = function() {
		//Bubble sorting
	    var swapped;
	    do {
	        swapped = false;
	        for (var i=0; i < this.length-1; i++) {
	            if ( this[i].getInitiative() < this[i+1].getInitiative() ) {
	                var temp = this[i];
	                this[i] = this[i+1];
	                this[i+1] = temp;
	                swapped = true;
	            }
	        }
	    } while (swapped);
	};


//------------------//
// USEFUL MATRICES //
//------------------//

diagonalup = 	 [[ 0,0,0,0,1 ], //origin line
				 [ 0,0,0,0,1 ],
				  [ 0,0,0,1,0 ],
				 [ 0,0,0,1,0 ],
				  [ 0,0,1,0,0 ],
				 [ 0,0,1,0,0 ],
				  [ 0,1,0,0,0 ],
				 [ 0,1,0,0,0 ],
				  [ 1,0,0,0,0 ]];
diagonalup.origin = [4,0];

diagonaldown = 	 [[ 1,0,0,0,0 ], //origin line
				 [ 0,1,0,0,0 ],
				  [ 0,1,0,0,0 ],
				 [ 0,0,1,0,0 ],
				  [ 0,0,1,0,0 ],
				 [ 0,0,0,1,0 ],
				  [ 0,0,0,1,0 ],
				 [ 0,0,0,0,1 ],
				  [ 0,0,0,0,1 ]];
diagonaldown.origin = [0,0];

straitrow = 	[[ 1,1,1, 1,1,1, 1,1,1, 1,1,1, 1,1,1, 1 ]]; //origin line
straitrow.origin = [0,0];


bellowrow = 	[  [ 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ],//origin line
				  [ 0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1 ]];
bellowrow.origin = [0,0];

frontnback2hex = [	 [0,0,0,0],
					[0,1,0,1],
					 [1,0,0,1], //origin line
					[0,1,0,1]];
frontnback2hex.origin = [2,2];

frontnback3hex = [	 [0,0,0,0,0],
					[0,1,0,0,1],
					 [1,0,0,0,1], //origin line
					[0,1,0,0,1]];
frontnback3hex.origin = [3,2];

front2hex 		= [	 [0,0,0,0],
					[0,0,0,1],
					 [0,0,0,1], //origin line
					[0,0,0,1]];
front2hex.origin = [2,2];

inlinefront2hex = [	 [0,0,0,0],
					[0,0,0,0],
					 [0,0,0,1], //origin line
					[0,0,0,0]];
inlinefront2hex.origin = [2,2];

inlineback2hex = [	 [0,0,0,0],
					[0,0,0,0],
					 [1,0,0,0], //origin line
					[0,0,0,0]];
inlineback2hex.origin = [2,2];

inlinefrontnback2hex = [ [0,0,0,0],
						[0,0,0,0],
						 [1,0,0,1], //origin line
						[0,0,0,0]];
inlinefrontnback2hex.origin = [2,2];

front1hex = [	 [0,0,0],
				[0,0,1],
				 [0,0,1], //origin line
				[0,0,1]];
front1hex.origin = [1,2];

backtop1hex = [	 [0,0,0],
				[0,1,0],
				 [0,0,0], //origin line
				[0,0,0]];
backtop1hex.origin = [1,2];

inlineback1hex = [	 [0,0,0],
					[0,0,0],
					 [1,0,0], //origin line
					[0,0,0]];
inlineback1hex.origin = [1,2];

backbottom1hex = [	 [0,0,0],
					[0,0,0],
					 [0,0,0], //origin line
					[0,1,0]];
backbottom1hex.origin = [1,2];

fronttop1hex = [ [0,0,0],
				[0,0,1],
				 [0,0,0], //origin line
				[0,0,0]];
fronttop1hex.origin = [1,2];

inlinefront1hex = [	 [0,0,0],
					[0,0,0],
					 [0,0,1], //origin line
					[0,0,0]];
inlinefront1hex.origin = [1,2];

frontbottom1hex = [	 [0,0,0],
					[0,0,0],
					 [0,0,0], //origin line
					[0,0,1]];
frontbottom1hex.origin = [1,2];