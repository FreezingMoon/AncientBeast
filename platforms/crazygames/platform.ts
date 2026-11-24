// CrazyGames.com — HTML5 build embedded on CrazyGames via their SDK v3.
import type { PlatformDescriptor } from '../index';

export default {
	id: 'crazygames',
	emoji: '🤪',
	label: 'CrazyGames.com',
	description: 'CrazyGames HTML5 build (embedded via the CrazyGames SDK v3).',
	env: {
		VITE_CRAZYGAMES_TARGET: 'true',
		// Pin the other embed targets off so a stray local .env can't turn this
		// into a funje/Reddit build.
		VITE_FUNJE_TARGET: 'false',
		VITE_DEVVIT_TARGET: 'false',
	},
	outputDir: 'deploy/crazygames',
	transports: [
		{ id: 'peerjs', label: 'PeerJS (P2P)', status: 'active' },
		{ id: 'rivalis', label: 'Rivalis (dedicated server)', status: 'planned' },
	],
	preBuild: [],
	commands: {
		dev: { label: 'Start Vite dev server', run: 'vite' },
		build: { label: 'Production build', run: 'vite build' },
		deploy: {
			label: 'Production build + upload to Vercel (crazygames.ancientbeast.com)',
			run: 'sh platforms/crazygames/deploy.sh',
		},
	},
} satisfies PlatformDescriptor;
