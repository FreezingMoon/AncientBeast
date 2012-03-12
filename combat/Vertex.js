function Vertex(x,y) {
	this.x = x || 0;
	this.y = y || 0;
}

Vertex.prototype.add = function(other) {
	return new Vertex(this.x + other.x, this.y + other.y);
}

Vertex.prototype.substract = function(other) {
	return new Vertex(this.x - other.x, this.y - other.y);
}

Vertex.prototype.multiply = function(other) {
	return new Vertex(this.x * other.x, this.y * other.y);
}

Vertex.prototype.toScreenSpace = function(renderer) {
	return new Vertex(renderer.screenSpace(this.x), renderer.screenSpace(this.y));
}

Vertex.prototype.toUnitSpace = function(renderer) {
	return new Vertex(renderer.unitSpace(this.x), renderer.unitSpace(this.y));
}

