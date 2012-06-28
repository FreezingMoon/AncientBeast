/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2012  Valentin Anastase (a.k.a. Dread Knight)
 *
 * This file is part of Ancient Beast.
 *
 * Ancient Beast is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Ancient Beast is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * http://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

function Application() {
	$("#message").remove();
	$("#container").css("display", "block");

	this.mouse = new Vector2D();
	this.cursorOffset = new Vector2D(25, 3);
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
		"cursor": "url('../images/blank.cur'), default",
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
		_this.mouse = new Vector2D(e.clientX, e.clientY);
		$(".cursor").css("top", _this.mouse.y - _this.cursorOffset.y);
		$("#cursor-fore").css("left", _this.mouse.x - $("#cursor-fore").attr("cropLeft") - _this.cursorOffset.x);
		$("#cursor-back").css("left", _this.mouse.x - $("#cursor-back").attr("cropLeft") - _this.cursorOffset.x);
		
		var isPointer = false;
		
		$(".cursorPointer").each(function(i) {
			var offset = $(this).offset();
			var upper = new Vector2D(offset.left, offset.top);
			var lower = new Vector2D(offset.left + $(this).width(), offset.top + $(this).height());
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
