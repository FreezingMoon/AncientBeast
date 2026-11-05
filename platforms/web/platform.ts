// Standalone website — the default distribution target.
import type { PlatformDescriptor } from '../index';

export default {
	id: 'web',
	emoji: '🐺',
	label: 'AncientBeast.com',
	description: 'Standalone website build.',
	// Explicitly pinned false: a stray VITE_DEVVIT_TARGET=true in a local .env
	// must never silently turn `vite build` into a Reddit-targeted build.
	env: { VITE_DEVVIT_TARGET: 'false' },
	outputDir: 'deploy',
	transports: [
		{ id: 'peerjs', label: 'PeerJS (P2P)', status: 'active' },
		{ id: 'rivalis', label: 'Rivalis (dedicated server)', status: 'planned' },
		{ id: 'hono', label: 'Hono (custom API)', status: 'planned' },
	],
	preBuild: [],
	commands: {
		dev: { label: 'Start Vite dev server', run: 'vite' },
		build: { label: 'Production build', run: 'vite build' },
		deploy: { label: 'Production build (upload runs in CI)', run: 'vite build' },
	},
} satisfies PlatformDescriptor;
