import type Phaser from 'phaser';

/**
 * The game's gameplay message channels and the messages each one carries.
 *
 * The channel names are the same four Phaser 2 CE `Signal`s AB used (`ui`,
 * `metaPowers`, `creature`, `hex`), but the payload shape is now declared rather
 * than discovered by a handler switching on a string. Two things follow from
 * `EventEmitter` having no wildcard:
 *
 *  - each channel lists its own message names here, so `emit`/`on` are checked
 *    against a union instead of `any`;
 *  - there is no catch-all listener left in AB. Every former
 *    `switch (message)` block became one `on()` per message.
 */

type Emitter = Phaser.Events.EventEmitter;

/** Messages on the `ui` channel: interface view toggles and hover handshakes. */
export type UiMessage =
	| 'toggleDash'
	| 'toggleScore'
	| 'toggleMusicPlayer'
	| 'toggleSecretView'
	| 'toggleMetaPowers'
	| 'closeInterfaceScreens'
	| 'onOpenDash'
	| 'onCloseDash'
	| 'vignettecreatureclick'
	| 'vignettecreaturemouseenter'
	| 'vignettecreaturemouseleave'
	| 'vignettedelayclick'
	| 'vignettedelaymouseenter'
	| 'vignettedelaymouseleave'
	| 'vignetteturnendlick'
	| 'vignetteturnendmouseenter'
	| 'vignetteturnendmouseleave';

export interface UiPayloads {
	vignettecreatureclick: { creature: unknown };
	vignettecreaturemouseenter: { creature: unknown };
	vignetteturnendlick: { turnNumber: number };
	vignetteturnendmouseenter: { turnNumber: number };
}

/** Messages on the `creature` channel: turn and movement lifecycle. */
export type CreatureMessage = 'activate' | 'abilityend' | 'movementComplete' | 'frozen';

export interface CreaturePayloads {
	activate: { creature: unknown };
	abilityend: { creature: unknown };
	movementComplete: { creature: unknown; hex: unknown };
	frozen: { creature: unknown; cryostasis: boolean };
}

/** Messages on the `hex` channel: the pointer entering and leaving a hex. */
export type HexMessage = 'over' | 'out';

export interface HexPayloads {
	over: { hex: unknown };
	out: { hex: unknown };
}

export interface MetaPowersState {
	executeMonster: boolean;
	resetCooldowns: boolean;
	disableMaterializationSickness: boolean;
	infiniteEnergy: boolean;
}

/**
 * Meta power messages, named `` `toggle${Capitalize<Key>}` `` for each key of
 * {@link MetaPowersState}. Every payload is a boolean.
 */
export type MetaPowerMessage =
	| 'toggleExecuteMonster'
	| 'toggleResetCooldowns'
	| 'toggleDisableMaterializationSickness'
	| 'toggleInfiniteEnergy';

export interface MetaPowerPayloads {
	toggleExecuteMonster: boolean;
	toggleResetCooldowns: boolean;
	toggleDisableMaterializationSickness: boolean;
	toggleInfiniteEnergy: boolean;
}

/** Every channel, keyed by name. */
export interface GameChannels {
	readonly ui: Emitter;
	readonly metaPowers: Emitter;
	readonly creature: Emitter;
	readonly hex: Emitter;
}

export const CHANNEL_NAMES = ['ui', 'metaPowers', 'creature', 'hex'] as const;
export type ChannelName = (typeof CHANNEL_NAMES)[number];
