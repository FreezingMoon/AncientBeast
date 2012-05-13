function Tile(shape, color) {
    this.shape = shape;
    this.color = color || "#739141";
    this.fillColor = "rgba(250, 145, 65, 0.2)";

    this.creature = null;
    this.trap = null;
    this.terrain = 1; // TODO create Enum 0:default 1:walkable 2:blocked.
    this.terrainType = 0; // Elemental type, water, lava, aso
    this.lineWidth = 0.04;
}

Tile.prototype = new Drawable();

Tile.prototype.draw = function(renderer) {
    if (this.filled) {
        renderer.setColor(this.fillColor);
	    renderer.setLineWidth(this.lineWidth);
	    renderer.drawPolygon(this.shape);
    }
    renderer.setColor(this.color);
    renderer.setLineWidth(this.lineWidth);
    renderer.drawLine(this.shape);
}

// TODO apply effects like water, lava, traps to creature on tile
Tile.prototype.onNextRound = function() {

}
