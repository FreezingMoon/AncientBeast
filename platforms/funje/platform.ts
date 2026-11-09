// Funje arcade website — client build loaded inside Funje's iframe via their SDK.
import type { PlatformDescriptor } from '../index';

export default {
	id: 'funje',
	emoji: '🎮',
	label: 'Funje.com',
	description: 'Funje arcade website build (iframe embed via Funje SDK).',
	env: { VITE_FUNJE_TARGET: 'true' },
	outputDir: 'deploy/funje',
	transports: [
		{ id: 'peerjs', label: 'PeerJS (P2P)', status: 'active' },
		{ id: 'rivalis', label: 'Rivalis (dedicated server)', status: 'planned' },
	],
	preBuild: [],
	commands: {
		dev: { label: 'Start Vite dev server', run: 'vite' },
		build: { label: 'Production build', run: 'vite build' },
		deploy: { label: 'Production build (upload runs in CI)', run: 'vite build' },
	},
} satisfies PlatformDescriptor;
