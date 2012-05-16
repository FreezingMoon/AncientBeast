function Creature(centerTile, renderer) {

    this.name = "Magma Spwan";
    // collision map:
    // 0 does not collide on this tile
    // 1 collides on this tile
    // 2 blocks tile for creatures, but does not collide with terrain (flying)
    this.collisionMap = [
// remember the optical offset when using multiple y rows
         [1,1,0],
        [1,1,1],
         [1,1,0]
    ];
    
    // TODO move into Sprite class
    this.position = Vector2D(2,4);
    this.size = new Vector2D(4,2.5);
    this.texturePosition = new Vector2D(0,0);
    this.textureSize = new Vector2D(600, 460);
    
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

Creature.prototype.setAtTile = function(tile) {
    var tileMap = tile.tileMap;
    this.position = tileMap.getTilePosition(tile);
    this.position.y -= this.size.y;
    this.position.x -= this.size.x/6;
    
    // clear old surrounding collision tiles
    if (this.centerTile) {
        for (var y=0; y < this.collisionMap.length; ++y) {
            for (var x=0; x < this.collisionMap[y].length; ++x) {
                if (this.collisionMap[y][x] > 0) {
                    var t = tileMap.getTileRelativeTo(tile, Math.floor(-(this.collisionMap[y].length/2)+x+1),
                                                            Math.floor(-(this.collisionMap.length/2)+y+1));
                    t.creature = null;
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
