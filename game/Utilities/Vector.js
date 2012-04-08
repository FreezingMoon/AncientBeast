function Vector2D(x,y) {
	this.x = x || 0;
	this.y = y || 0;
}
Vector2D.prototype = {
	add: function(other) {
		if(other instanceof Vector2D)
			return new Vector2D(this.x + other.x, this.y + other.y);
		if(typeof other == "number")
			return new Vector2D(this.x + other, this.y + other);
		return null;
	},
	substract: function(other) {
		if(other instanceof Vector2D)
			return new Vector2D(this.x - other.x, this.y - other.y);
		if(typeof other == "number")
			return new Vector2D(this.x - other, this.y - other);
		return null;
	},
	multiply: function(other) {
		if(other instanceof Vector2D)
			return new Vector2D(this.x * other.x, this.y * other.y);
		if(typeof other == "number")
			return new Vector2D(this.x * other, this.y * other);
		return null;
	},
	length: function() {
		return Math.sqrt((this.x * this.x) + (this.y * this.y));
	},
	normalize: function() {
		var length = this.length();
		return new Vector2D(this.x / length, this.y / length);
	},
	toScreenSpace: function(renderer) {
		return new Vector2D(renderer.screenSpace(this.x), renderer.screenSpace(this.y));
	},
	toUnitSpace: function(renderer) {
		return new Vector2D(renderer.unitSpace(this.x), renderer.unitSpace(this.y));
	},
}


function Vector3D(x,y,z) {
	this.x = x || 0;
	this.y = y || 0;
	this.z = z || 0;
}
Vector3D.prototype = {
	add: function(other) {
		if(other instanceof Vector3D)
			return new Vector3D(this.x + other.x, this.y + other.y, this.z + other.z);
		if(typeof other == "number")
			return new Vector3D(this.x + other, this.y + other, this.z + other);
		return null;
	},
	substract: function(other) {
		if(other instanceof Vector3D)
			return new Vector3D(this.x - other.x, this.y - other.y, this.z - other.z);
		if(typeof other == "number")
			return new Vector3D(this.x - other, this.y - other, this.z - other);
		return null;
	},
	multiply: function(other) {
		if(other instanceof Vector3D)
			return new Vector3D(this.x * other.x, this.y * other.y, this.z * other.z);
		if(typeof other == "number")
			return new Vector3D(this.x * other, this.y * other, this.z * other);
		return null;
	},
	length: function() {
		return Math.sqrt((this.x * this.x) + (this.y * this.y) + (this.z * this.z));
	},
	normalize: function() {
		var length = this.length();
		return new Vector3D(this.x / length, this.y / length, this.z / length);
	},
	toScreenSpace: function(renderer) {
		return new Vector3D(renderer.screenSpace(this.x), renderer.screenSpace(this.y), renderer.screenSpace(this.z));
	},
	toUnitSpace: function(renderer) {
		return new Vector3D(renderer.unitSpace(this.x), renderer.unitSpace(this.y), renderer.unitSpace(this.z));
	},
}