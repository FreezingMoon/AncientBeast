/** Initialize the game global variable */
var G = new Game();
/*****************************************/

$j(document).ready(function() {
	$j(".typeRadio").buttonset();
	$j("#startButton").button();

	$j("form#gameSetup").submit(function(e) {
		e.preventDefault(); // Prevent submit
		var gameconfig = {
			playerMode : $j('input[name="playerMode"]:checked').val()-0,
			creaLimitNbr : $j('input[name="activeUnits"]:checked').val()-0, // DP counts as One
			unitDrops : $j('input[name="unitDrops"]:checked').val()-0,
			abilityUpgrades : $j('input[name="abilityUpgrades"]:checked').val()-0,
			plasma_amount : $j('input[name="plasmaPoints"]:checked').val()-0,
			turnTimePool : $j('input[name="turnTime"]:checked').val()-0,
			timePool : $j('input[name="timePool"]:checked').val()*60,
			background_image : $j('input[name="combatLocation"]:checked').val(),

		};

		if( gameconfig.background_image == "random" ) {
			var index = Math.floor(Math.random() * ($j('input[name="combatLocation"]').length - 1) ) + 1;  // nth-child indices start at 1
			gameconfig.background_image = $j('input[name="combatLocation"]').slice(index, index+1).attr("value");
		}
		G.loadGame(gameconfig);
		return false; // Prevent submit
	});
});
