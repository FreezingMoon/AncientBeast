import * as arrayUtils from './arrayUtils';
import { Hex } from './hex';
import { HexGrid } from './hexgrid';

/**
 * @param {Hex} start - Starting point of search
 * @param {Hex} end - Ending point of search
 * @param {number} creatureSize - The size of the creature who will walk the searched path
 * @param {number} creatureId - The id of the creature who will walk the searched path
 * @param {HexGrid} grid - The HexGrid instance to search
 * @returns {Hex[]} A path of hexes or an empty array if no path is found
 */
export function search(
	start: Hex,
	end: Hex,
	creatureSize: number,
	creatureId: number,
	grid: HexGrid,
): Hex[] {
	const openList = [];
	const closedList = [];
	openList.push(start);

	if (start == end) {
		return [];
	}

	while (openList.length > 0) {
		// Grab the lowest f(x) to process next
		let lowInd = 0;
		for (let i = 0; i < openList.length; i++) {
			if (openList[i].f < openList[lowInd].f) {
				lowInd = i;
			}
		}
		const currentNode = openList[lowInd];

		// End case -- result has been found, return the traced path
		if (currentNode.pos == end.pos) {
			let curr = currentNode;
			const ret = [];
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
		const neighbors = currentNode.adjacentHex(1);

		for (let i = 0; i < neighbors.length; i++) {
			const neighbor = neighbors[i];

			if (
				arrayUtils.findPos(closedList, neighbor) ||
				!neighbor.isWalkable(creatureSize, creatureId)
			) {
				// Not a valid node to process, skip to next neighbor
				continue;
			}

			// g score is the shortest distance from start to current node, we need to check if
			//	 the path we have arrived at this neighbor is the shortest one we have seen yet
			const gScore = currentNode.g + 1; // 1 is the distance from a node to it's neighbor
			let gScoreIsBest = false;

			if (!arrayUtils.findPos(openList, neighbor)) {
				// This the the first time we have arrived at this node, it must be the best
				// Also, we need to take the h (heuristic) score since we haven't done so yet

				gScoreIsBest = true;
				neighbor.h = 0;
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
			}
		}
	}
	grid.cleanPathAttr(false);
	// No result was found -- empty array signifies failure to find path
	return [];
}
