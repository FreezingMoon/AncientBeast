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

function CanvasRenderer(canvas, unitsPerRow) {
	Renderer.prototype.constructor.call(this, unitsPerRow); // call super consturctor
	this.canvas  = canvas;
	this.context = canvas.getContext("2d");
}
CanvasRenderer.prototype = new Renderer(); // inherit

CanvasRenderer.prototype.clear = function() {
	this.context.setTransform(1, 0, 0, 1, 0, 0);
	this.context.clearRect(0, 0, this.gameWidth, this.gameHeight);
}

CanvasRenderer.prototype.translate = function(translation) {
	translation = translation.toScreenSpace(this);
	this.context.translate(translation.x, translation.y);
}

CanvasRenderer.prototype.scale = function(scale) {
//	scale = scale.toScreenSpace(this);
	this.context.scale(scale.x, scale.y);
}

CanvasRenderer.prototype.drawLine = function(vertices) {
	this.context.beginPath();
	if (vertices.length >= 1) {

		var v = vertices[0].toScreenSpace(this);
		this.context.moveTo(v.x, v.y);

		for (var i = 1; i < vertices.length; i++) {
			v = vertices[i].toScreenSpace(this);
			this.context.lineTo(v.x, v.y);
		}
	}
	this.context.closePath();
	this.context.stroke();
}

CanvasRenderer.prototype.drawPolygon = function(vertices) {
	this.drawLine(vertices);
	this.context.fill();
}

CanvasRenderer.prototype.drawImage = function(destOffset, destSize, srcOffset, srcSize) {
	if (this.boundTexture) {
		destOffset = destOffset.toScreenSpace(this);
		destSize   = destSize.toScreenSpace(this);
//		srcOffset  = srcOffset.toScreenSpace(this);
//		srcSize	= srcSize.toScreenSpace(this);
		this.context.drawImage(this.boundTexture, srcOffset.x, srcOffset.y,
			srcSize.x, srcSize.y, destOffset.x, destOffset.y, destSize.x, destSize.y);
	}
}


CanvasRenderer.prototype.setColor = function(color) {
	this.context.fillStyle = color;
	this.context.strokeStyle = color;
}

CanvasRenderer.prototype.setLineWidth = function(lineWidth) {
	this.context.lineWidth = this.screenSpace(lineWidth);
}

CanvasRenderer.prototype.save = function() {
	this.context.save();
}

CanvasRenderer.prototype.restore = function() {
	this.context.restore();
}

CanvasRenderer.prototype.resizeCanvas = function(size, isWidth) {
	if (isWidth) {
		this.gameWidth  = size;
		this.gameHeight = this.gameWidth / this.aspectRatio;
	} else {
		this.gameHeight = size;
		this.gameWidth  = this.gameHeight * this.aspectRatio;
	}
	this.unitsPerColumn = this.unitsPerRow / this.gameWidth * this.gameHeight;
	this.pixelsPerUnit  = this.gameWidth / this.unitsPerRow;

	$(this.canvas).parent().css({
		"width": (this.gameWidth + 64) + "px",
		"height": (this.gameHeight + 64) + "px",
		"margin": ((this.gameHeight + 64) / -2) + "px 0px 0px " + ((this.gameWidth + 64) / -2) + "px",
	});
	$(this.canvas)[0].getContext("2d").canvas.width  = this.gameWidth;
	$(this.canvas)[0].getContext("2d").canvas.height = this.gameHeight;
}
