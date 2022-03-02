import { Animations } from './frontend/animations';
import { CreatureQueue } from './creature_queue';
import { GameLog } from './utility/gamelog';
import { SoundSys } from './sound/soundsys';
import { MusicPlayer } from './sound/musicplayer';
import { HexGrid } from './frontend/hexgrid';
import { Player } from './player';
import { UI } from './ui/interface';
import { Creature } from './frontend/creature';
import MatchI from './multiplayer/match';
import Gameplay from './multiplayer/gameplay';
import { Ability } from './frontend/ability';
import { Effect } from './effect';
import SessionI from './multiplayer/session';
import { Client } from '@heroiclabs/nakama-js';
import { Hex } from './frontend/hex';

/**
 * Game Class
 *
 * Game contains all Game elements and functions.
 * It's the root element and defined only one time through the G variable.
 *
 * NOTE: Constructor does nothing because the G object must be defined
 * before creating other class instances. The game setup is triggered
 * to really start the game.
 */
export abstract class Game {
	version: string;
	abilities: Ability[];
	players: Player[];
	creatures: Creature[];
	effects: Effect[];
	activeCreature: Creature;
	matchid: any; // what type is this?
	playersReady: boolean;
	preventSetup: boolean;
	animations: Animations;
	queue: CreatureQueue;
	creatureIdCounter: number;
	creatureData: any[];
	gameState: string;
	pause: boolean;
	pauseTime: number;
	pauseStartTime: Date;
	minimumTurnBeforeFleeing: number;
	availableCreatures: string[];
	animationQueue: number[];
	checkTimeFrequency: number;
	gamelog: GameLog;
	configData: {};
	match: MatchI;
	gameplay: Gameplay;
	session: SessionI;
	client: Client;
	connect: any;
	debugMode: string;
	multiplayer: boolean;
	matchInitialized: boolean;
	realms: string[];
	availableMusic: any[];
	soundEffects: string[];
	inputMethod: string;
	firstKill: boolean;
	freezedInput: boolean;
	turnThrottle: boolean;
	turn: number;
	msg: any;
	triggers: any;
	signals: any;
	musicPlayer: MusicPlayer;
	soundLoaded: any;
	soundsys: SoundSys;
	background_image: string;
	UI: UI;
	trapId: number;
	dropId: number;
	grid: HexGrid;
	startMatchTime: Date;
	$combatFrame: JQuery<HTMLElement>;
	timeInterval: NodeJS.Timeout;
	windowResizeTimeout: NodeJS.Timeout;
	playerMode: number;
	timePool: number;
	turnTimePool: number;
	endGameSound: any;

	/**
	 * Attributes
	 *
	 * NOTE : attributes and variables starting with $ are jQuery elements
	 * and jQuery functions can be called directly from them.
	 *
	 * // jQuery attributes
	 * $combatFrame :	Combat element containing all graphics except the UI
	 *
	 * // Game elements
	 * players :			Array :	Contains Player objects ordered by player ID (0 to 3)
	 * creatures :			Array :	Contains Creature objects (creatures[creature.id]) start at index 1
	 *
	 * grid :				Grid :	Grid object
	 * UI :				UI :	UI object
	 *
	 * queue :				CreatureQueue :	queue of creatures to manage phase order
	 *
	 * turn :				Integer :	Current's turn number
	 *
	 * // Normal attributes
	 * playerMode :		Integer :	Number of players in the game
	 * activeCreature :	Creature :	Current active creature object reference
	 * creatureIdCounter :		Integer :	Creature ID counter used for creature creation
	 * creatureData :		Array :		Array containing all data for the creatures
	 *
	 */
	constructor(version?: string) {}

	abstract dataLoaded(data: any): void;

	/**
	 * loadGame(setupOpt) preload
	 *
	 * setupOpt :	Object :	Setup options from matchmaking menu
	 *
	 * Load all required game files
	 */

	abstract loadGame(setupOpt: any, matchInitialized?: boolean, matchid?: any);

	abstract startLoading(): void;

	abstract loadFinish(): void;

	/**
	 * Catch the browser being made inactive to prevent initial rendering bugs.
	 */
	abstract onBlur(): void;

	/**
	 * Catch the browser coming back into focus so we can render the game board.
	 */
	abstract onFocus(): void;

	/**
	 * If no red flags, remove the loading bar and begin rendering the game.
	 */
	abstract maybeSetup(): void;

	/**
	 * Setup(playerMode)
	 *
	 * playerMode :		Integer :	Ideally 2 or 4, number of players to configure
	 *
	 * Launch the game with the given number of player.
	 *
	 */
	abstract setup(playerMode: number): void;

	abstract matchInit(): Promise<void>;

	abstract matchJoin(): Promise<void>;

	abstract updateLobby(): Promise<void>;

	/**
	 * resizeCombatFrame()
	 *
	 * Resize the combat frame
	 */
	abstract resizeCombatFrame(): void;

	/**
	 * nextRound()
	 *
	 * Replace the current queue with the next queue
	 */
	abstract nextRound(): void;

	/**
	 * nextCreature()
	 *
	 * Activate the next creature in queue
	 */
	abstract nextCreature(): void;

	abstract updateQueueDisplay(excludeActiveCreature?: boolean): void;

	/**
	 * log(obj)
	 *
	 * obj :	Any :	Any variable to display in console and game log
	 *
	 * Display obj in the console log and in the game log
	 */
	abstract log(obj: any, htmlclass?: string, ifNoTimestamp?: boolean): void;

	abstract togglePause(): void;

	/**
	 * skipTurn()
	 *
	 * End turn for the current unit
	 */
	abstract skipTurn(o?: any): void;

	/**
	 * delayCreature()
	 *
	 * Delay the action turn of the current creature
	 */
	abstract delayCreature(o?: any): void;

	abstract startTimer(): void;

	abstract stopTimer(): void;

	/**
	 * checkTime()
	 */
	abstract checkTime(): void;

	/**
	 * retrieveCreatureStats(type)
	 *
	 * type :	String :	Creature's type (ex: "0" for Dark Priest and "L2" for Magma Spawn)
	 *
	 * Query the database for creature stats
	 */
	abstract retrieveCreatureStats(type: string): any;

	abstract triggerAbility(trigger: string, arg: any, retValue?: any);

	abstract triggerEffect(trigger: string, arg: any, retValue?: any): boolean;

	abstract triggerTrap(trigger: string, arg: any): void;

	abstract triggerDeleteEffect(trigger: string, creature: any): void;

	abstract onStepIn(creature: Creature, hex: Hex, opts: any): void;

	/**
	 * Be careful when using this trigger to apply damage as it can kill a creature
	 * before it has completed its movement, resulting in incorrect Drop placement
	 * and other bugs. Refer to Impaler Poisonous Vine ability for an example on how
	 * to delay damage until the end of movement.
	 *
	 * Removed individual args from definition because we are using the arguments variable.
	 */
	abstract onStepOut(creature: Creature, hex: Hex, callback?: Function): void;

	abstract onReset(creature: Creature): void;

	// Removed individual args from definition because we are using the arguments variable.
	abstract onStartPhase(creature: Creature, callback?: Function): void;

	// Removed individual args from definition because we are using the arguments variable.
	abstract onEndPhase(creature: Creature, callback?: Function): void;

	// Removed individual args from definition because we are using the arguments variable.
	abstract onStartOfRound(creature?: Creature, callback?: Function): void;

	// Removed individual args from definition because we are using the arguments variable.
	abstract onCreatureMove(creature: Creature, hex: Hex, callback?: Function): void;

	// Removed individual args from definition because we are using the arguments variable.
	abstract onCreatureDeath(creature: Creature, callback?: Function): void;

	abstract onCreatureSummon(creature: Creature, callback?: Function): void;

	// Removed individual args from definition because we are using the arguments variable.
	abstract onEffectAttach(creature: Creature, effect: Effect, callback?: Function): void;

	abstract onUnderAttack(creature: Creature, damage: any): any;

	// Removed individual args from definition because we are using the arguments variable.
	abstract onDamage(creature: Creature, damage: any): void;

	// Removed individual args from definition because we are using the arguments variable.
	abstract onHeal(creature: Creature, amount: number): void;

	abstract onAttack(creature: any, damage: any): void;

	abstract findCreature(o: any): Creature[];

	abstract clearOncePerDamageChain(): void;

	/* endGame()
	 *
	 * End the game and print stats
	 */
	abstract endGame(): void;

	abstract action(o: any, opt: any): void;

	abstract getImage(url: string): void;

	abstract resetGame(): void;
}
