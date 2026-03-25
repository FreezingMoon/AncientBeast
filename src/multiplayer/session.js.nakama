import { Session } from '@heroiclabs/nakama-js';

export default class SessionI {
	constructor(session) {
		this.session = session || '';
	}
	storeSession() {
		if (typeof Storage !== 'undefined') {
			localStorage.setItem('nakamaToken', this.session.token);
			console.log('New Session stored.');
		}
	}
	async getSessionFromStorage() {
		if (typeof Storage !== 'undefined') {
			return Promise.resolve(localStorage.getItem('nakamaToken'));
		}
	}

	async restoreSession() {
		var session = null;
		return this.getSessionFromStorage().then((token) => {
			if (token && token != '') {
				session = Session.restore(token);
				var currentTimeInSec = new Date() / 1000;
				if (!session.isexpired(currentTimeInSec)) {
					console.log('Restored session. User ID: %o', session.user_id);
					return Promise.resolve(session);
				}
				return Promise.resolve('session expired');
			}
		});
	}
}
