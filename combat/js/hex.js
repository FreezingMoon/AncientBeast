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
	*	$dispHexsW : 	Current active creature panel (left panel) container
	*	$allInptHex : 	Shortcut to all input hexagons DOM elements (for input events)
	*	$allDispHex : 	Shortcut to all display hexagons DOM elements (to change style of hexagons)
	*	
	*	//Normal attributes
	*	hexs : 			Array : 	Contain all hexs in row arrays (hexs[y][x])
	*	path : 			Array : 	Array of hexagons containing last calculated pathfinding
	*
	*/


	/*	Constructor
	*	
	* 	Create attributes and populate JS grid with Hex objects
	*
	*/
	initialize: function(){
		this.hexs 		= new Array(); //Hex Array
		this.path 		= []; //Array of hexagons containing last calculated pathfinding

		this.$display 		= $j("#grid");
		
		this.$creatureW 	= $j("#creatureWrapper"); //Creature Wrapper
		this.$inptHexsW		= $j("#hexsinput"); //Input Hexs Wrapper
		this.$dispHexsW		= $j("#hexsdisplay"); //Display Hexs Wrapper

		this.$allInptHex	= $j("#hexsinput .hex"); //All Input Hexs
		this.$allDispHex	= $j("#hexsdisplay .displayhex"); //All Display Hexs

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


	/*	cleanPathAttr(includeG)
	*	
	*	includeG : 	Boolean : 	Include hex.g attribute
	* 	
	*	Execute hex.cleanPathAttr() function for all the grid. refer to the Hex class for more infos
	*
	*/
	cleanPathAttr: function(includeG){ this.hexs.each(function(){ this.each(function(){ this.cleanPathAttr(includeG); }); }); },


	/*	cleanReachable()
	* 	
	*	Execute hex.setReachable() function for all the grid. refer to the Hex class for more infos
	*
	*/
	cleanReachable: function(){ this.hexs.each(function(){ this.each(function(){ this.setReachable(); }); });	},


	/*	cleanDisplay(cssClass)
	* 	
	*	cssClass : 	String : 	Class(es) name(s) to remove with jQuery removeClass function
	*
	*	Shorcut for $allDispHex.removeClass()
	*
	*/
	cleanDisplay: function(cssClass){ this.$allDispHex.removeClass(cssClass); },


	/*	highlightCreatureRange(x, y, distance, size)
	*
	*	x : 		integer : 	Creature coordinates
	*	y : 		integer : 	Creature coordinates
	*	distance : 	integer : 	Distance form the creature (Movement range)
	*	size : 		integer : 	Size of the creature
	*	id : 		integer : 	ID of the creature
	*
	*	Change hexagons in range from the creature position to reachable. See hex.setReachable for more infos.
	*
	*/
	highlightCreatureRange: function(x,y,distance,size,id){

		this.cleanPathAttr(true); //Erase all pathfinding datas
		this.cleanReachable(); //Clean all precedent blocked hexs

		//Populate distance (hex.g) in hexs by asking an impossible destination to test all hexagons
		astar.search(G.grid.hexs[y][x],new Hex(-2,-2,null),size,id); 

		//For each hex
		this.hexs.each(function(){
			this.each(function(){
				//If distance from creature is higher than allowed range or not reacheable
				if( (this.g > distance) || (this.g == 0) ) { 
					this.unsetReachable(); //Hex IS NOT reachable
				}else{
					//in range
					for (var i = 0; i < size; i++) { //each creature hex
						if( (this.x-i) >= 0 && (this.x-i) < G.grid.hexs[this.y].length ){ //check if inside row boundaries
							G.grid.hexs[this.y][this.x-i].setReachable();
						}
					};
				}

			});
		});

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

		this.$display = $j('#hexsdisplay .displayhex[x="'+x+'"][y="'+y+'"]'); //Jquery object
		this.$input = $j('#hexsinput .hex[x="'+x+'"][y="'+y+'"]'); //Input Jquery object
		
		this.displayPos = (y%2 == 0) ? //IF EVEN ROW
			{left:46+x*90 ,top:y*78 } : //TRUE
			{left:x*90 ,top:y*78 } ; //FALSE
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
	*	size : 		Integer : 	Size of the creature
	*	id : 		Integer : 	ID of the creature
	*
	*	return : 	Boolean : 	True if this hex is walkable
	*
	*/
	isWalkable: function(size,id){
		var blocked = false;
		
		for (var i = 0; i < size; i++) {
			//For each Hex of the creature
			if( (this.x-i) >= 0 && (this.x-i) < G.grid.hexs[this.y].length ){ //if hex exists
				var hex = G.grid.hexs[this.y][this.x-i];
				//Verify if blocked. If it's blocked by one attribute, OR statement will keep it status
				blocked = blocked || hex.blocked ;
				blocked = blocked || !hex.reachable ;
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
		//TODO change display
	},

});//End of Hex Class


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


	/*	each()
	*
	*	Return the last element of the array
	*
	*/
	Array.prototype.last = function() {
		return this[this.length-1];
	};


	/*	orderByDelay()
	*
	*	Used by game.queue
	*	TODO need a separate class to not add confusion
	*
	*/
	Array.prototype.orderByDelay = function() {
		//Bubble sorting
	    var swapped;
	    do {
	        swapped = false;
	        for (var i=0; i < this.length-1; i++) {
	            if ( this[i].getDelay() > this[i+1].getDelay() ) {
	                var temp = this[i];
	                this[i] = this[i+1];
	                this[i+1] = temp;
	                swapped = true;
	            }
	        }
	    } while (swapped);
	};