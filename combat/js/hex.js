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
	*	lastClickedtHex : 	Hex : 		Last hex clicked!
	*
	*/


	/*	Constructor
	*	
	* 	Create attributes and populate JS grid with Hex objects
	*
	*/
	initialize: function(){
		this.hexs 				= new Array(); //Hex Array
		this.traps 				= new Array(); //Traps Array
		this.lastClickedtHex 	= []; //Array of hexagons containing last calculated pathfinding

		this.$display 			= $j("#grid");
		
		this.$creatureW 		= $j("#creatureWrapper"); //Creature Wrapper
		this.$inptHexsW			= $j("#hexsinput"); //Input Hexs Wrapper
		this.$dispHexsW			= $j("#hexsdisplay"); //Display Hexs Wrapper
		this.$overHexsW			= $j("#hexsoverlay"); //Display Hexs Wrapper

		this.$allInptHex		= $j("#hexsinput .hex"); //All Input Hexs
		this.$allDispHex		= $j("#hexsdisplay .displayhex"); //All Display Hexs
		this.$allOverHex		= $j("#hexsoverlay .displayhex"); //All Display Hexs

		var grid = this; //Escape Jquery namespace

		//Populate grid
		this.$inptHexsW.children(".row").each(function(){
			grid.hexs.push(new Array());	//Add a row for each DOM element
		});

		this.$allInptHex.each(function(){
			var x = $j(this).attr("x") - 0; // - 0 convert variable to numeric type
			var y = $j(this).attr("y") - 0;
			var hex = new Hex(x,y,$j(this),grid); // Create new hex object
			grid.hexs[y][x] = hex;	//Add hex to its respective row
		});
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
			directions : [1,1,1,1,1,1],
			includeCrea : true,
			stopOnCreature : true,
		};

		o = $j.extend(defaultOpt,o);
		
		var choices = [] 

		for (var i = 0; i < o.directions.length; i++) {
			if(!!o.directions[i]){
				var dir = []
				switch(i){
					case 0: //Upright
						dir = G.grid.getHexMap(o.x,o.y-8,0,o.flipped,diagonalup).reverse();
						break;
					case 1: //StraitForward
						dir = G.grid.getHexMap(o.x,o.y,0,o.flipped,straitrow);
						break;
					case 2: //Downright
						dir = G.grid.getHexMap(o.x,o.y,0,o.flipped,diagonaldown);
						break;
					case 3: //Downleft
						dir = G.grid.getHexMap(o.x,o.y,-4,o.flipped,diagonalup);
						break;
					case 4: //StraitBackward
						dir = G.grid.getHexMap(o.x,o.y,0,!o.flipped,straitrow);
						break;
					case 5: //Upleft
						dir = G.grid.getHexMap(o.x,o.y-8,-4,o.flipped,diagonaldown).reverse();
						break;
					default:
						break;
				}
				dir.each(function(){ this.direction = (o.flipped)?5-i:i; });
				choices.push(dir.filterCreature(o.includeCrea,o.stopOnCreature,o.id,o.team));
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
					if(this.creature>0){
						this.$overlay.addClass("creature selected player"+G.creatures[this.creature].team);	
					}else{
						this.$display.addClass("adj");
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
		};

		o = $j.extend(defaultOpt,o);

		var hexs = [];
		for (var i = 0; i < o.choices.length; i++) {
			var validChoice = true;

			if(o.requireCreature){
				validChoice = false;
				//Search each hex for a creature that matches the team argument
				for (var j = 0; j < o.choices[i].length; j++) {
					if( o.choices[i][j].creature!=0 && o.choices[i][j].creature!=o.id ){
						var creaSource = G.creatures[o.id];
						var creaTarget = G.creatures[o.choices[i][j].creature];

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
		};

		this.queryHexs({
			fnOnConfirm : function(hex,args){
				//Determine which set of hexs (choice) the hex is part of
				for (var i = 0; i < args.opt.choices.length; i++) {
					for (var j = 0; j < args.opt.choices[i].length; j++) {
						if(hex.pos==args.opt.choices[i][j].pos){
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
							args.opt.fnOnSelect(args.opt.choices[i],args.opt.args);
							break;
						}
					};
				};
			},
			fnOnCancel : o.fnOnCancel,
			args : {opt : o},
			hexs : hexs,
			flipped : o.flipped,
			hideNonTarget : true,
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
			args : {},
			hexs : [],
			flipped : false,
			id : 0,
			team : 0,
		};

		o = $j.extend(defaultOpt,o);

		//Exclude everything but the creatures
		o.hexs.filter(function(){
			if( this.creature!=0 && this.creature!=o.id ){
				var creaSource = G.creatures[o.id];
				var creaTarget = G.creatures[this.creature];

				var isAllie = ( creaSource.team%2 == creaTarget.team%2 );
				switch(o.team){
					case 0: //Ennemies
						if(creaSource.team%2!=creaTarget.team%2) return true;
						break;
					case 1: //Allies
						if(creaSource.team%2==creaTarget.team%2) return true;
						break;
					case 2: //Same team
						if(creaSource.team==creaTarget.team) return true;
						break;
					case 3: //Both
						return true;
						break;
				}
			}
			return false;
		});

		var extended = [];
		o.hexs.each(function(){	extended = extended.concat(G.creatures[this.creature].hexagons); });

		o.hexs = extended;

		this.queryHexs({
			fnOnConfirm : function(hex,args){
				var crea = G.creatures[hex.creature];
				args.opt.fnOnConfirm(crea,args.opt.args);
			},
			fnOnSelect : function(hex,args){
				var crea = G.creatures[hex.creature];
				args.opt.fnOnSelect(crea,args.opt.args);
			},
			fnOnCancel : o.fnOnCancel,
			args : {opt : o},
			hexs : o.hexs,
			flipped : o.flipped,
			hideNonTarget : true,
		});

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
				hex.$overlay.addClass("creature selected player"+G.activeCreature.team);
			},
			fnOnCancel : function(hex,args){G.activeCreature.queryMove()},
			args : {},
			hexs : [],
			size : 1,
			id : 0,
			flipped : false,
			hideNonTarget : false,
		};

		o = $j.extend(defaultOpt,o);

		G.grid.lastClickedtHex = [];


		//Block all hexs
		this.forEachHexs(function(){ 
			this.unsetReachable(); 
			if(o.hideNonTarget) this.setNotTarget();
			else this.unsetNotTarget();
		});
		//Set reachable the given hexs
		o.hexs.each(function(){ 
			this.setReachable();
			if(o.hideNonTarget) this.unsetNotTarget();
		});


		//Clear previous binds
		G.grid.$allInptHex.unbind('click');
		G.grid.$allInptHex.unbind('mouseover');


		//ONCLICK
		this.$allInptHex.bind('click', function(){
			if(G.freezedInput) return;

			var x = $j(this).attr("x")-0;
			var y = $j(this).attr("y")-0;

			var hex = G.grid.hexs[y][x];

			//Clear display and overlay
			G.grid.updateDisplay();

			//Not reachable hex
			if( !hex.reachable ){
				G.grid.lastClickedtHex = []; 
				if(hex.creature>0){ //If creature
					var crea = G.creatures[hex.creature];
					G.UI.showCreature(crea.type,crea.team);
				}else{ //If nothing
					o.fnOnCancel(hex,o.args); //ON CANCEL
				}
			}

			//Reachable hex
			else{

				//Offset Pos
				var offset = (o.flipped) ? o.size-1 : 0 ;
				var mult = (o.flipped) ? 1 : -1 ; //For FLIPPED player

				for (var i = 0; i < o.size; i++) {	//try next hexagons to see if they fits
					if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
					if(G.grid.hexs[y][x+offset-i*mult].isWalkable(o.size,o.id)){ 
						x += offset-i*mult;
						break; 
					}
				};

				hex = G.grid.hexs[y][x]; //New coords
				var clickedtHex = hex;

				if( clickedtHex != G.grid.lastClickedtHex ){
					G.grid.lastClickedtHex = clickedtHex;
					//ONCLICK
					o.fnOnConfirm(clickedtHex,o.args);
				}else{
					//ONCONFIRM
					o.fnOnConfirm(clickedtHex,o.args);
				}

			}

		});


		//ONMOUSEOVER
		this.$allInptHex.bind('mouseover', function(){
			if(G.freezedInput) return;

			var x = $j(this).attr("x")-0;
			var y = $j(this).attr("y")-0;

			var hex = G.grid.hexs[y][x];

			//Xray
			G.grid.xray(hex);

			//Clear display and overlay
			G.grid.updateDisplay();

			//Not reachable hex
			if( !hex.reachable ){
				if(hex.creature>0){ //If creature
					var crea = G.creatures[hex.creature];
					crea.hexagons.each(function(){
						this.$overlay.addClass("hover h_player"+crea.team);	
					});
				}else{ //If nothing
					hex.$overlay.addClass("hover");
				}
			}

			//Reachable hex
			else{

				//Offset Pos
				var offset = (o.flipped) ? o.size-1 : 0 ;
				var mult = (o.flipped) ? 1 : -1 ; //For FLIPPED player

				for (var i = 0; i < o.size; i++) {	//try next hexagons to see if they fits
					if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
					if(G.grid.hexs[y][x+offset-i*mult].isWalkable(o.size,o.id)){ 
						x += offset-i*mult;
						break; 
					}
				};

				hex = G.grid.hexs[y][x]; //New coords
				o.fnOnSelect(hex,o.args);
			}
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
				this.$display.removeClass("ghosted");
				this.$health.removeClass("ghosted");
			}
		});

		if(hex.creature != 0){
			G.creatures[hex.creature].hexagons.each(function(){ this.ghostOverlap(); });
		}else{
			hex.ghostOverlap();
		}
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
			if( this.creature > 0 ){
				if( this.creature == G.activeCreature.id ){
					this.$overlay.addClass("active creature player"+G.creatures[this.creature].team);
					this.$display.addClass("creature player"+G.creatures[this.creature].team);
				}else{
					this.$display.addClass("creature player"+G.creatures[this.creature].team);
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
		var hexs = this.hexs[y][x].adjacentHex(distance);

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
		if(cssClass === undefined) 
			cssClass = "adj creature player0 player1 player2 player3";
		this.$allDispHex.removeClass(cssClass);
	},
	cleanOverlay: function(cssClass){
		if(cssClass === undefined) 
			cssClass = "creature active moveto selected hover h_player0 h_player1 h_player2 h_player3 player0 player1 player2 player3";
		this.$allOverHex.removeClass(cssClass);
	},

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
	*	creature : 		Integer : 	Creature on it, 0 = no creature else creature.ID
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
	initialize: function(x, y) {
		this.x = x - 0; // - 0 force type
		this.y = y - 0; // - 0 force type
		this.pos = {x:x - 0, y:y - 0};

		this.f = 0; //pathfinding
		this.g = 0; //pathfinding
		this.h = 0; //pathfinding
		this.pathparent = null; //pathfinding

		this.blocked = false;
		this.creature = 0; //0 if no creature; else creature index
		this.reachable = true;
		this.direction = -1; //Used for queryDirection

		this.$display = $j('#hexsdisplay .displayhex[x="'+x+'"][y="'+y+'"]'); //Jquery object
		this.$overlay = $j('#hexsoverlay .displayhex[x="'+x+'"][y="'+y+'"]'); //Jquery object
		this.$input = $j('#hexsinput .hex[x="'+x+'"][y="'+y+'"]'); //Input Jquery object
		
		this.displayPos = {top:y*78};
		this.displayPos.left = (y%2 == 0) ? 46+x*90 : x*90;

		var ymax = $j("#grid").height();
		var xmax = $j("#grid").width();

		var xmult = (this.displayPos.left/xmax-.5)*(this.displayPos.top/ymax-.5)*-4;
		var ymult = Math.pow((this.displayPos.top/ymax)*2,2);

		this.displayPos.left = this.displayPos.left-Math.round(xmult*60);
		this.displayPos.top = 125+y*78/1.68+Math.round(ymult*21);

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
							if(G.grid.hexs[this.y+i][this.x+j].creature!=0){
								var ghosted_creature = G.creatures[G.grid.hexs[this.y+i][this.x].creature];
								ghosted_creature.$display.addClass('ghosted');
								ghosted_creature.$health.addClass("ghosted");
							}
						}
					}
				}else{
					if(G.grid.hexExists(this.y+i,this.x)){
						if(G.grid.hexs[this.y+i][this.x].creature!=0){
							var ghosted_creature = G.creatures[G.grid.hexs[this.y+i][this.x].creature];
							ghosted_creature.$display.addClass('ghosted');
							ghosted_creature.$health.addClass("ghosted");
						}
					}
				}
			}else{
				if(i == 1){
					for (var j = 0; j <= 1; j++) {
						if(G.grid.hexExists(this.y+i,this.x-j)){
							if(G.grid.hexs[this.y+i][this.x-j].creature!=0){
								var ghosted_creature = G.creatures[G.grid.hexs[this.y+i][this.x-j].creature];
								ghosted_creature.$display.addClass('ghosted');
								ghosted_creature.$health.addClass("ghosted");
							}
						}
					}
				}else{
					if(G.grid.hexExists(this.y+i,this.x)){
						if(G.grid.hexs[this.y+i][this.x].creature!=0){
							var ghosted_creature = G.creatures[G.grid.hexs[this.y+i][this.x].creature];
							ghosted_creature.$display.addClass('ghosted');
							ghosted_creature.$health.addClass("ghosted");
						}
					}
				}
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
				blocked = blocked || ( (hex.creature!=id) && (hex.creature>0) ) ; //Not blocked if this block contains the moving creature
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
		this.$display.css("opacity",0);
		//TODO change display
	},


	/*	unsetBlocked()
	*
	*	Set Hex.blocked to False for this hex and change $display class
	*
	*/
	unsetBlocked: function(){
		this.blocked = false;
		this.$display.css("opacity",1);
		//TODO change display
	},


	/*	setReachable()
	*
	*	Set Hex.reachable to True for this hex and change $display class
	*
	*/
	setReachable: function(){
		this.reachable = true;
		this.$display.removeClass("not-reachable");
		this.$input.removeClass("not-reachable");
		//TODO change display
	},


	/*	unsetReachable()
	*
	*	Set Hex.reachable to False for this hex and change $display class
	*
	*/
	unsetReachable: function(){
		this.reachable = false;
		this.$display.addClass("not-reachable");
		this.$input.addClass("not-reachable");
		//TODO change display
	},

	unsetNotTarget: function(){
		this.$display.removeClass("hidden");
		//TODO change display
	},

	setNotTarget: function(){
		this.$display.addClass("hidden");
		//TODO change display
	},

	//---------TRAP FUNCTION---------//

	createTrap: function(type, effects, owner){
		if(!!this.trap) this.destroyTrap();
		this.trap = new Trap(this.x,this.y,type,effects,owner);
	},

	activateTrap: function(trigger, target){
		if(!this.trap) return;
		this.trap.effects.each(function(){
			if( trigger.test(this.trigger) ){
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
	initialize: function(x, y, type, effects, owner) {
		this.hex 		= G.grid.hexs[y][x];
		this.type 		= type;
		this.effects 	= effects;
		this.owner 		= owner;

		//register
		G.grid.traps.push(this);
		this.id 		= trapID++;
		this.hex.trap 	= this;

		this.$display = $j('#trapWrapper').append('<div id="trap'+this.id+'" class="trap '+this.type+'"></div>').children("#trap"+this.id);
		this.$display.css(this.hex.displayPos);
	},

	destroy: function(){
		this.$display.remove();
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
		 	if(this[i].creature>0){
		 		if(!includeCrea || this[i].creature==id){
		 			if(this[i].creature==id){
		 				this.splice(i,1);
		 				i--;
		 				continue;	
		 			}else{
		 				this.splice(i,1);
		 				i--;
		 			}
		 		}else{
		 			creaHexs = creaHexs.concat(G.creatures[this[i].creature].hexagons);
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

diagonaldown = 	 [[ 1,0,0,0,0 ], //origin line
				 [ 0,1,0,0,0 ],
				  [ 0,1,0,0,0 ],
				 [ 0,0,1,0,0 ],
				  [ 0,0,1,0,0 ],
				 [ 0,0,0,1,0 ],
				  [ 0,0,0,1,0 ],
				 [ 0,0,0,0,1 ],
				  [ 0,0,0,0,1 ]];

straitrow = 	[[ 1,1,1, 1,1,1, 1,1,1, 1,1,1, 1,1,1, 1 ]]; //origin line
