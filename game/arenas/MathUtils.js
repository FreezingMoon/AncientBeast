function MathUtils() { }

MathUtils.generateShape = function(segments) {
	var step = Math.PI * 2 / segments;
	var rad90 = Math.PI / 2;
	var scaleX = 2 - (Math.cos(Math.round(segments * 0.25) * step - rad90) - Math.cos(Math.round(segments * 0.75) * step - rad90)) / 2;
	var scaleY = 2 - (Math.sin(Math.round(segments * 0.50) * step - rad90) - Math.sin(-rad90)) / 2;
	var out = new Array(segments);
	for (var i = 0; i < segments; i++) {
		out[i] = new Vertex();
		out[i].x = Math.cos(i * step - rad90) / 2 * scaleX + 0.5;
		out[i].y = Math.sin(i * step - rad90) / 2 * scaleY + 0.5;
	}
	return out;
}