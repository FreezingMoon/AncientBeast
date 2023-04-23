import { toBool } from './utility/string';

/**
 * ===============================================================
 * HOW TO SET A DEBUG VALUE 
 * ===============================================================
 * 
 * These values are pulled from .env* files in the project root.
 * 
 * If you would like to modify debug values for local development,
 * copy /.env.example as /.env and change the values in that file.
 * 
 * Ex.
 * 
 * .env
 * DEBUG_DISABLE_MUSIC=true
 * 
 */

export const DEBUG = toBool(process.env.DEBUG_MODE);

/**
 * ===============================================================
 * VALUE OF `DEBUG` CONTROLS ALL DEBUG_* VALUES
 * ===============================================================
 * 
 * If DEBUG is false, all DEBUG_* values are also false.
 * 
 */

const d = DEBUG; 

export const DEBUG_DISABLE_GAME_STATUS_CONSOLE_LOG =
	d && toBool(process.env.DEBUG_DISABLE_GAME_STATUS_CONSOLE_LOG);

export const DEBUG_DISABLE_MUSIC = d && toBool(process.env.DEBUG_DISABLE_MUSIC);
