// Import jQuery related stuff
import * as $j from 'jquery';
import 'jquery.transit';
import dataJson from '../assets/units/data.json';
import Game from './game';
import { Fullscreen } from './ui/fullscreen';

import Connect from './multiplayer/connect';
import Authenticate from './multiplayer/authenticate';
import SessionI from './multiplayer/session';

// Load the stylesheet
import './style/main.less';

// Generic object we can decorate with helper methods to simply dev and user experience.
// TODO: Expose this in a less hacky way.
let AB = {};
let session = {};
// Create the game
const G = new Game('0.4');
// Helper properties and methods for retrieving and playing back game logs.
// TODO: Expose these in a less hacky way too.
AB.currentGame = G;
AB.getLog = AB.currentGame.gamelog.get.bind(AB.currentGame.gamelog);
AB.restoreGame = AB.currentGame.gamelog.play.bind(AB.currentGame.gamelog);
window.AB = AB;
const connect = new Connect(G);
G.connect = connect;

// const email = "junior@example.com";
// const password = "8484ndnso";
// const session = Cli.authenticateEmail({ email: email, password: password, create: true, username: "boo" })
// Load the abilities
dataJson.forEach(async (creature) => {
	if (!creature.playable) {
		return;
	}

	import(`./abilities/${creature.name.split(' ').join('-')}`).then((generator) =>
		generator.default(G),
	);
});

$j(() => {
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

	// Binding Hotkeys
	$j(document).on('keydown', (event) => {
		const fullscreenHotkey = 70;
		const pressedKey = event.keyCode || event.which;
		if (event.shiftKey && fullscreenHotkey == pressedKey) {
			fullscreen.toggle();
		}
	});

	$j('#createMatchButton').on('click', () => {
		$j('.match-frame').hide();
		$j('#gameSetup').show();
		$j('#startMatchButton').show();
		$j('#startButton').hide();
	});

	$j('#multiplayer').on('click', async () => {
		$j('.setupFrame,.lobby').hide();
		$j('.loginregFrame').show();
		let sess = new SessionI();
		try {
			await sess.restoreSession();
		} catch (e) {
			console.log('unable to restore session', e);
			return;
		}
	});

	// Focus the form to enable "press enter to start the game" functionality
	$j('#startButton').trigger('focus');

	$j('form#gameSetup').on('submit', (e) => {
		e.preventDefault(); // Prevent submit
		let gameconfig = getGameConfig();
		G.loadGame(gameconfig);

		return false; // Prevent submit
	});
	// Register
	async function register(e) {
		e.preventDefault(); // Prevent submit
		let reg = getReg();
		// Check empty fields
		if (
			$j('#register .error-req').css('display') != 'none' ||
			$j('#register .error-req').css('visibility') != 'hidden'
		) {
			// 'element' is hidden
			$j('#register .error-req').hide();
			$j('#register .error-req-message').hide();
		}
		if (reg.username == '' || reg.email == '' || reg.password == '' || reg.passwordmatch == '') {
			$j('#register .error-req').show();
			$j('#register .error-req-message').show();
			return;
		}
		if (
			$j('.error-pw-length').css('display') != 'none' ||
			$j('.error-pw-length').css('visibility') != 'hidden'
		) {
			// 'element' is hidden
			$j('.error-pw-length').hide();
		}

		// Password length
		if (reg.password.split('').length < 8) {
			$j('.error-pw-length').show();
			return;
		}
		// Password match
		if ($j('.error-pw').css('display') != 'none' || $j('.error-pw').css('visibility') != 'hidden') {
			// 'element' is hidden
			$j('.error-pw').hide();
		}
		if (reg.password != reg.passwordmatch) {
			$j('.error-pw').show();
			return;
		}
		let auth = new Authenticate(reg, connect.client);
		let session = await auth.register();
		let sess = new SessionI(session);
		sess.storeSession();
		G.session = session;
		G.client = connect.client;
		G.multiplayer = true;
		$j('.setupFrame,.welcome').show();
		$j('.match-frame').show();
		$j('.loginregFrame,#gameSetup').hide();
		$j('.user').text(session.username);
		console.log('new user created.' + session);
		return false; // Prevent submit
	}
	$j('form#register').on('submit', register);

	async function login(e) {
		e.preventDefault(); // Prevent submit
		let login = getLogin(),
			auth,
			session;
		$j('#login .login-error-req-message').hide();
		if (login.email == '' || login.password == '') {
			$j('#login .error-req').show();
			$j('#login .error-req-message').show();
			return;
		}
		// Check empty fields
		if (
			$j('#login .error-req').css('display') != 'none' ||
			$j('#login .error-req').css('visibility') != 'hidden'
		) {
			// 'element' is hidden
			$j('#login .error-req').hide();
			$j('#login .error-req-message').hide();
		}
		auth = new Authenticate(login, connect.client);
		try {
			session = await auth.authenticateEmail();
		} catch (error) {
			$j('#login .login-error-req-message').show();
			return;
		}

		let sess = new SessionI(session);
		sess.storeSession();
		G.session = session;
		G.client = connect.client;
		G.multiplayer = true;

		$j('.setupFrame,.welcome').show();
		$j('.match-frame').show();
		$j('.loginregFrame,#gameSetup').hide();
		$j('.user').text(session.username);
		return false; // Prevent submit
	}
	// Login form
	$j('form#login').on('submit', login);
	$j('#startMatchButton').on('click', () => {
		let gameConfig = getGameConfig();
		G.loadGame(gameConfig, true);
		return false;
	});

	$j('#joinMatchButton').on('click', () => {
		//TODO move to match data received
		$j('.lobby').show();
		$j('.setupFrame').hide();
		G.matchJoin();
		return false;
	});
});
$j('.back').on('click', () => {
	$j('.lobby').hide();
	$j('.setupFrame,.welcome').show();
});
/**
 * get Registration.
 * @return {Object} login form.
 */
function getReg() {
	let reg = {
		username: $j('.register input[name="username"]').val(),
		email: $j('.register input[name="email"]').val(),
		password: $j('.register input[name="password"]').val(),
		passwordmatch: $j('.register input[name="passwordmatch"]').val(),
	};

	return reg;
}

/**
 * get Login.
 * @return {Object} login form.
 */
function getLogin() {
	let login = {
		email: $j('.login input[name="email"]').val(),
		password: $j('.login input[name="password"]').val(),
	};
	return login;
}

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
