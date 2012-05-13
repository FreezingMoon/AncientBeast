function Tile() {
    this.creature = null;
    this.trap = null;
    this.terrain = 1; // TODO create Enum 0:default 1:walkable 2:blocked.
    this.terrainType = 0; // Elemental type, water, lava, aso
    this.shape = shape;
}

Tile.prototype = new Drawable();

Tile.prototype.draw = function(renderer) {
    renderer.setColor(this.color);
	renderer.setLineWidth(0.0);
	renderer.drawPolygon(tileShape);
	renderer.setLineWidth(0.04);
	renderer.setColor("#739141"); 
}

// TODO apply effects like water, lava, traps to creature on tile
Tile.prototype.onNextRound = function() {

}
