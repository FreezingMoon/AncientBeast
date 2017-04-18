/** Initialize the game global variable */
var G = new Game();
/*****************************************/
document.addEventListener('ab-start', function(event) {
	G.loadGame(event.detail);
});
