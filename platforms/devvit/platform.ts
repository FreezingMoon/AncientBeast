// Reddit (Devvit) — serverless app running inside Reddit's webview.
import type { PlatformDescriptor } from '../index';

const platformDir = import.meta.dirname;

export default {
	id: 'devvit',
	emoji: '👽',
	label: 'Reddit (Devvit)',
	description: 'Devvit app for Reddit (client + server bundles).',
	env: { VITE_DEVVIT_TARGET: 'true' },
	outputDir: 'dist/client',
	transports: [{ id: 'devvit-realtime', label: 'Devvit realtime', status: 'active' }],
	preBuild: [
		{
			label: 'Optimize SVGs for the Devvit webview',
			run: 'bun scripts/optimize-svgs.mjs assets/stats assets/icons assets/interface',
		},
	],
	commands: {
		dev: { label: 'Devvit playtest', run: 'devvit playtest', cwd: platformDir },
		build: { label: 'Vite build for the Devvit client', run: 'vite build' },
		deploy: {
			label: 'Build + upload to Reddit (Devvit CLI)',
			run: 'devvit upload',
			cwd: platformDir,
		},
	},
} satisfies PlatformDescriptor;
