/**
 * Lobby Server Configuration
 */

export const config = {
	// Server port
	port: Number(process.env.LOBBY_PORT || 3001),

	// Allowed CORS origins
	allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
		'http://localhost:3000',
		'http://localhost:8080',
		'https://ancientbeast.com',
	],

	// Lobby settings
	lobby: {
		maxPlayers: 8,
		defaultGameMode: 'standard',
		readyTimeout: 30000, // 30 seconds
	},

	// Matchmaking settings
	matchmaking: {
		maxQueueTime: 120000, // 2 minutes
		skillBasedMatching: false, // Set to true for ranked play
		regionMatching: true,
	},

	// Qoddi deployment
	qoddi: {
		enabled: process.env.NODE_ENV === 'production',
		domain: process.env.QODDI_DOMAIN || 'ancientbeast-lobby.qoddiapp.com',
	},
};
