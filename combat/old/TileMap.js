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

function TileMap(columns, rows) {
	// Scale of TileMap
	this.tilesSize = new Vector2D(1.0, 0.75);
	// Location of TileMap
	this.tilesTranslation = new Vector2D(0.25, 3.5);

	this.columns = columns || 2;
	this.rows = rows || 2;
	this.activeTile = null;

	var hexagon = MathUtils.generateTessellatingHexagon();
	this.tileSeparation = hexagon.tile;
	console.log(this.tileSeparation);
	this.tileShape = hexagon.vertices;

	var size = this.rows*this.columns;
	this.tiles = new Array();
	for (var i=0; i < size; ++i) {
		this.tiles.push(new Tile(this.tileShape));
		this.tiles[i].tileMap = this;
	}
}

TileMap.prototype.draw = function(renderer) {
	renderer.save();
	renderer.translate(this.tilesTranslation);
	renderer.scale(this.tilesSize);
	for (var y=0; y < this.rows; ++y) { 
		for (var x=0; x < this.columns; ++x) {
			renderer.save();
			var offset = new Vector2D(y % 2 == 0 ? 0 : this.tilesSize.x * 0.5, 0);
			var translate = new Vector2D(offset.x + x * this.tileSeparation.x, offset.y + y * this.tileSeparation.y);
			renderer.translate(translate);		

			this.tiles[y*this.columns + x].draw(renderer);

			renderer.restore();
		}
	}
	renderer.restore();
}

/// @return Vector2D the actual x,y position the tile has on the renderer target.
TileMap.prototype.getTilePosition = function(tile) {
	var tileIndex2D = this.getTileIndex2D(tile);
	var position = new Vector2D(tileIndex2D.x, tileIndex2D.y);
	var offsetX = tileIndex2D.y % 2 == 0 ? 0 : 0.5;
	position.x = position.x + offsetX;
	position = position.multiply(this.tilesSize);
	position = position.multiply(this.tileSeparation);
	position = position.add(this.tilesTranslation);
	return position;
}

TileMap.prototype.getTileRelativeTo = function(tile, xRelative, yRelative) {
	var index = this.getTileIndex(tile);
	index += xRelative;
	index += yRelative*this.columns;
	return this.getTileAtIndex(index);
}

TileMap.prototype.getTileIndex = function(tile) {
	for (var i=0; i < this.tiles.length; ++i) {
		if (tile == this.tiles[i]) {
			return i;
		}
	}
	console.log("Warning: trying to find a tile that's not on this tilemap:" + tile)
	return -1;
}

TileMap.prototype.getTileIndex2D = function(tile) {
	var index = this.getTileIndex(tile);
	if (index > -1) {
		return new Vector2D(index % this.columns, (index - (index % this.columns)) / this.columns);
	} else {
		return null;
	}
}

TileMap.prototype.getTileAtIndex = function(index) {
	if (this.isValidIndex(index)) {
		return this.tiles[index];
	} else {
		console.log("Warning: trying to access invalid index of Tilemap: " + index);
		return null;
	}
}

TileMap.prototype.getTileAtIndex2D = function(index) {
	return this.getTileAtIndex(index.y*this.columns+index.x);
}

TileMap.prototype.isValidIndex = function(index) {
	return index >= 0 && index < this.columns*this.rows;
}

TileMap.prototype.isValidIndex2D = function(index2D) {
	return index.x >= 0 && index.y >= 0 && index.x < this.columns && index.y < this.rows;
}

// TODO move into a child class so that this one stays more independent form logic
TileMap.prototype.onMouseMove = function(renderer, mouse) {
	this.mouse = mouse;

	var newActiveTile = this.getActiveTile(renderer, mouse);
	//TODO group if blocks
		
	if (this.activeTile != null) {
		this.activeTile.filled = false;
	}
	
	// Highlight selected Creature's tiles
	if (this.activeTile != null && this.activeTile.creature == this.activeCreature && this.activeCreature != null) {
		this.activeTile.creature.setTileStyle(false, "rgba(65, 145, 250, 0.2)");
	}
	
	if (newActiveTile != null && newActiveTile.creature != null) {
		newActiveTile.creature.setTileStyle(true, "rgba(65, 145, 250, 0.2)");
		this.activeCreature = newActiveTile.creature;
	}
	
	if (newActiveTile != null) {
		newActiveTile.filled = true;
		newActiveTile.fillColor = "rgba(250, 145, 65, 0.2)";
		this.activeTile = newActiveTile;
	} else {
		this.activeTile = null;
	}
	
}

TileMap.prototype.getActiveTile = function(renderer, mouse) {
	var rowHeight = (this.tilesSize.y*this.tileSeparation.y);
	var columnWidth = (this.tilesSize.x*this.tileSeparation.x);
	var halfColumnWidth = columnWidth * 0.5;
	var activeTile = null;
	
	if (mouse.x > this.tilesTranslation.x && 
		mouse.y > this.tilesTranslation.y &&
		mouse.x < this.tilesTranslation.x + columnWidth * this.columns + halfColumnWidth &&
		mouse.y < this.tilesTranslation.y + rowHeight * this.rows) {
		
		var translatedMouse = mouse.substract(this.tilesTranslation);
		var activeRow = Math.floor(translatedMouse.y / rowHeight) % this.rows;
		var isOddRow = (activeRow % 2) == 0;
		var activeColumn = Math.floor((translatedMouse.x - (isOddRow ? 0 : halfColumnWidth)) / columnWidth) % this.columns;
		
		// ignore if past the offset
		if ((!isOddRow && translatedMouse.x < halfColumnWidth) ||
			(isOddRow && translatedMouse.x > columnWidth * this.columns || activeColumn == -1)) {
			activeTile = null;
			$(renderer.canvas).removeClass("cursorPointer");
		} else {
			activeTile = this.tiles[activeRow * this.columns + activeColumn];
			$(renderer.canvas).addClass("cursorPointer");
		}

		//console.log(activeRow +","+ activeColumn);
	} else {
		activeTile = null;
		$(renderer.canvas).removeClass("cursorPointer");
	}
	return activeTile;
}
