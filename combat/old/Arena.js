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

function Arena() {
	this.tiles = new Array();
	this.tilesRenderer = null;
	this.arenaRenderer = null;
	this.activeTile = -1;
	this.mouse = new Vector2D();
	this.tileMap = new TileMap(16, 10);
	this.selectedCreature = null;
}

Arena.prototype.init = function() {
	var _this = this;
	// Generate Renderers
	this.tilesRenderer = new CanvasRenderer($("#tiles")[0], 17);
	this.arenaRenderer = new CanvasRenderer($("#arena")[0], 17);
	this.tilesRenderer.resizeToWindow();
	this.arenaRenderer.resizeToWindow();

	this.testCreature = new Creature(this.tileMap.getTileAtIndex2D(new Vector2D(10, 2)), this.tilesRenderer);

	// TODO use callback to do a loading screen
	this.arenaRenderer.fetchTexture("../locations/forest/bg.jpg", function() {
		_this.drawBackground();
	}); 

	// resize events
	$(window).resize(function () {
		clearTimeout(_this.windowResizeTimeout);
		_this.windowResizeTimeout = setTimeout(function() {
			_this.onResize(); 
		}, 100);
	});

	// Mouse events
	$(window).on("click", function(e) {
		_this.mouse = new Vector2D(e.offsetX, e.offsetY);
		_this.mouse = _this.mouse.toUnitSpace(_this.tilesRenderer);
		console.log(_this.mouse);
		if (_this.tileMap.activeTile != null) {
			if (_this.selectedCreature == null) {
				_this.selectedCreature = _this.tileMap.activeTile.creature;
			} else {
				_this.selectedCreature.setAtTile(_this.tileMap.activeTile);
			}
		} 
	})

	$(window).on("mousemove", function(e){
		_this.mouse = new Vector2D(e.pageX - $(_this.tilesRenderer.canvas).offset().left,
								   e.pageY - $(_this.tilesRenderer.canvas).offset().top);
		_this.mouse = _this.mouse.toUnitSpace(_this.tilesRenderer);
		_this.tileMap.onMouseMove(_this.tilesRenderer, _this.mouse);
	});

	window.requestAnimFrame(function () {
		_this.drawAll(_this.drawTiles, _this.tilesRenderer.canvas);
	}, _this.tilesRenderer.canvas);

	return true;
}

Arena.prototype.onResize = function() {
	console.log("resizeing");
	this.tilesRenderer.resizeToWindow();
	this.arenaRenderer.resizeToWindow();
	this.drawBackground();
}

Arena.prototype.drawAll = function(f, element) {
	var _this = this;

	f.call(this);
	window.requestAnimFrame(function () {
		_this.drawAll(f);
	}, element);
}

Arena.prototype.drawBackground = function() {
	var backgroundSize = new Vector2D(this.arenaRenderer.unitsPerRow, this.arenaRenderer.unitsPerColumn);
	this.arenaRenderer.clear();
	this.arenaRenderer.bindTexture("../locations/forest/bg.jpg");
	this.arenaRenderer.drawImage(new Vector2D(0, 0), backgroundSize, new Vector2D(0,0), new Vector2D(1920, 1080));
}

Arena.prototype.drawTiles = function() {
	this.tilesRenderer.clear();
	this.tileMap.draw(this.tilesRenderer);
	this.testCreature.draw(this.tilesRenderer);
}

Arena.prototype.draw = function() {

}
