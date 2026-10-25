const PLAYER_ID_STORAGE_KEY = 'ab:player-id';

function generateId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback for older browsers
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
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
}
