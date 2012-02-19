function Arena() {
    this.tiles = new Array();
    this.tileType = null;
    this.tilesRenderer = null;
    this.arenaRenderer = null;
	this.rows = 11;
	this.columns = 18;
	this.activeTile = 0;
	this.mouse = new Vertex();
	this.tilesTranslation = new Vertex(0, 3.7);
    this.tileSeparation = new Vertex(1.00, 0.85);
	this.tileWidth = 1;
	this.tileHeight = 0.6;
	this.tilesScale = new Vertex(this.tileWidth,this.tileHeight);
	
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
  
    // Mouse events
    $(this.tilesRenderer.canvas).click(function(e) {
        _this.mouse = new Vertex(e.offsetX, e.offsetY);
	    _this.mouse = _this.mouse.toUnitSpace(_this.tilesRenderer);
	    console.log(_this.mouse);
    })
    
	$(this.tilesRenderer.canvas).mousemove(function(e){
	    _this.mouse = new Vertex(e.offsetX, e.offsetY);
	    _this.mouse = _this.mouse.add(window.app.cursorOffset);
	    _this.mouse = _this.mouse.toUnitSpace(_this.tilesRenderer);


        var rowHeight = (_this.tilesScale.y*_this.tileSeparation.y);
        var columnWidth = (_this.tilesScale.x*_this.tileSeparation.x)	    
	    
        if (_this.mouse.x > _this.tilesTranslation.x && 
            _this.mouse.y > _this.tilesTranslation.y &&
            _this.mouse.x < _this.tilesTranslation.x + columnWidth*(_this.columns+1) &&
            _this.mouse.y < _this.tilesTranslation.y + rowHeight*_this.rows ) {
            
            $(_this.tilesRenderer.canvas).addClass("cursorPointer");
            
            var translatedMouse = _this.mouse.substract(_this.tilesTranslation);

    	    var activeRow = Math.floor(translatedMouse.y / rowHeight) % _this.rows;

	        var offsetX = activeRow % 2 == 0 ? _this.tileWidth : _this.tileWidth/2;
	        var activeColumn = Math.floor((translatedMouse.x-offsetX) / _this.tileWidth) % _this.columns;

    	    _this.activeTile = activeRow* _this.columns + activeColumn;
    	    console.log(activeRow +","+ activeColumn);
        } else {
            $(_this.tilesRenderer.canvas).removeClass("cursorPointer");
        }
	});
  
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
    var offset;
    
    this.tilesRenderer.clear();
    this.tilesRenderer.setColor("#739141");
    this.tilesRenderer.setLineWidth(0.04);
    this.tilesRenderer.save();
    this.tilesRenderer.translate(this.tilesTranslation);
    this.tilesRenderer.scale(this.tilesScale);
    for (var y=0; y < this.rows; ++y) { 
        for (var x=0; x < this.columns; ++x) {
            this.tilesRenderer.save();
            offset = new Vertex(y % 2 == 0 ? this.tileWidth : this.tileWidth/2, 0);
            var translate = new Vertex(offset.x + x * this.tileSeparation.x, offset.y + y * this.tileSeparation.y);
            
            if (y*this.columns + x == this.activeTile) {
                this.tilesRenderer.setColor("#FA9141");
                this.tilesRenderer.setLineWidth(0.1);
            }
            
            this.tilesRenderer.translate(translate);
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


