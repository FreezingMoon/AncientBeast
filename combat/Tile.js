/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2012  Valentin Anastase (a.k.a. Dread Knight)
 *
 * This file is part of Ancient Beast.
 *
 * Ancient Beast is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Ancient Beast is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * http://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

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
