function Creature(centerTile, renderer) {

    this.name = "Magma Spwan";
    // collision map:
    // 0 does not collide on this tile
    // 1 collides on this tile
    // 2 blocks tile for creatures, but does not collide with terrain (flying)
    this.collisionMap = [
        [0,1,1],
         [1,1,1]
    ];
    
    // TODO move into Sprite class
    this.position = Vector2D(0,0);
    this.size = new Vector2D(4,2.5); //TODO set size relative to tileSize
    this.texturePosition = new Vector2D(0,0);
    this.textureSize = new Vector2D(600, 460);
    this.footOffset = new Vector2D(0.8, 0); //TODO set as pixel and convert
//    this.footPosition.toUnitSpace(renderer); 
    
    this.image = "creatures/Magma-Spawn-carboard.png";
    renderer.fetchTexture("creatures/Magma-Spawn-carboard.png", this.onReady);
      
    this.setAtTile(centerTile); //TODO add a check if is free
}
// TODO extend from sprite
Creature.prototype = new Drawable();

Creature.prototype.draw = function(renderer) {
    renderer.bindTexture("creatures/Magma-Spawn-carboard.png");
    renderer.drawImage(this.position, this.size, this.texturePosition, this.textureSize);
}

// call when all textures are loaded and the Creature is ready to be displayed
Creature.prototype.onReady = function() {
    if (this.onReadyCallback) {
        this.onReadyCallback();
    }
}

//TODO shift offset rows
Creature.prototype.setAtTile = function(tile) {
    var tileMap = tile.tileMap;
    //TODO use a footPosition Vector2D
    this.position = tileMap.getTilePosition(tile);
    this.position = this.position.substract(this.footOffset);
    
    // clear old surrounding collision tiles
    if (this.centerTile) {
        for (var y=0; y < this.collisionMap.length; ++y) {
            for (var x=0; x < this.collisionMap[y].length; ++x) {
                if (this.collisionMap[y][x] > 0) {
                    var t = tileMap.getTileRelativeTo(this.centerTile, Math.floor(-(this.collisionMap[y].length/2)+x+1),
                                                                       Math.floor(-(this.collisionMap.length/2)+y+1));
                    t.creature = null;
                    t.filled = false;
                }
            }
        }
    }
    
    // occupy surrounding collision tiles
    for (var y=0; y < this.collisionMap.length; ++y) {
        for (var x=0; x < this.collisionMap[y].length; ++x) {
            if (this.collisionMap[y][x] > 0) {
                var t = tileMap.getTileRelativeTo(tile, Math.floor(-(this.collisionMap[y].length/2)+x+1),
                                                        Math.floor(-(this.collisionMap.length/2)+y+1));
                t.creature = this;
                t.filled = true;
            }
        }
    }
    this.centerTile = tile;
}

Creature.prototype.setTileStyle = function(filled, fillColor, color) {
    //TODO write foreachTile funciton to avoid the same for loop over and over again
    var tileMap = this.centerTile.tileMap;
    if (this.centerTile) {
        for (var y=0; y < this.collisionMap.length; ++y) {
            for (var x=0; x < this.collisionMap[y].length; ++x) {
                if (this.collisionMap[y][x] > 0) {
                    var t = tileMap.getTileRelativeTo(this.centerTile, Math.floor(-(this.collisionMap[y].length/2)+x+1),
                                                                       Math.floor(-(this.collisionMap.length/2)+y+1));
                    filled    != null ? t.filled = filled : 0;
                    fillColor != null ? t.fillColor = fillColor : 0;
                    color     != null ? t.color = color : 0;
                }
            }
        }
    }
}
