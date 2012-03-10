function Application() {
	$("#message").remove();
	$("#container").css("display", "block");

	this.mouse = new Vertex();
	this.cursorOffset = new Vertex(32, -2);
	this.cursorFrame = 0;
	this.cursorIsPointer = false;

	this.arena = new Arena();
	this.arena.init();
}

/* This handles the custom animated mouse pointer */
Application.prototype.bindMouse = function() {
	var _this = this;
	
	var timePerFrame = 50;
	var numberOfFrames = 5;
	var frameWidth = 64;
	var frameHeight = 64;
	$("#cursor-fore").attr("cropLeft", 0);
	$("#cursor-back").attr("cropLeft", 0);
	$(".cursor").css({
		"width": frameWidth * numberOfFrames,
		"height": frameHeight,
		"clip": "rect(0px," + frameWidth + "px," + frameHeight + "px,0px)"
	});
	$("*").css({
		"cursor": "url('blank.cur'), default",
		"-webkit-user-select": "none",
		"-ms-user-select": "none",
		"-moz-user-select": "none",
		"-o-user-select": "none",
		"user-select": "none",
	});
	
	function beginAnimation(isFirst) {
		if(!isFirst) {
			if(_this.cursorFrame >= numberOfFrames - 1) {
				_this.cursorFrame = numberOfFrames - 1;
				$("#cursor-back").css("opacity", 0.0);
				$("#cursor-fore").css("opacity", 1.0);
				return;
			}
			if(_this.cursorFrame <= 0) {
				_this.cursorFrame = 0;
				$("#cursor-back").css("opacity", 0.0);
				$("#cursor-fore").css("opacity", 1.0);
				return;
			}
		}
		
		var backMargin = _this.cursorFrame * frameWidth;
		var foreMargin = (_this.cursorIsPointer ? _this.cursorFrame + 1 : _this.cursorFrame - 1) * frameWidth;
		
		$("#cursor-fore").css({
			"opacity": 0.0,
			"left": _this.mouse.x - foreMargin - _this.cursorOffset.x,
			"clip": "rect(0px," + (foreMargin + frameWidth) + "px," + frameHeight + "px," + foreMargin + "px)",
		});
		$("#cursor-back").css({
			"left": _this.mouse.x - backMargin - _this.cursorOffset.x,
			"clip": "rect(0px," + (backMargin + frameWidth) + "px," + frameHeight + "px," + backMargin + "px)",
			"opacity": 1.0,
		});
		
		$("#cursor-fore").attr("cropLeft", foreMargin);
		$("#cursor-back").attr("cropLeft", backMargin);
		
		$("#cursor-fore").animate({"opacity": 1.0}, {
			duration: timePerFrame,
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
			}
		});
	}
	
	$(window).on("mousemove", function(e) {
		/* Any element with the class cursorPointer will have a 'pointer' cursor
		   More cursor types can be added later */
		_this.mouse = new Vertex(e.clientX, e.clientY);
		$(".cursor").css("top", _this.mouse.y - _this.cursorOffset.y);
		$("#cursor-fore").css("left", _this.mouse.x - $("#cursor-fore").attr("cropLeft") - _this.cursorOffset.x);
		$("#cursor-back").css("left", _this.mouse.x - $("#cursor-back").attr("cropLeft") - _this.cursorOffset.x);
		
		var isPointer = false;
		
		$(".cursorPointer").each(function(i) {
			var offset = $(this).offset();
			var upper = new Vertex(offset.left, offset.top);
			var lower = new Vertex(offset.left + $(this).width(), offset.top + $(this).height());
			if(_this.mouse.x >= upper.x && _this.mouse.x <= lower.x &&
					_this.mouse.y >= upper.y && _this.mouse.y <= lower.y) {
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
