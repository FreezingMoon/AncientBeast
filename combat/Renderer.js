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

function Renderer(unitsPerRow) {
	this.aspectRatio = 16 / 9;
	this.textures = new Array();
	this.boundTexture = null;
	this.boundTextureName = "";
	this.gameWidth = 16;
	this.gameHeight = 9;
	this.unitsPerRow = unitsPerRow || 20;
	this.unitsPerColumn = this.unitsPerRow / this.aspectRatio;
	this.pixelsPerUnit  = this.gameWidth / this.unitsPerRow;
}

//TODO move texture loading stuff into TextureCache.js
// callback(error:bool, image:Image)
Renderer.prototype.fetchTexture = function(url, callback) {
	var _this = this;
	var image = new Image();
	image.onerror = function() {
		console.log("error: failed to load image from: "+ url);
		if (callback) {
			callback(true, image);
		}
		image.onload = null;
	}
	image.onload = function() {
		_this.textures[url] = image;
		if (callback) {
			callback(false, image);
		}
		image.onerror = null;
	}
	image.src = url;
}

Renderer.prototype.screenSpace = function(unitInput) {
	return unitInput * this.pixelsPerUnit;
}
Renderer.prototype.unitSpace = function(pixelInput) {
	return pixelInput / this.pixelsPerUnit;
}

Renderer.prototype.bindTexture = function(url) {
	if (this.boundTextureName == url) {
		return;
	}
	
	var texture = this.textures[url];
	if (texture) {
		this.boundTexture = texture;
		this.boundTextureName = url;
	} else {
		this.fetchTexture(url);
		console.log("warning: image("+url+") was not loaded, yet. Please load it before you use it")
	}
}

Renderer.prototype.drawLine = function(vertices) {
	
}

Renderer.prototype.setColor = function(color) {
	
}

Renderer.prototype.setLineWidth = function(lineWidth) {

}

Renderer.prototype.resizeCanvas = function(size, isWidth) {

}

Renderer.prototype.resizeToWindow = function() {
	var isWidth = ($(window).width() / $(window).height()) < this.aspectRatio;
	this.resizeCanvas(isWidth ? $(window).width() : $(window).height(), isWidth);
}
