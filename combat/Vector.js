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

function Vector2D(x,y) {
	this.x = x || 0;
	this.y = y || 0;
}
Vector2D.prototype = {
	add: function(other) {
		if(other instanceof Vector2D)
			return new Vector2D(this.x + other.x, this.y + other.y);
		if(typeof other == "number")
			return new Vector2D(this.x + other, this.y + other);
		return null;
	},
	substract: function(other) {
		if(other instanceof Vector2D)
			return new Vector2D(this.x - other.x, this.y - other.y);
		if(typeof other == "number")
			return new Vector2D(this.x - other, this.y - other);
		return null;
	},
	multiply: function(other) {
		if(other instanceof Vector2D)
			return new Vector2D(this.x * other.x, this.y * other.y);
		if(typeof other == "number")
			return new Vector2D(this.x * other, this.y * other);
		return null;
	},
	length: function() {
		return Math.sqrt((this.x * this.x) + (this.y * this.y));
	},
	normalize: function() {
		var length = this.length();
		return new Vector2D(this.x / length, this.y / length);
	},
	toScreenSpace: function(renderer) {
		return new Vector2D(renderer.screenSpace(this.x), renderer.screenSpace(this.y));
	},
	toUnitSpace: function(renderer) {
		return new Vector2D(renderer.unitSpace(this.x), renderer.unitSpace(this.y));
	},
}


function Vector3D(x,y,z) {
	this.x = x || 0;
	this.y = y || 0;
	this.z = z || 0;
}
Vector3D.prototype = {
	add: function(other) {
		if(other instanceof Vector3D)
			return new Vector3D(this.x + other.x, this.y + other.y, this.z + other.z);
		if(typeof other == "number")
			return new Vector3D(this.x + other, this.y + other, this.z + other);
		return null;
	},
	substract: function(other) {
		if(other instanceof Vector3D)
			return new Vector3D(this.x - other.x, this.y - other.y, this.z - other.z);
		if(typeof other == "number")
			return new Vector3D(this.x - other, this.y - other, this.z - other);
		return null;
	},
	multiply: function(other) {
		if(other instanceof Vector3D)
			return new Vector3D(this.x * other.x, this.y * other.y, this.z * other.z);
		if(typeof other == "number")
			return new Vector3D(this.x * other, this.y * other, this.z * other);
		return null;
	},
	length: function() {
		return Math.sqrt((this.x * this.x) + (this.y * this.y) + (this.z * this.z));
	},
	normalize: function() {
		var length = this.length();
		return new Vector3D(this.x / length, this.y / length, this.z / length);
	},
	toScreenSpace: function(renderer) {
		return new Vector3D(renderer.screenSpace(this.x), renderer.screenSpace(this.y), renderer.screenSpace(this.z));
	},
	toUnitSpace: function(renderer) {
		return new Vector3D(renderer.unitSpace(this.x), renderer.unitSpace(this.y), renderer.unitSpace(this.z));
	},
}
