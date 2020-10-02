// Import jQuery related stuff
import * as $j from 'jquery';
import 'jquery.transit';
import dataJson from '../assets/units/data.json';
import Game from './game';
import { Fullscreen } from './ui/fullscreen';

// Load the stylesheet
import './style/main.less';

// Generic object we can decorate with helper methods to simply dev and user experience.
// TODO: Expose this in a less hacky way.
let AB = {};
// Create the game
const G = new Game('0.4');
// Helper properties and methods for retrieving and playing back game logs.
// TODO: Expose these in a less hacky way too.
AB.currentGame = G;
AB.getLog = AB.currentGame.gamelog.get.bind(AB.currentGame.gamelog);
AB.restoreGame = AB.currentGame.gamelog.play.bind(AB.currentGame.gamelog);
window.AB = AB;

// Load the abilities
dataJson.forEach(async (creature) => {
	if (!creature.playable) {
		return;
	}

	import(`./abilities/${creature.name.split(' ').join('-')}`).then((generator) =>
		generator.default(G),
	);
});

$j(document).ready(() => {
	let scrim = $j('.scrim');
	scrim.on('transitionend', function () {
		scrim.remove();
	});
	scrim.removeClass('loading');

	// Select a random combat location
	const locationSelector = $j("input[name='combatLocation']");
	const randomLocationIndex = Math.floor(Math.random() * locationSelector.length);
	locationSelector.eq(randomLocationIndex).prop('checked', true).trigger('click');

	// Disable initial game setup until browser tab has focus
	window.addEventListener('blur', G.onBlur.bind(G), false);
	window.addEventListener('focus', G.onFocus.bind(G), false);

	// Add listener for Fullscreen API
	let fullscreen = new Fullscreen($j('#fullscreen'));
	$j('#fullscreen').on('click', () => fullscreen.toggle());

	// Focus the form to enable "press enter to start the game" functionality
	$j('#startButton').focus();

	$j('form#gameSetup').submit((e) => {
		e.preventDefault(); // Prevent submit

		let gameconfig = getGameConfig();

		G.loadGame(gameconfig);

		return false; // Prevent submit
	});

	// Binding Hotkeys
	$j(document).keydown((event) => {
		const fullscreenHotkey = 70;
		const pressedKey = event.keyCode || event.which;
		if (event.shiftKey && fullscreenHotkey == pressedKey) {
			fullscreen.toggle();
		}
	});
});

/**
 * Generate game config from form and return it.
 * @return {Object} The game config.
 */
export function getGameConfig() {
	let defaultConfig = {
			playerMode: $j('input[name="playerMode"]:checked').val() - 0,
			creaLimitNbr: $j('input[name="activeUnits"]:checked').val() - 0, // DP counts as One
			unitDrops: $j('input[name="unitDrops"]:checked').val() - 0,
			abilityUpgrades: $j('input[name="abilityUpgrades"]:checked').val() - 0,
			plasma_amount: $j('input[name="plasmaPoints"]:checked').val() - 0,
			turnTimePool: $j('input[name="turnTime"]:checked').val() - 0,
			timePool: $j('input[name="timePool"]:checked').val() * 60,
			background_image: $j('input[name="combatLocation"]:checked').val(),
			fullscreenMode: $j('#fullscreen').hasClass('fullscreenMode'),
		},
		config = G.gamelog.gameConfig || defaultConfig;

	return config;
}

/**
 * Return true if an object has no keys.
 * @param {Object} obj The object to test.
 * @return {boolean} Empty or not.
 */
export function isEmpty(obj) {
	for (let key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			return false;
		}
	}

	return true;
}
