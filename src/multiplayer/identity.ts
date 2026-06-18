const PLAYER_ID_STORAGE_KEY = 'ab:player-id';

export class PlayerIdentity {
	getId(): string {
		let id = localStorage.getItem(PLAYER_ID_STORAGE_KEY);

		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem(PLAYER_ID_STORAGE_KEY, id);
		}

		return id;
	}
}
