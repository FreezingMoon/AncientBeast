// Import jQuery related stuff
import * as $j from 'jquery';
import 'jquery.transit';
import dataJson from './data/units.json';
import Game from './game';
import { Fullscreen } from './ui/fullscreen';

import Connect from './multiplayer/connect';
import Authenticate from './multiplayer/authenticate';
import SessionI from './multiplayer/session';

// Load the stylesheet
import './style/main.less';

// Generic object we can decorate with helper methods to simply dev and user experience.
// TODO: Expose this in a less hacky way.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Too many unknown types.
const AB = {} as any;
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
	renderPlayerModeType(G.multiplayer);

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

	let startScreenHotkeys = {
		KeyF: {
			keyDownTest(event) {
				return event.shiftKey;
			},
			keyDownAction() {
				fullscreen.toggle();
			},
		},
		KeyL: {
			keyDownTest(event) {
				return event.metaKey && event.ctrlKey;
			},
			keyDownAction(event) {
				readLogFromFile()
					.then((logstr) => JSON.parse(logstr as string))
					.then((log) => G.gamelog.play(log))
					.catch((err) => {
						alert('An error occurred while loading the log file');
						console.log(err);
					});
			},
		},
	};

	// Binding Hotkeys
	$j(document).on('keydown', (event) => {
		const hotkey = startScreenHotkeys[event.code];

		if (hotkey === undefined) {
			return;
		}

		const { keyDownTest, keyDownAction } = hotkey;

		if (keyDownTest.call(this, event)) {
			event.preventDefault();
			keyDownAction.call(this, event);
		}
	});

	if (G.multiplayer) {
		// TODO Remove after implementaion 2 vs 2 in multiplayer mode
		forceTwoPlayerMode();
	}

	$j('#createMatchButton').on('click', () => {
		$j('.match-frame').hide();
		$j('#gameSetup').show();
		renderPlayerModeType(G.multiplayer);
		$j('#startMatchButton').show();
		$j('#startButton').hide();

		// TODO Remove after implementaion 2 vs 2 in multiplayer mode
		forceTwoPlayerMode();
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

	$j('#backFromMatchButton').on('click', () => {
		$j('.lobby').hide();
		$j('.setupFrame,.welcome').show();
	});

	$j('#refreshMatchButton').on('click', () => {
		G.updateLobby();
	});
});

/**
 * force 1 vs 1 game mode
 * should be removed after implementaion 2 vs 2 in multiplayer mode
 */
function forceTwoPlayerMode() {
	$j('#p2').trigger('click');
	$j('#p4').prop('disabled', true);
}

/**
 * get Registration.
 * @return {Object} login form.
 */
function getReg() {
	const reg = {
		username: $j('.register input[name="username"]').val() as string,
		email: $j('.register input[name="email"]').val() as string,
		password: $j('.register input[name="password"]').val() as string,
		passwordmatch: $j('.register input[name="passwordmatch"]').val() as string,
	};

	return reg;
}

/**
 * read log from file
 * @returns {Promise<string>}
 */
function readLogFromFile() {
	return new Promise((resolve, reject) => {
		const fileInput = document.createElement('input') as HTMLInputElement;
		fileInput.accept = '.ab';
		fileInput.type = 'file';

		fileInput.onchange = (event) => {
			const file = (event.target as HTMLInputElement).files[0];
			const reader = new FileReader();

			reader.readAsText(file);

			reader.onload = () => {
				resolve(reader.result);
			};

			reader.onerror = () => {
				reject(reader.error);
			};
		};

		fileInput.click();
	});
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
 * Render the player mode text inside game form
 * @param {Boolean} isMultiPlayer Is playing in online multiplayer mode or hotSeat mode
 * @returns {Object} JQuery<HTMLElement>
 */
function renderPlayerModeType(isMultiPlayer) {
	const playerModeType = $j('#playerModeType');
	return isMultiPlayer ? playerModeType.text('[ Online ]') : playerModeType.text('[ Hotseat ]');
}

/**
 * Generate game config from form and return it.
 * @return {Object} The game config.
 */
export function getGameConfig() {
	const defaultConfig = {
		playerMode: parseInt($j('input[name="playerMode"]:checked').val() as string, 10),
		creaLimitNbr: parseInt($j('input[name="activeUnits"]:checked').val() as string, 10), // DP counts as One
		unitDrops: parseInt($j('input[name="unitDrops"]:checked').val() as string, 10),
		abilityUpgrades: parseInt($j('input[name="abilityUpgrades"]:checked').val() as string, 10),
		plasma_amount: parseInt($j('input[name="plasmaPoints"]:checked').val() as string, 10),
		turnTimePool: parseInt($j('input[name="turnTime"]:checked').val() as string, 10),
		timePool: parseInt($j('input[name="timePool"]:checked').val() as string, 10) * 60,
		background_image: $j('input[name="combatLocation"]:checked').val(),
		fullscreenMode: $j('#fullscreen').hasClass('fullscreenMode'),
	};
	const config = G.gamelog.gameConfig || defaultConfig;

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
