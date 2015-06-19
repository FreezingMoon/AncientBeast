//game manager module
var games = [];

function Game(playerA, playerB){
  this.playerA = playerA;
  this.playerB = playerB;
};

exports.startGame = function(playerA, playerB)
{
  var newGame = new Game(playerA,playerB);
  games.push(newGame);
  console.log("Starting game with 2 players");
}
