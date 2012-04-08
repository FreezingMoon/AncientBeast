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