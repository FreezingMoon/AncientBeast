function Arena() {
    this.tiles = new Array();
    this.tileType = null;
    this.tilesRenderer = null;
    this.arenaRenderer = null;
	this.rows = 12;
	this.columns = 18;
}

Arena.prototype.init = function() {
    var _this = this;
    // Generate Renderers
    this.tilesRenderer = new CanvasRenderer($("#tiles")[0]);
    this.arenaRenderer = new CanvasRenderer($("#arena")[0]);
    this.tilesRenderer.resizeToWindow();
    this.arenaRenderer.resizeToWindow();
    // TODO use callback to do a loading screen
    this.arenaRenderer.fetchTexture("arenas/forest.jpg"); 
    
    // resize events
    $(window).resize(function () {
		clearTimeout(_this.windowResizeTimeout);
		_this.windowResizeTimeout = setTimeout(function() {
    		_this.onResize(); 
		}, 100);
	});
    
    // Genrate tiles
    this.tileType = this.generateHexTile();
/*    $.each(this.tileType, function() {
        _this.tileWidth  < this.x ? _this.tileWidth  = this.x : 0;
        _this.tileHeight < this.y ? _this.tileHeight = this.y : 0;
    });
  */  
    // Request draw
	window.requestAnimFrame(function () {
		_this.drawAll(_this.drawArena, _this.arenaRenderer.canvas);
	}, _this.arenaRenderer.canvas);
	
	window.requestAnimFrame(function () {
		_this.drawAll(_this.drawTiles, _this.tilesRenderer.canvas);
	}, _this.tilesRenderer.canvas);
	return true;
}

Arena.prototype.onResize = function() {
    console.log("resizeing");
    this.tilesRenderer.resizeToWindow();
    this.arenaRenderer.resizeToWindow();
}

Arena.prototype.drawAll = function(f, element) {
    var _this = this;
    
    f.call(this);
    window.requestAnimFrame(function () {
        _this.drawAll(f);
    }, element);
}
Arena.prototype.drawArena = function() {
    var backgroundSize = new Vertex(this.arenaRenderer.unitsPerRow, this.arenaRenderer.unitsPerColumn);
    this.arenaRenderer.clear();
    this.arenaRenderer.bindTexture("arenas/forest.jpg");
    this.arenaRenderer.drawImage(new Vertex(0, 0), backgroundSize, new Vertex(0,0), new Vertex(1920, 1080));
}

Arena.prototype.drawTiles = function() {
    var xSpaceing = this.tileWidth;
    var ySpaceing = this.tileHeight;
    
//    var offset = new Vertex(2, 0.5);
    var separation = new Vertex(1.02, 0.85);
	var width = 1.0;
	var height = 0.68;
    
    this.tilesRenderer.setColor("#739141");
    this.tilesRenderer.setLineWidth(0.004);
    this.tilesRenderer.save();
    this.tilesRenderer.scale(new Vertex(width,height));
    this.tilesRenderer.translate(new Vertex(0, 6));
    for (var y=0; y < this.rows; ++y) { 
        for (var x=0; x < this.columns; ++x) {
            this.tilesRenderer.save();
//    		offset = new Vertex((gameWidth -(this.columns * separation.x + 0.5) * width) / 2, 4);
            offset = new Vertex(y % 2 == 0 ? width : width/2, 0);
            
            this.tilesRenderer.translate(new Vertex(offset.x + x * separation.x, offset.y + y * separation.y));
            this.tilesRenderer.drawLine(this.generateHexTile()); //TODO generate only once
            this.tilesRenderer.restore();
        }
    }
    
    this.tilesRenderer.restore();
}

Arena.prototype.generateHexTile = function() {
    var segments = 6;
    var step = Math.PI * 2 / segments;
	var rad90 = degToRad(90);
	var scaleX = 2 - (Math.cos(Math.round(segments * 0.25) * step - rad90) - Math.cos(Math.round(segments * 0.75) * step - rad90)) / 2;
	var scaleY = 2 - (Math.sin(Math.round(segments * 0.50) * step - rad90) - Math.sin(-rad90)) / 2;
	var out = new Array(segments);
	for (var i = 0; i < segments; i++) {
		out[i] = new Vertex();
		out[i].x = Math.cos(i * step - rad90) / 2 * scaleX + 0.5;
		out[i].y = Math.sin(i * step - rad90) / 2 * scaleY + 0.5;
	}
	return out;
}

Arena.prototype.draw = function() {
    
}


