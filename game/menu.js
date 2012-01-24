/****************************************
      - Ancient Beast Main Menu -

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
	> For tiny screens, we could use static "carboards"
	for creatures and smaller backgrounds for arenas
	and for menus
	> TODO: move this info into a proper document

****************************************/
/* Constant values */
var aspectRatio = 16 / 9;
var unitsPerRow = 20;
var gameWidth;
var gameHeight;
var unitsPerColumn;
var pixelsPerUnit;

/* Other values */
var menu;
var items;
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
	menu = $("#menu")[0].getContext("2d");
	items = $("#items")[0].getContext("2d");
	if (!menu || !items) return false;

	var f = new Image();
	f.src = "menu/Reaper.jpg";
	images["Reaper"] = f;

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
		drawAll(drawMenu, $("#menu")[0]);
	}, $("#menu")[0]);
	requestAnimFrame(function () {
		drawAll(drawItems, $("#items")[0]);
	}, $("#items")[0]);
	return true;
}
function drawAll(f, e) {
	f();
	requestAnimFrame(function () {
		drawAll(f);
	}, e);
}
function drawMenu() {
	clearCanvas(menu);
	menu.drawImage(images["Reaper"], 0, 0, gameWidth, gameHeight);
}
function drawItems() {
	clearCanvas(items);
	var rows = 12;
	var columns = 18;
	var ySeparation = 0.85;
	var xSeparation = 1.02;
	var width = screenSpace(1.0);
	var height = screenSpace(0.68);
	var hexagon = generatePolygon(6);
	for (x = 0, y = 0; y < rows && x < columns;) {
		items.save();
		var offsetX = (gameWidth - (columns * xSeparation + 0.5) * width) / 2;
		var offsetY = screenSpace(4);
		offsetX += (y & 1) == 0 ? width / 2 : 0;
		items.translate(offsetX + x * width * xSeparation, offsetY + y * height * ySeparation);
		items.scale(width, height);
		drawPolygon(hexagon, items);
		items.strokeStyle = "#739141";
		items.lineWidth = screenSpace(0.04) / width;
		items.stroke();
		items.restore();
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
