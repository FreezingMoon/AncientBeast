function Application() {
	this.mouse = new Vertex();
	this.cursorOffset = new Vertex(32, -2);
	this.cursorFrame = 0;
	this.cursorIsPointer = false;
	$("#message").remove();
	$("#container").css({"display": "block"});

	this.arena = new Arena();
	this.arena.init();
}
Application.prototype.bindMouse = function() {
	var _this = this;
	var frameLen = 150; // In milliseconds
	$("#cursor-fore").attr("cropLeft", 0);
	$("#cursor-back").attr("cropLeft", 0);
	function beginAnimation(isFirst) {
		if(!isFirst) {
			if(_this.cursorFrame >= 4) {
				_this.cursorFrame = 4;
				return;
			}
			if(_this.cursorFrame <= 0) {
				_this.cursorFrame = 0;
				return;
			}
		}
		var backMargin = _this.cursorFrame * 64;
		var foreMargin = foreMargin = (_this.cursorIsPointer ? _this.cursorFrame + 1 : _this.cursorFrame - 1) * 64;
		$("#cursor-fore").css({
			"opacity": 0.0,
			"left": _this.mouse.x - foreMargin,
			"clip": "rect(0px," + (foreMargin + 64) + "px,64px," + (foreMargin) + "px)",
		});
		$("#cursor-back").css({
			"left": _this.mouse.x - backMargin,
			"clip": "rect(0px," + (backMargin + 64) + "px,64px," + (backMargin) + "px)",
			"opacity": 1.0,
		});
		$("#cursor-fore").attr("cropLeft", foreMargin);
		$("#cursor-back").attr("cropLeft", backMargin);
		
		$("#cursor-fore").animate({"opacity": 1.0}, {duration: frameLen,
			complete: function() {
				if(_this.cursorIsPointer) {
					_this.cursorFrame++;
				} else {
					_this.cursorFrame--;
				}
				beginAnimation(false);
			},
			step: function(now) {
				$("#cursor-back").css("opacity", 1.5 - now);
			}});
	}
	
	/* This handles the custom mouse pointer */
	$(window).on("mousemove", function(e) {
		/* Any element with the class cursorPointer will have a 'pointer' cursor
		   More cursor types can be added later */
		_this.mouse = new Vertex(e.clientX, e.clientY);
		$(".cursor").css({"top": _this.mouse.y});
		$("#cursor-fore").css({"left": _this.mouse.x - $("#cursor-fore").attr("cropLeft")});
		$("#cursor-back").css({"left": _this.mouse.x - $("#cursor-back").attr("cropLeft")});
		var isPointer = false;
		$(".cursorPointer").each(function(i) {
			var offset = $(this).offset();
			var upper = new Vertex(offset.left, offset.top);
			var lower = new Vertex(offset.left + $(this).width(), offset.top + $(this).height());
			if((_this.mouse.x + _this.cursorOffset.x) >= upper.x && (_this.mouse.x + _this.cursorOffset.x) <= lower.x &&
					(_this.mouse.y + _this.cursorOffset.y) >= upper.y && (_this.mouse.y + _this.cursorOffset.y) <= lower.y) {
				isPointer = true;
				return false;
			}
		});
		if(_this.cursorIsPointer != isPointer) {
			$(".cursor").stop(true);
			_this.cursorIsPointer = isPointer;
			beginAnimation(true);
		}
	});
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
	window.app.bindMouse();
});
