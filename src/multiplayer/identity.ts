const PLAYER_ID_STORAGE_KEY = 'ab:player-id';

function generateId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback for older browsers
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x8) | 0x8;
		return v.toString(16);
	});
}

type DisplayNameListener = (name: string | null) => void;

/**
 * Platform-provided display name (e.g. the CrazyGames username). Kept outside
 * PlayerIdentity so it can be set asynchronously after the SDK answers, while
 * the stable localStorage id remains the identity used by the transport.
 */
let cachedDisplayName: string | null = null;
const displayNameListeners = new Set<DisplayNameListener>();

/** Set the platform display name and notify subscribers (e.g. an open lobby). */
export function setPlayerDisplayName(name: string | null): void {
	cachedDisplayName = name || null;
	displayNameListeners.forEach((listener) => listener(cachedDisplayName));
}

/** Subscribe to display-name changes; returns an unsubscribe function. */
export function onPlayerDisplayNameChange(listener: DisplayNameListener): () => void {
	displayNameListeners.add(listener);
	return () => {
		displayNameListeners.delete(listener);
	};
}

export class PlayerIdentity {
	getId(): string {
		let id = localStorage.getItem(PLAYER_ID_STORAGE_KEY);

		if (!id) {
			id = generateId();
			localStorage.setItem(PLAYER_ID_STORAGE_KEY, id);
		}

		return id;
	}

	/** Platform display name (CrazyGames username), or undefined when unknown. */
	getName(): string | undefined {
		return cachedDisplayName ?? undefined;
	}
}
