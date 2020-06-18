// Import jQuery related stuff
import * as $j from 'jquery';
import 'jquery.transit';
import Game from './game';

// Load the stylesheet
import './style/main.less';

// Abilities
import abolishedAbilitiesGenerator from './abilities/Abolished';
import asherAbilitiesGenerator from './abilities/Asher';
import chimeraAbilitiesGenerator from './abilities/Chimera';
import cyberWolfAbilitiesGenerator from './abilities/Cyber-Wolf';
import darkPriestAbilitiesGenerator from './abilities/Dark-Priest';
import goldenWyrmAbilitiesGenerator from './abilities/Golden-Wyrm';
import gumbleAbilitiesGenerator from './abilities/Gumble';
import headlessAbilitiesGenerator from './abilities/Headless';
import impalerAbilitiesGenerator from './abilities/Impaler';
import infernalAbilitiesGenerator from './abilities/Infernal';
import nightmareAbilitiesGenerator from './abilities/Nightmare';
import nutcaseAbilitiesGenerator from './abilities/Nutcase';
import scavengerAbilitiesGenerator from './abilities/Scavenger';
import snowBunnyAbilitiesGenerator from './abilities/Snow-Bunny';
import stomperAbilitiesGenerator from './abilities/Stomper';
import swineThugAbilitiesGenerator from './abilities/Swine-Thug';
import uncleFungusAbilitiesGenerator from './abilities/Uncle-Fungus';
import vehemothAbilitiesGenerator from './abilities/Vehemoth';

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
const abilitiesGenerators = [
	abolishedAbilitiesGenerator,
	asherAbilitiesGenerator,
	chimeraAbilitiesGenerator,
	cyberWolfAbilitiesGenerator,
	darkPriestAbilitiesGenerator,
	goldenWyrmAbilitiesGenerator,
	gumbleAbilitiesGenerator,
	headlessAbilitiesGenerator,
	impalerAbilitiesGenerator,
	infernalAbilitiesGenerator,
	nightmareAbilitiesGenerator,
	nutcaseAbilitiesGenerator,
	scavengerAbilitiesGenerator,
	snowBunnyAbilitiesGenerator,
	stomperAbilitiesGenerator,
	swineThugAbilitiesGenerator,
	uncleFungusAbilitiesGenerator,
	vehemothAbilitiesGenerator,
];
abilitiesGenerators.forEach((generator) => generator(G));

export const isNativeFullscreenAPIUse = () =>
	document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;

export const disableFullscreenLayout = () => {
	$j('#fullscreen').removeClass('fullscreenMode');
	$j('.fullscreen__title').text('Fullscreen');
};

export const enableFullscreenLayout = () => {
	$j('#fullscreen').addClass('fullscreenMode');
	$j('.fullscreen__title').text('Contract');
};

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
	$j('#fullscreen').on('click', () => {
		if (isNativeFullscreenAPIUse()) {
			disableFullscreenLayout();
			document.exitFullscreen();
		} else if (!isNativeFullscreenAPIUse() && window.innerHeight === screen.height) {
			alert('Use F11 to exit fullscreen');
		} else {
			enableFullscreenLayout();
			$j('#AncientBeast')[0].requestFullscreen();
		}
	});

	window.addEventListener('resize', () => {
		if (window.innerHeight === screen.height && !$j('#fullscreen').hasClass('fullscreenMode')) {
			enableFullscreenLayout();
		} else if ($j('#fullscreen').hasClass('fullscreenMode') && !isNativeFullscreenAPIUse()) {
			disableFullscreenLayout();
		}
	});

	// Focus the form to enable "press enter to start the game" functionality
	$j('#startButton').focus();

	$j('form#gameSetup').submit((e) => {
		e.preventDefault(); // Prevent submit

		let gameconfig = getGameConfig();

		G.loadGame(gameconfig);

		return false; // Prevent submit
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
