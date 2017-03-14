var queue = [];

exports.addToQueue = function(player) {
	queue.push(player);
	console.log("ADDED PLAYER: " + player.username + " TO QUEUE, Size:" + queue.length);
}

exports.removeFromQueue = function(player) {
	removePlayerFromQueue(player.username);
	console.log("Remove Player Queue Size: " + queue.length);
}

// We will call this periodically to check if there are enough players
// If we have enough players it will return 2 of the player sessions for a game
exports.checkQueueForGame = function() {
	var queueCount = 0;
	for (var i in queue) {
		if(queueCount == 0) {
		var player1 = i;
		}
		queueCount++;
		if (queueCount == 1) {
			startGame(player1, i);
			queueCount = 0;
		}
	}
}

function removePlayerFromQueue(username) {
	for (var i =0; i < queue.length; i++)
		if (queue[i].username === username) {
			queue.splice(i,1);
			break;
		}
}
