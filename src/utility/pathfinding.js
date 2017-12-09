import * as arrayUtils from "./arrayUtils";

// Start and end must be Hex type
export function search(start, end, creatureSize, creatureId, grid) {
	var openList = [];
	var closedList = [];
	openList.push(start);

	if (start == end) {
		//console.log("Same coordinates");
		return [];
	}

	while (openList.length > 0) {

		// Grab the lowest f(x) to process next
		var lowInd = 0;
		for (var i = 0; i < openList.length; i++) {
			if (openList[i].f < openList[lowInd].f) {
				lowInd = i;
			}
		}
		var currentNode = openList[lowInd];

		// End case -- result has been found, return the traced path
		if (currentNode.pos == end.pos) {
			var curr = currentNode;
			var ret = [];
			while (curr.pathparent) {
				ret.push(curr);
				curr = curr.pathparent;
			}
			grid.cleanPathAttr(false);
			return ret.reverse();
		}
		// Normal case -- move currentNode from open to closed, process each of its neighbors
		arrayUtils.removePos(openList, currentNode);
		closedList.push(currentNode);
		var neighbors = currentNode.adjacentHex(1);

		for (var i = 0; i < neighbors.length; i++) {
			var neighbor = neighbors[i];

			if (arrayUtils.findPos(closedList, neighbor) || !neighbor.isWalkable(creatureSize, creatureId)) {
				// Not a valid node to process, skip to next neighbor
				continue;
			}

			// g score is the shortest distance from start to current node, we need to check if
			//	 the path we have arrived at this neighbor is the shortest one we have seen yet
			var gScore = currentNode.g + 1; // 1 is the distance from a node to it's neighbor
			var gScoreIsBest = false;


			if (!arrayUtils.findPos(openList, neighbor)) {
				// This the the first time we have arrived at this node, it must be the best
				// Also, we need to take the h (heuristic) score since we haven't done so yet

				gScoreIsBest = true;
				neighbor.h = heuristic(neighbor.pos, end.pos);
				openList.push(neighbor);
			} else if (gScore < neighbor.g) {
				// We have already seen the node, but last time it had a worse g (distance from start)
				gScoreIsBest = true;
			}

			if (gScoreIsBest) {
				// Found an optimal (so far) path to this node.	 Store info on how we got here and
				//	just how good it really is...
				neighbor.pathparent = currentNode;
				neighbor.g = gScore;
				neighbor.f = neighbor.g + neighbor.h;
				//neighbor.$display.children(".physical").text(neighbor.g); // Debug
			}
		}
	}
	grid.cleanPathAttr(false);
	// No result was found -- empty array signifies failure to find path
	return [];
}

export function heuristic(pos0, pos1) {
	// This is the Manhattan distance
	var d1 = Math.abs(pos1.x - pos0.x);
	var d2 = Math.abs(pos1.y - pos0.y);
	return 0; // Dijkstra algo "better" but slower
	//return d1 + d2; // Not good for range prediction
}
