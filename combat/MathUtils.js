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

function MathUtils() { }

MathUtils.generateTessellatingHexagon = function() {
	var vertexList = new Array(6);
	var angleStep = Math.PI * 2 / 6;
	var quarterCircle = Math.PI * 0.5;
	
	var scaleX = 1 / Math.cos(angleStep - quarterCircle);
	for(var i = 0; i < 6; i++) {
		var x = (Math.cos(i * angleStep - quarterCircle) * scaleX + 1) * 0.5;
		var y = (Math.sin(i * angleStep - quarterCircle) + 1) * 0.5;
		vertexList[i] = new Vector2D(x, y);
	}
	return {
		vertices: vertexList,
		tile: new Vector2D(vertexList[2].x, vertexList[2].y)
	};
}
