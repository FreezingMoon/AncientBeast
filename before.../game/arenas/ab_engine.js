/****************************************
      - Ancient Beast Game Engine -

Some notes:
  > When drawing to the canvas, never use
    pixel values. Instead, use screenSpace(unit)
    to convert game units into pixels. This
    ensures compatibility with dynamic
    resolutions. There are 20 units in the
    entire width of the canvas, as defined by
    the variable unitsPerRow. There will
    always be 20 units in the width of the canvas,
    no matter what resolution is used.
  > The game will be developed in a 16:9
    aspect ratio. The game will be resizable,
    dependant on the body element.

****************************************/
/* Constant values */
var aspectRatio = 16 / 9;
var unitsPerRow = 20;
var gameWidth;
var gameHeight;
var unitsPerColumn;
var pixelsPerUnit;

/* Other values */
var arena;
var tiles;
var mouseX;
var mouseY;
var images = new Array();
var windowResizeTimeout;

/* Math functions */
function screenSpace(input) {
	return input * pixelsPerUnit;
}
function degToRad(input) {
	return input / (180 / Math.PI);
}

/* Other functions */
function generatePolygon(segments) {
	var step = Math.PI * 2 / segments;
	var rad90 = degToRad(90);
	var scaleX = 2 - (Math.cos(Math.round(segments * 0.25) * step - rad90) - Math.cos(Math.round(segments * 0.75) * step - rad90)) / 2;
	var scaleY = 2 - (Math.sin(Math.round(segments * 0.50) * step - rad90) - Math.sin(-rad90)) / 2;
	var out = new Array(segments);
	for (var i = 0; i < segments; i++) {
		out[i] = new Array(2);
		out[i][0] = Math.cos(i * step - rad90) / 2 * scaleX + 0.5;
		out[i][1] = Math.sin(i * step - rad90) / 2 * scaleY + 0.5;
	}
	return out;
}
function drawPolygon(polygon, c) {
	c.beginPath();
	c.moveTo(polygon[0][0], polygon[0][1]);
	for (var i = 1; i < polygon.length; i++) {
		c.lineTo(polygon[i][0], polygon[i][1]);
	}
	c.closePath();
}
function clearCanvas(c) {
	c.setTransform(1, 0, 0, 1, 0, 0);
	c.clearRect(0, 0, gameWidth, gameHeight);
}
function resizeCanvas(size, isWidth) {
	if (isWidth) {
		gameWidth = size;
		gameHeight = gameWidth / aspectRatio;
	} else {
		gameHeight = size;
		gameWidth = gameHeight * aspectRatio;
	}
	unitsPerColumn = unitsPerRow / gameWidth * gameHeight;
	pixelsPerUnit = gameWidth / unitsPerRow;
	$("canvas").each(function() {
		$(this).css({
			"width": gameWidth + "px",
			"height": gameHeight + "px",
			"margin": (gameHeight / -2) + "px 0px 0px " + (gameWidth / -2) + "px",
		});
		$(this)[0].getContext("2d").canvas.width = gameWidth;
		$(this)[0].getContext("2d").canvas.height = gameHeight;
		
	});
}
function windowResize() {
	isWidth = ($(window).width() / $(window).height()) < aspectRatio;
	resizeCanvas(isWidth ? $(window).width() : $(window).height(), isWidth);
}
window.requestAnimFrame = (function () {
	return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
	function (callback, element) {
		window.setTimeout(callback, 1000 / 60);
	};
})();

/* Game code */
function init() {
	arena = $("#arena")[0].getContext("2d");
	tiles = $("#tiles")[0].getContext("2d");
	if (!arena || !tiles) return false;

	var f = new Image();
	f.src = "arenas/forest.jpg";
	images["forest"] = f;

	windowResize();
	$("#message").remove();
	$("canvas").each(function() {
		$(this).css({"display": "block"});
	});
	$(window).mousemove(function(e){
		mouseX = e.clientX - ($(window).width() - gameWidth) / 2;
		mouseY = e.clientY - ($(window).height() - gameHeight) / 2;
	});
	$(window).resize(function () {
		clearTimeout(windowResizeTimeout);
		windowResizeTimeout = setTimeout("windowResize();", 100);
	});

	requestAnimFrame(function () {
		drawAll(drawArena, $("#arena")[0]);
	}, $("#arena")[0]);
	requestAnimFrame(function () {
		drawAll(drawTiles, $("#tiles")[0]);
	}, $("#tiles")[0]);
	return true;
}
function drawAll(f, e) {
	f();
	requestAnimFrame(function () {
		drawAll(f);
	}, e);
}
function drawArena() {
	clearCanvas(arena);
	arena.drawImage(images["forest"], 0, 0, gameWidth, gameHeight);
}
function drawTiles() {
	clearCanvas(tiles);
	var rows = 12;
	var columns = 18;
	var ySeparation = 0.85;
	var xSeparation = 1.02;
	var width = screenSpace(1.0);
	var height = screenSpace(0.68);
	var hexagon = generatePolygon(6);
	for (x = 0, y = 0; y < rows && x < columns;) {
		tiles.save();
		var offsetX = (gameWidth - (columns * xSeparation + 0.5) * width) / 2;
		var offsetY = screenSpace(4);
		offsetX += (y & 1) == 0 ? width / 2 : 0;
		tiles.translate(offsetX + x * width * xSeparation, offsetY + y * height * ySeparation);
		tiles.scale(width, height);
		drawPolygon(hexagon, tiles);
		tiles.strokeStyle = "#739141";
		tiles.lineWidth = screenSpace(0.04) / width;
		tiles.stroke();
		tiles.restore();
		if (x == columns - 1) {
			y++;
			x = 0;
		} else x++;
	}
}

/* Events */
$(document).ready(function () {
	init();
});