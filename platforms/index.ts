// Platform registry — the single source of truth for every website/app Ancient
// Beast ships to.
//
// A platform is a declarative descriptor: environment variables, build steps,
// deploy command and the multiplayer transports it supports. Adding a new
// integration means adding one folder under platforms/<id>/ — no package.json
// churn, no per-platform branches, no vite.config.mts surgery. The CLI in
// tools/platform.ts reads this registry and drives it.

import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

export type TransportStatus = 'active' | 'planned';

export interface TransportInfo {
	id: string;
	label: string;
	status: TransportStatus;
}

export interface CommandStep {
	label: string;
	run: string;
}

export interface PlatformDescriptor {
	id: string;
	/** Mascot shown in the CLI menus (e.g. the wolf for AncientBeast.com). */
	emoji: string;
	label: string;
	description: string;
	/** Env vars applied to every step of this platform (vite reads these via loadEnv). */
	env: Record<string, string>;
	/** Build output directory (informational — vite.config.mts derives it from `env`). */
	outputDir: string;
	transports: TransportInfo[];
	preBuild: CommandStep[];
	commands: {
		dev: CommandStep;
		build: CommandStep;
		deploy: CommandStep;
	};
}

/** Loads every `platforms/<id>/platform.ts` descriptor. */
export async function loadPlatforms(): Promise<PlatformDescriptor[]> {
	const dir = dirname(fileURLToPath(import.meta.url));
	const platforms: PlatformDescriptor[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		try {
			const module = await import(pathToFileURL(join(dir, entry.name, 'platform.ts')).href);
			platforms.push(module.default);
		} catch (error) {
			console.warn(`⚠ Could not load platform "${entry.name}":`, error);
		}
	}
	return platforms.sort((a, b) => a.label.localeCompare(b.label));
}
