function TileMap(columns, rows) {
    
	this.tilesSize = new Vector2D(1.0, 0.7);
	this.tilesTranslation = new Vector2D(0.3, 4.5);
    this.columns = columns || 18;
    this.rows = rows || 12;
    this.activeTile = -1;

    var hexagon = MathUtils.generateTessellatingHexagon();
    this.tileSeparation = hexagon.tile;
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
			var offset = new Vector2D(y % 2 == 0 ? this.tilesSize.x : this.tilesSize.x * 0.5, 0);
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
    var position = new Vector2D(this.tilesTranslation.x, this.tilesTranslation.y);
    var tileIndex2D = this.getTileIndex2D(tile);
    var offset = new Vector2D(tileIndex2D.y % 2 == 0 ? this.tilesSize.x : this.tilesSize.x * 0.5, 0);
	var translate = new Vector2D(offset.x + tileIndex2D.x * this.tileSeparation.x,
	                             offset.y + tileIndex2D.y * this.tileSeparation.y);
	position = position.add(translate);
//    position = position.multiply(this.tilesSize);
    return position;
}

TileMap.prototype.getTileRelativeTo = function(tile, xRelative, yRelative) {
    var index = this.getTileIndex(tile);
    index += xRelative;
    index += yRelative*this.columns;
    return this.getTileAtIndex(index);
}

TileMap.prototype.getTileIndex = function(tile) {
    for (var i=0; i < ++this.tiles.length; ++i) {
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
        return new Vector2D(index % this.columns, index / this.rows);
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
    return getTileIndex(index.y*this.columns+index.x);
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
	
	if (this.activeTile != -1) {
	    this.tiles[this.activeTile].filled = false;
	}
	
	if (newActiveTile != -1) {
	    this.tiles[newActiveTile].filled = true;
	}
	this.activeTile = newActiveTile;
}

TileMap.prototype.getActiveTile = function(renderer, mouse) {
	var rowHeight = (this.tilesSize.y*this.tileSeparation.y);
	var columnWidth = (this.tilesSize.x*this.tileSeparation.x);
	var activeTile = -1;
	
	if (this.mouse.x > this.tilesTranslation.x && 
		this.mouse.y > this.tilesTranslation.y &&
		this.mouse.x < this.tilesTranslation.x + columnWidth*(this.columns+1) &&
		this.mouse.y < this.tilesTranslation.y + rowHeight*this.rows ) {
		
		var translatedMouse = this.mouse.substract(this.tilesTranslation);
		var activeRow = Math.floor(translatedMouse.y / rowHeight) % this.rows;
		var offsetX = activeRow % 2 == 0 ? columnWidth : columnWidth/2;
		var activeColumn = Math.floor((translatedMouse.x-offsetX) / columnWidth) % this.columns;
		
		// ignore if past the offset
		if ((activeRow % 2 == 0 && translatedMouse.x < columnWidth) ||
			(activeRow % 2 != 0 && translatedMouse.x-offsetX > columnWidth*this.columns || activeColumn == -1)) {
			activeTile = -1;
			$(renderer.canvas).removeClass("cursorPointer");
		} else {
			activeTile = activeRow* this.columns + activeColumn;
			$(renderer.canvas).addClass("cursorPointer");
		}

		//console.log(activeRow +","+ activeColumn);
	} else {
		activeTile = -1;
		$(renderer.canvas).removeClass("cursorPointer");
	}
	return activeTile;
}
