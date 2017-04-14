var util = util || {};

util.calculatePercentageResult = function(value, percentage) {
	return (value * percentage) / 100;
}


/**
 * Return a direction number given a delta x/y
 * Deltas in [-1, 1] should be used, but due to creature size, x can be greater
 * - delta x will be clamped for the calculation.
 * Due to the hex grid, the starting y coordinate matters.
 * @param {number} y - y coordinate to calculate from
 * @param {number} dx - delta x
 * @param {number} dy - delta y, in range [-1, 1]
 * @return {number} the direction number
 */
util.getDirectionFromDelta = function(y, dx, dy) {
	// Due to target size, this could be off; limit dx
	if (dx > 1) dx = 1;
	if (dx < -1) dx = -1;
	var dir;
	if (dy === 0) {
		if (dx === 1) {
			dir = 1; // forward
		} else { // dx === -1
			dir = 4; // backward
		}
	} else {
		// Hex grid corrections
		if (y % 2 === 0 && dx < 1) {
			dx++;
		}
		if (dx === 1) {
			if (dy === -1) {
				dir = 0; // upright
			} else { // dy === 1
				dir = 2; // downright
			}
		} else { // dx === 0
			if (dy === 1) {
				dir = 3; // downleft
			} else { // dy === -1
				dir = 5; // upleft
			}
		}
	}
	return dir;
}

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
	for (var i = 0; i < this.length; i++) {
		if (this[i].pos == obj.pos) {
			return this[i];
		}
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
	for (var i = 0; i < this.length; i++) {
		if (this[i].pos == obj.pos) {
			this.splice(i, 1);
			return true;
		}
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
	if (!f.apply) return;
	for (var i = 0; i < this.length; i++) {
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
	if (!f.apply) return;
	for (var i = 0; i < this.length; i++) {
		if (!f.apply(this[i], [i, this])) {
			this.splice(i, 1);
			i--;
		}
	}
	return this;
};

/*	filterCreature(includeCrea, stopOnCreature, id)
 *	Filters in-place an array of hexes based on creatures.
 * The array typically represents a linear sequence of hexes, to produce a
 * subset/superset of hexes that contain or don't contain creatures.
 *
 *	includeCrea : 		Boolean : 	Add creature hexs to the array
 *	stopOnCreature : 	Boolean : 	Cut the array when finding a creature
 *	id : 				Integer : 	Creature id to remove
 *
 *	return : 		Array : 	filtered array
 */
Array.prototype.filterCreature = function(includeCrea, stopOnCreature, id) {
		var creaHexs = [];

		for (var i = 0; i < this.length; i++) {
			if (this[i].creature instanceof Creature) {
				if (!includeCrea || this[i].creature.id == id) {
					if (this[i].creature.id == id) {
						this.splice(i, 1);
						i--;
						continue;
					} else {
						this.splice(i, 1);
						i--;
					}
				} else {
					creaHexs = creaHexs.concat(this[i].creature.hexagons);
				}
				if (stopOnCreature) {
					this.splice(i + 1, 99);
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
		for (var i = 0; i < this.length; i++) {
			for (var j = 0; j < size; j++) {
				// NOTE : This code produce array with doubles.
				if (G.grid.hexExists(this[i].y, this[i].x - j))
					ext.push(G.grid.hexs[this[i].y][this[i].x - j]);
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
	for (var i = 0; i < this.length; i++) {
		for (var j = 0; j < size; j++) {
			// NOTE : This code produces array with doubles.
			if (G.grid.hexExists(this[i].y, this[i].x + j))
				ext.push(G.grid.hexs[this[i].y][this[i].x + j]);
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
	return this[this.length - 1];
};


//-----------------//
// USEFUL MATRICES //
//-----------------//
var matrices = util.matrices || {};

matrices.diagonalup = function() {
	this.origin = [];

    return [
    	   	  [0, 0, 0, 0, 1], // Origin line
    	 	  [0, 0, 0, 0, 1], 
    	      [0, 0, 0, 1, 0], 
    	      [0, 0, 0, 1, 0], 
    	      [0, 0, 1, 0, 0], 
    	      [0, 0, 1, 0, 0], 
    	      [0, 1, 0, 0, 0], 
    	      [0, 1, 0, 0, 0], 
    	      [1, 0, 0, 0, 0]
    	   ];
};
   
matrices.diagonaldown = function() {
	this.origin = [0, 0];

	return  [
			  [1, 0, 0, 0, 0], // Origin line
			  [0, 1, 0, 0, 0],
			  [0, 1, 0, 0, 0],
		   	  [0, 0, 1, 0, 0],
			  [0, 0, 1, 0, 0],
		   	  [0, 0, 0, 1, 0],
			  [0, 0, 0, 1, 0],
		  	  [0, 0, 0, 0, 1],
			  [0, 0, 0, 0, 1]
			];
}

matrices.straitrow = function() {
	this.origin = [0, 0];

	return  [
	  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ];
}

matrices.bellowrow = function() {
	this.origin = [0, 0];

	return  [
	  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Origin line
	  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
	];
}

matrices.frontnback2hex = function() {
	this.origin = [2, 2];

	return  [
		[0, 0, 0, 0],
		[0, 1, 0, 1],
		[1, 0, 0, 1], // Origin line
		[0, 1, 0, 1]
	];
}

matrices.frontnback3hex = function() {
	this.origin = [3, 2];

	return  [
		[0, 0, 0, 0, 0],
		[0, 1, 0, 0, 1],
		[1, 0, 0, 0, 1], // Origin line
		[0, 1, 0, 0, 1]
	];
}

matrices.front2hex = function() {
	this.origin = [2, 2];

	return  [
		[0, 0, 0, 0],
		[0, 0, 0, 1],
		[0, 0, 0, 1], // Origin line
		[0, 0, 0, 1]
	];
}

matrices.back2hex = function() {
	this.origin = [2, 2];

	return  [
		[0, 0, 0, 0],
		[0, 1, 0, 0],
		[1, 0, 0, 0], // Origin line
		[0, 1, 0, 0]
	];
}

matrices.inlinefront2hex = function() {
	this.origin = [2, 2];

	return  [
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 1], // Origin line
		[0, 0, 0, 0]
	];
}

matrices.inlineback2hex = function() {
	this.origin = [2, 2];

	return  [
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[1, 0, 0, 0], // Origin line
		[0, 0, 0, 0]
	];
}

matrices.inlinefrontnback2hex = function() {
	this.origin = [2, 2];

	return  [
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[1, 0, 0, 1], // Origin line
		[0, 0, 0, 0]
	];
}

matrices.front1hex = function() {
	this.origin = [1, 2];

	return  [
		[0, 0, 0],
		[0, 0, 1],
		[0, 0, 1], // Origin line
		[0, 0, 1]
	];
}

matrices.backtop1hex = function() {
	this.origin = [1, 2];

	return  [
		[0, 0, 0],
		[0, 1, 0],
		[0, 0, 0], // Origin line
		[0, 0, 0]
	];
}

matrices.inlineback1hex = function() {
	this.origin = [1, 2];

	return  [
		[0, 0, 0],
		[0, 0, 0],
		[1, 0, 0], // Origin line
		[0, 0, 0]
	];
}

matrices.backbottom1hex = function() {
	this.origin = [1, 2];

	return  [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0], // Origin line
		[0, 1, 0]
	];
}


matrices.fronttop1hex = function() {
	this.origin = [1, 2];

	return  [
		[0, 0, 0],
		[0, 0, 1],
		[0, 0, 0], // Origin line
		[0, 0, 0]
	];
}

matrices.inlinefront1hex = function() {
	this.origin = [1, 2];

	return  [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 1], // Origin line
		[0, 0, 0]
	];
}

matrices.frontbottom1hex = function() {
	this.origin = [1, 2];

	return  [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0], // Origin line
		[0, 0, 1]
	];
}
