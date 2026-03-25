/**
 * Session - Lobby-based session management
 * 
 * Replaces old Nakama-based session with new lobby system.
 * @file session.js
 */

export default class Session {
	constructor() {
		this.playerId = null;
		this.createdAt = null;
	}

	/**
	 * Create new session with player ID
	 */
	static create(playerId) {
		const session = new Session();
		session.playerId = playerId;
		session.createdAt = new Date();
		return session;
	}

	/**
	 * Get player ID
	 */
	getPlayerId() {
		return this.playerId;
	}

	/**
	 * Get session creation time
	 */
	getCreatedAt() {
		return this.createdAt;
	}

	/**
	 * Check if session is valid
	 */
	isValid() {
		return this.playerId !== null;
	}

	/**
	 * Clear session
	 */
	clear() {
		this.playerId = null;
		this.createdAt = null;
	}
}
