function Application() {
	this.cursorOffset = new Vertex(32, -2);
	$("#message").remove();
	$("canvas").each(function() {
		$(this).css({"display": "block"});
	});
	/*
	$(window).mousemove(function(e){
		mouseX = e.clientX - ($(window).width() - gameWidth) / 2;
		mouseY = e.clientY - ($(window).height() - gameHeight) / 2;
	});
	
	$(window).resize(function () {
		clearTimeout(windowResizeTimeout);
		windowResizeTimeout = setTimeout("windowResize();", 100);
	});
	*/
	this.arena = new Arena();
	this.arena.init();
}

/* Utils */
window.requestAnimFrame = (function () {
	return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
	function (callback, element) {
		window.setTimeout(callback, 1000 / 60);
	};
})();

/* Events */
$(document).ready(function () {
	window.app = new Application();
});
