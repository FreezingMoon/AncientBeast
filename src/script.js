// Import jquery related stuff
import * as jquery from 'jquery';
import 'jquery-ui';

// Load phaser (https://github.com/photonstorm/phaser/issues/1974)
import PIXI from 'expose-loader?PIXI!phaser-ce/build/custom/pixi.js';
import p2 from 'expose-loader?p2!phaser-ce/build/custom/p2.js';
import Phaser from 'expose-loader?Phaser!phaser-ce/build/custom/phaser-split.js';

import { Game } from './game';
import { musicPlayer } from './sound/music';


// Load the stylesheet
import './style/main.less';

// Export stuff that needs to be on the window object (Hack)
window.$j = jquery;
window.Phaser = Phaser;

/** Initialize the game global variable */
var G = new Game("0.3");
/*****************************************/

$j(document).ready(() => {
	$j(".typeRadio").buttonset();
	$j("#startButton").button();

	// Start the musicplayer
	musicPlayer.init();

	// Disable initial game setup until browser tab has focus
	window.addEventListener("blur", G.onBlur.bind(G), false);
	window.addEventListener("focus", G.onFocus.bind(G), false);
	$j("form#gameSetup").submit((e) => {
		e.preventDefault(); // Prevent submit
		var gameconfig = getGameConfig();


		if (gameconfig.background_image == "random") {
			// nth-child indices start at 1
			var index = Math.floor(Math.random() * ($j('input[name="combatLocation"]').length - 1)) + 1;
			gameconfig.background_image = $j('input[name="combatLocation"]').slice(index, index + 1).attr("value");
		}

		G.loadGame(gameconfig);
		return false; // Prevent submit
	});
});

function getGameConfig() {
	let defaultConfig = {
		playerMode: $j('input[name="playerMode"]:checked').val() - 0,
		creaLimitNbr: $j('input[name="activeUnits"]:checked').val() - 0, // DP counts as One
		unitDrops: $j('input[name="unitDrops"]:checked').val() - 0,
		abilityUpgrades: $j('input[name="abilityUpgrades"]:checked').val() - 0,
		plasma_amount: $j('input[name="plasmaPoints"]:checked').val() - 0,
		turnTimePool: $j('input[name="turnTime"]:checked').val() - 0,
		timePool: $j('input[name="timePool"]:checked').val() * 60,
		background_image: $j('input[name="combatLocation"]:checked').val(),
	},
		config = G.gamelog.gameConfig || defaultConfig;

	return config;
}

function isEmpty(obj) {
	for (var key in obj) {
		if (obj.hasOwnProperty(key))
			return false;
	}
	return true;
}
