// CrazyGames platform hooks (https://www.crazygames.com).
//
// The CrazyGames SDK v3 is loaded by index.ejs from
// https://sdk.crazygames.com/crazygames-sdk-v3.js and exposes
// `window.CrazyGames.SDK` when the game runs inside CrazyGames' player.
// Elsewhere the script is absent, `init()` never resolves, and every call
// below is a no-op, so the game behaves exactly as upstream.
//
// All calls are additionally gated behind `process.env.VITE_CRAZYGAMES_TARGET`
// (set by platforms/crazygames/platform.ts) so non-CrazyGames builds tree-shake
// them away entirely — nothing CrazyGames-specific leaks into other platforms.

export type CrazyGamesUser = {
	username: string;
	profilePictureUrl?: string;
	__dangerousUserId?: string;
};

export type CrazyGamesSettings = {
	muteAudio?: boolean;
	mute?: boolean;
	disableChat?: boolean;
};

export type CrazyGamesRoom = {
	roomId?: string;
	isJoinable?: boolean;
	inviteParams?: Record<string, string>;
};

export type CrazyGamesJoinParams = Record<string, string>;

type CrazyGamesBanner = {
	requestBanner?(options: { id: string; width: number; height: number }): Promise<unknown>;
	requestResponsiveBanner?(containerId: string): Promise<unknown>;
	clearBanner?(containerId: string): unknown;
	clearAllBanners?(): unknown;
};

type CrazyGamesSdk = {
	init(): Promise<void>;
	game: {
		loadingStart(): unknown;
		loadingStop(): unknown;
		gameplayStart(): unknown;
		gameplayStop(): unknown;
		happytime?(): unknown;
		settings?: CrazyGamesSettings;
		isInstantMultiplayer?: boolean;
		inviteParams?: CrazyGamesJoinParams | null;
		getInviteParam?(name: string): string | null;
		inviteLink?(params: CrazyGamesJoinParams): string;
		updateRoom?(room: CrazyGamesRoom): unknown;
		leftRoom?(): unknown;
		addJoinRoomListener?(listener: (params: CrazyGamesJoinParams) => void): unknown;
		removeJoinRoomListener?(listener: (params: CrazyGamesJoinParams) => void): unknown;
		addSettingsChangeListener?(listener: (settings: CrazyGamesSettings) => void): unknown;
		removeSettingsChangeListener?(listener: (settings: CrazyGamesSettings) => void): unknown;
	};
	user?: {
		getUser(): Promise<CrazyGamesUser | null>;
	};
	banner?: CrazyGamesBanner;
};

/** True when this bundle is the CrazyGames build (build-time constant). */
export function isCrazyGamesTarget(): boolean {
	return process.env.VITE_CRAZYGAMES_TARGET === 'true';
}

const sdk = (): CrazyGamesSdk | undefined =>
	typeof window === 'undefined'
		? undefined
		: (window as unknown as { CrazyGames?: { SDK?: CrazyGamesSdk } }).CrazyGames?.SDK;

let ready: Promise<boolean> | null = null;

/** Starts the SDK handshake once; resolves true when CrazyGames answered. */
export function crazyGamesInit(): Promise<boolean> {
	if (process.env.VITE_CRAZYGAMES_TARGET !== 'true') {
		return Promise.resolve(false);
	}
	if (!ready) {
		const s = sdk();
		ready = s
			? s.init().then(
					() => true,
					() => false,
			  )
			: Promise.resolve(false);
	}
	return ready;
}

function call(fn: (s: CrazyGamesSdk) => unknown): void {
	void crazyGamesInit().then((ok) => {
		if (!ok) return;
		const s = sdk();
		if (!s) return;
		try {
			const result = fn(s);
			// Banner requests are async; swallow rejections (cooldown, no fill…)
			// so they never surface as unhandled promise rejections.
			if (result && typeof (result as Promise<unknown>).catch === 'function') {
				(result as Promise<unknown>).catch((error) =>
					console.warn('[crazygames] SDK call failed', error),
				);
			}
		} catch (error) {
			console.warn('[crazygames] SDK call failed', error);
		}
	});
}

/** CrazyGames SDK v3 surface used by the game. */
export const crazyGames = {
	loadingStart: () => call((s) => s.game.loadingStart()),
	loadingStop: () => call((s) => s.game.loadingStop()),
	/** a match is on the board and the player is playing (not in menus) */
	gameplayStart: () => call((s) => s.game.gameplayStart()),
	/** the match ended or was abandoned */
	gameplayStop: () => call((s) => s.game.gameplayStop()),
	/** celebrate a notable achievement (CrazyGames may show confetti) */
	happytime: () => call((s) => s.game.happytime?.()),

	/** CrazyGames player settings (muteAudio / disableChat); null before init. */
	getSettings: (): CrazyGamesSettings | null => sdk()?.game?.settings ?? null,

	/** Register a settings-change listener (mute/unmute from the CG player bar). */
	addSettingsChangeListener: (listener: (settings: CrazyGamesSettings) => void): void => {
		call((s) => s.game.addSettingsChangeListener?.(listener));
	},

	/** True when CrazyGames wants the player dropped straight into multiplayer. */
	isInstantMultiplayer: (): boolean => sdk()?.game?.isInstantMultiplayer === true,

	/** Read a single invite parameter (e.g. `join`) from an invite link. */
	getInviteParam: (name: string): string | null => {
		const s = sdk();
		if (!s) return null;
		if (typeof s.game.getInviteParam === 'function') {
			try {
				return s.game.getInviteParam(name);
			} catch {
				return null;
			}
		}
		return s.game.inviteParams?.[name] ?? null;
	},

	/** All invite parameters, or null when the game wasn't started from a link. */
	getInviteParams: (): CrazyGamesJoinParams | null => sdk()?.game?.inviteParams ?? null,

	/**
	 * The lobby code carried by an invite link, if any. Checks `getInviteParam`
	 * first, then the raw `inviteParams` object. Returns a raw (un-normalized)
	 * string; callers normalize it to their lobby-code format.
	 */
	getInviteCode: (): string | null => {
		const param = crazyGames.getInviteParam('join');
		if (param) {
			return param;
		}
		const params = crazyGames.getInviteParams();
		return params?.join ?? params?.roomName ?? params?.lobby ?? null;
	},

	/** Build a CrazyGames invite link for the given room parameters. */
	makeInviteLink: (params: CrazyGamesJoinParams): string | null => {
		const s = sdk();
		if (!s || typeof s.game.inviteLink !== 'function') return null;
		try {
			return s.game.inviteLink(params);
		} catch {
			return null;
		}
	},

	/** Share the current room so friends can join/invite (Online with Friends). */
	updateRoom: (room: CrazyGamesRoom): void => call((s) => s.game.updateRoom?.(room)),

	/**
	 * Convenience wrapper: share `code` as a joinable (or full) room, carrying the
	 * invite param that auto-joins it.
	 */
	shareRoom: (code: string, isJoinable: boolean): void =>
		call((s) => s.game.updateRoom?.({ roomId: code, isJoinable, inviteParams: { join: code } })),

	/** Tell CrazyGames the player left the room. */
	leftRoom: (): void => call((s) => s.game.leftRoom?.()),

	/** Join a room from an in-session invite (no page reload). */
	addJoinRoomListener: (listener: (params: CrazyGamesJoinParams) => void): void => {
		call((s) => s.game.addJoinRoomListener?.(listener));
	},

	/**
	 * Request a CrazyGames banner inside `containerId` (a visible element with a
	 * non-zero size). Uses a responsive banner so the SDK picks a size that fits
	 * the slot. Rejections (cooldown / no fill) are swallowed by `call`.
	 */
	requestBanner: (containerId: string): void =>
		call((s) => {
			if (s.banner?.requestResponsiveBanner) {
				return s.banner.requestResponsiveBanner(containerId);
			}
			if (s.banner?.requestBanner) {
				return s.banner.requestBanner({ id: containerId, width: 468, height: 60 });
			}
		}),

	/** Clear a single banner container (call when its view closes). */
	clearBanner: (containerId: string): void => call((s) => s.banner?.clearBanner?.(containerId)),

	/** Clear every banner (call when leaving a view that owns banners). */
	clearAllBanners: (): void => call((s) => s.banner?.clearAllBanners?.()),

	/** Signed-in CrazyGames user (username/avatar); null for guests or offline. */
	getUser: async (): Promise<CrazyGamesUser | null> => {
		if (!(await crazyGamesInit())) return null;
		const s = sdk();
		if (!s?.user) return null;
		try {
			return await s.user.getUser();
		} catch {
			return null;
		}
	},
};

/** Game-specific actions the CrazyGames bootstrap needs to call back into. */
export type CrazyGamesBootstrapHandlers = {
	/** Join a lobby from an invite/in-session code (already normalized by the caller). */
	joinLobby: (code: string) => void;
	/** Launch the instant-multiplayer flow (first player creates a private room). */
	startInstantLobby: () => void;
	/** Apply the platform mute state (true = muted) to the game's audio. */
	applyMute: (muted: boolean) => void;
	/** Set the local player's display name (e.g. the CrazyGames username). */
	setDisplayName: (name: string) => void;
};

/**
 * Wire the CrazyGames SDK into the game. Call once after the DOM is ready.
 *
 * All SDK/glue logic lives here so generic game files only need to call this and
 * pass a few callbacks. On non-CrazyGames builds this is a no-op.
 */
export function bootstrapCrazyGames(handlers: CrazyGamesBootstrapHandlers): void {
	if (!isCrazyGamesTarget()) {
		return;
	}

	// CrazyGames provides its own fullscreen control in the player bar; flag the
	// build so the in-game button can be hidden (see styles.less / fullscreen.ts).
	if (typeof document !== 'undefined') {
		document.body.classList.add('crazygames-mode');
	}

	void crazyGamesInit().then((ok) => {
		if (!ok) {
			return;
		}

		// Platform mute (the CrazyGames player bar) has priority over the in-game
		// toggle; re-apply whenever the player changes it.
		const settings = crazyGames.getSettings();
		const initialMute = settings?.muteAudio === true || settings?.mute === true;
		console.log('[crazygames] initial settings:', settings, 'mute:', initialMute);
		handlers.applyMute(initialMute);
		crazyGames.addSettingsChangeListener((settings) => {
			console.log('[crazygames] settings changed:', settings);
			const muted = settings?.muteAudio === true || settings?.mute === true;
			handlers.applyMute(muted);
		});

		// Show CrazyGames usernames in-game (falls back to "Player N" for guests).
		void crazyGames.getUser().then((user) => {
			if (user?.username) {
				handlers.setDisplayName(user.username);
			}
		});

		// In-session invites (no page reload) join the room directly.
		crazyGames.addJoinRoomListener((params) => {
			const code = params?.join ?? params?.roomName ?? params?.lobby;
			if (code) {
				handlers.joinLobby(code);
			}
		});

		// A launch from an invite link joins that room; otherwise instant
		// multiplayer drops the first player into a fresh, joinable private room.
		const inviteCode = crazyGames.getInviteCode();
		if (inviteCode) {
			handlers.joinLobby(inviteCode);
		} else if (crazyGames.isInstantMultiplayer()) {
			handlers.startInstantLobby();
		}
	});
}
