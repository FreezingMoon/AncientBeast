// funje platform hooks (https://funje.com).
//
// The funje SDK, loaded by index.ejs from /sdk/playafk-sdk.js, exposes
// `window.PlayAFK` when the game runs inside funje's player. Elsewhere the
// script is absent, `init()` never resolves, and every call below is a no-op,
// so the game behaves exactly as upstream.
//
// All calls are additionally gated behind `process.env.VITE_FUNJE_TARGET`
// (set by platforms/funje/platform.ts) so non-funje builds tree-shake them
// away entirely — nothing funje-specific leaks into other platforms.

type FunjeSdk = {
	init(): Promise<void>;
	game: {
		loadingStart(): unknown;
		loadingStop(): unknown;
		gameplayStart(): unknown;
		gameplayStop(): unknown;
	};
};

const sdk = (): FunjeSdk | undefined =>
	typeof window === 'undefined' ? undefined : (window as unknown as { PlayAFK?: FunjeSdk }).PlayAFK;

let ready: Promise<boolean> | null = null;

/** Starts the SDK handshake once; resolves true when funje answered. */
export function funjeInit(): Promise<boolean> {
	if (process.env.VITE_FUNJE_TARGET !== 'true') {
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

function call(fn: (s: FunjeSdk) => unknown): void {
	void funjeInit().then((ok) => {
		const s = sdk();
		if (!ok || !s) return;
		try {
			fn(s);
		} catch (error) {
			console.warn('[funje] SDK call failed', error);
		}
	});
}

/** Plays, play time and the developer revenue share on funje are counted from these. */
export const funje = {
	loadingStart: () => call((s) => s.game.loadingStart()),
	loadingStop: () => call((s) => s.game.loadingStop()),
	/** a match is on the board and the player is playing (not in menus) */
	gameplayStart: () => call((s) => s.game.gameplayStart()),
	/** the match ended or was abandoned */
	gameplayStop: () => call((s) => s.game.gameplayStop()),
};
