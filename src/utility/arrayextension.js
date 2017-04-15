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