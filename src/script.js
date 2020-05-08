// Import jQuery related stuff
import * as $j from 'jquery';
import 'jquery.transit';
import Game from './game';
import Config from './server/sconfigvars';
import ClientI from './server/client';
import Authenticate from './server/authenticate';
import SessionI from './server/session';

// Load the stylesheet
import './style/main.less';

// Abilities
import abolishedAbilitiesGenerator from './abilities/Abolished';
import chimeraAbilitiesGenerator from './abilities/Chimera';
import cyberWolfAbilitiesGenerator from './abilities/Cyber-Wolf';
import darkPriestAbilitiesGenerator from './abilities/Dark-Priest';
import goldenWyrmAbilitiesGenerator from './abilities/Golden-Wyrm';
import gumbleAbilitiesGenerator from './abilities/Gumble';
import vehemothAbilitiesGenerator from './abilities/Vehemoth';
import impalerAbilitiesGenerator from './abilities/Impaler';
import asherAbilitiesGenerator from './abilities/Asher';
import magmaSpawnAbilitiesGenerator from './abilities/Magma-Spawn';
import nightmareAbilitiesGenerator from './abilities/Nightmare';
import nutcaseAbilitiesGenerator from './abilities/Nutcase';
import scavengerAbilitiesGenerator from './abilities/Scavenger';
import snowBunnyAbilitiesGenerator from './abilities/Snow-Bunny';
import swineThugAbilitiesGenerator from './abilities/Swine-Thug';
import uncleFungusAbilitiesGenerator from './abilities/Uncle-Fungus';
import headlessAbilitiesGenerator from './abilities/Headless';
import stomperAbilitiesGenerator from './abilities/Stomper';


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

//server client
const serverConfig =Config;
const SC=new ClientI(serverConfig);
const Cli=SC.client;
console.log(Cli);
// const email = "junior@example.com";
// const password = "8484ndnso";
// const session = Cli.authenticateEmail({ email: email, password: password, create: true, username: "boo" })
// Load the abilities
const abilitiesGenerators = [
	abolishedAbilitiesGenerator,
	chimeraAbilitiesGenerator,
	cyberWolfAbilitiesGenerator,
	darkPriestAbilitiesGenerator,
	goldenWyrmAbilitiesGenerator,
	gumbleAbilitiesGenerator,
	vehemothAbilitiesGenerator,
	impalerAbilitiesGenerator,
	asherAbilitiesGenerator,
	magmaSpawnAbilitiesGenerator,
	nightmareAbilitiesGenerator,
	nutcaseAbilitiesGenerator,
	scavengerAbilitiesGenerator,
	snowBunnyAbilitiesGenerator,
	swineThugAbilitiesGenerator,
	uncleFungusAbilitiesGenerator,
	headlessAbilitiesGenerator,
	stomperAbilitiesGenerator,
];
abilitiesGenerators.forEach((generator) => generator(G));

export const isNativeFullscreenAPIUse = () =>
	document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;

export const disableFullscreenLayout = () => {
	$j('#fullScreen').removeClass('fullscreenMode');
	$j('.fullscreen__title').text('Fullscreen');
};

export const enableFullscreenLayout = () => {
	$j('#fullScreen').addClass('fullscreenMode');
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
	$j('#fullScreen').on('click', () => {
		if (isNativeFullscreenAPIUse()) {
			disableFullscreenLayout();
			document.exitFullscreen();
		} else if (!isNativeFullscreenAPIUse() && window.innerHeight === screen.height) {
			alert('Use f11 to exit full screen');
		} else {
			enableFullscreenLayout();
			$j('#AncientBeast')[0].requestFullscreen();
		}
	});

	$j('#multiplayer').on('click', () => {
    // sign up and register
    //TODO move to another file
		$j('.setupFrame').hide();
    $j('.loginregFrame').show();
    let sess = new SessionI(); 
    sess.restoreSession().then((session)=>{
     console.log(session);

    })

	});

	window.addEventListener('resize', () => {
		if (window.innerHeight === screen.height && !$j('#fullScreen').hasClass('fullscreenMode')) {
			enableFullscreenLayout();
		} else if ($j('#fullScreen').hasClass('fullscreenMode') && !isNativeFullscreenAPIUse()) {
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

  $j('form#register').submit((e) => {
    e.preventDefault(); // Prevent submit
    let reg=getReg();
    //check empty fields
    if ( $j('#register .error-req').css('display') != 'none' || $j('#register .error-req').css("visibility") != "hidden"){
      // 'element' is hidden
      $j('#register .error-req').hide();
      $j('#register .error-req-message').hide();
    }
    if(reg.username =='' || reg.email ==''||reg.password ==''|| reg.passwordmatch =='' ){
      $j('#register .error-req').show();
      $j('#register .error-req-message').show();
      return;
    }
    if ( $j('.error-pw-length').css('display') != 'none' || $j('.error-pw-length').css("visibility") != "hidden"){
      // 'element' is hidden
      $j('.error-pw-length').hide();
    }
  
    //password length
    if(reg.password.split('').length < 8){
      $j('.error-pw-length').show();
      return;
    }
    //password match
    if ( $j('.error-pw').css('display') != 'none' || $j('.error-pw').css("visibility") != "hidden"){
      // 'element' is hidden
      $j('.error-pw').hide();
    }
    if(reg.password!=reg.passwordmatch){
      $j('.error-pw').show();
      return;
    }
    let auth = new Authenticate(reg,Cli);
    auth.register().then((session)=>{
      console.log('new user created.'+session)

    })

		return false; // Prevent submit
  });


  $j('form#login').submit((e) => {
    e.preventDefault(); // Prevent submit
    let login=getLogin();
    if(login.email ==''||login.password ==''){
      $j('#login .error-req').show();
      $j('#login .error-req-message').show();
      return;
    }
      //check empty fields
    if ( $j('#login .error-req').css('display') != 'none' || $j('#login .error-req').css("visibility") != "hidden"){
      // 'element' is hidden
      $j('#login .error-req').hide();
      $j('#login .error-req-message').hide();
    }

 
    let auth = new Authenticate(login,Cli);
    auth.authenticateEmail().then((session)=>{
      let sess = new SessionI(session);  
      sess.storeSession();
    })

    return false; // Prevent submit
  });
  
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
      passwordmatch: $j('.register input[name="passwordmatch"]').val()					
		}

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
		}
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
