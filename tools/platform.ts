// Platform CLI — one entry point for every website/app Ancient Beast ships to.
//
// Usage:
//   bun tools/platform.ts                  interactive menu (TTY only) or help
//   bun tools/platform.ts list             show every platform and its transports
//   bun tools/platform.ts build [id]       build one platform (or all)
//   bun tools/platform.ts dev [id]         run a platform's dev/playtest flow
//   bun tools/platform.ts deploy [id]      run a platform's deploy steps
//
// Platform descriptors live in platforms/<id>/platform.ts — supporting a new
// website/app is adding a folder there, not npm scripts or git branches.
//
// When run without a subcommand in a real terminal it shows a menu; in CI
// (no TTY) it prints help instead of hanging on a prompt that can never
// arrive — so automation always uses the explicit subcommand form.

import { spawnSync } from 'child_process';
import { createInterface } from 'readline';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadPlatforms, type PlatformDescriptor } from '../platforms/index';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const actions = ['dev', 'build', 'deploy'] as const;
type Action = (typeof actions)[number];

// A human is actually watching: menus and colors are safe. Otherwise (CI,
// pipes, redirects) stay plain and non-interactive.
const isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI);
const c = isTTY
	? {
			bold: '\x1b[1m',
			dim: '\x1b[2m',
			cyan: '\x1b[36m',
			green: '\x1b[32m',
			yellow: '\x1b[33m',
			reset: '\x1b[0m',
	  }
	: { bold: '', dim: '', cyan: '', green: '', yellow: '', reset: '' };

function runStep(step: { label: string; run: string }, env: Record<string, string>): boolean {
	console.log(`\n${c.cyan}>${c.reset} ${step.label} ${c.dim}(${step.run})${c.reset}`);
	const [command, ...args] = step.run.split(' ');
	// `bun run` puts node_modules/.bin on PATH; running this CLI directly does
	// not, so vite/devvit would resolve to ENOENT. Mirror the npm-script PATH.
	const pathSeparator = process.platform === 'win32' ? ';' : ':';
	const nodeBin = join(rootDir, 'node_modules', '.bin');
	const result = spawnSync(command, args, {
		cwd: rootDir,
		stdio: 'inherit',
		env: {
			...process.env,
			...env,
			PATH: `${nodeBin}${pathSeparator}${process.env.PATH ?? ''}`,
		},
		shell: process.platform === 'win32',
	});
	if (result.error) {
		console.error(`${c.yellow}Could not run "${step.run}": ${result.error.message}${c.reset}`);
		return false;
	}
	if (result.status !== 0) {
		console.error(
			`${c.yellow}Step failed (exit ${result.status ?? 'signal'}): ${step.run}${c.reset}`,
		);
		return false;
	}
	return true;
}

function runAction(platform: PlatformDescriptor, action: Action): boolean {
	console.log(
		`\n${c.bold}${platform.emoji} ${platform.label}${c.reset} ${c.dim}— ${action}${c.reset}`,
	);
	for (const step of platform.preBuild) {
		if (!runStep(step, platform.env)) return false;
	}
	return runStep(platform.commands[action], platform.env);
}

function printHelp(): void {
	console.log(`
${c.bold}Ancient Beast — platform tools${c.reset}

  ${c.cyan}list${c.reset}                 Show supported platforms and their transports
  ${c.cyan}build${c.reset} [id]           Build one platform (defaults to all)
  ${c.cyan}dev${c.reset} [id]             Run a platform's dev/playtest flow
  ${c.cyan}deploy${c.reset} [id]          Run a platform's deploy steps
  ${c.cyan}help${c.reset}                 Show this help

Platform ids come from platforms/<id>/platform.ts.
`);
}

function listPlatforms(platforms: PlatformDescriptor[]): void {
	console.log(`\n${c.bold}Supported platforms${c.reset}`);
	for (const platform of platforms) {
		console.log(`\n  ${c.green}${platform.emoji} ${platform.id}${c.reset} — ${platform.label}`);
		console.log(`  ${c.dim}${platform.description}${c.reset}`);
		console.log(`  builds to: ${platform.outputDir}`);
		for (const transport of platform.transports) {
			const planned = transport.status === 'planned' ? ` ${c.dim}[planned]${c.reset}` : '';
			console.log(`  transport: ${transport.label}${planned}`);
		}
	}
	console.log('');
}

function prompt(question: string): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer);
		});
	});
}

async function actionMenu(platform: PlatformDescriptor): Promise<void> {
	for (;;) {
		console.log(`\n${c.bold}${platform.emoji} ${platform.label}${c.reset} — choose an action:`);
		actions.forEach((action, index) => {
			console.log(`  ${c.cyan}${index + 1}${c.reset}) ${platform.commands[action].label}`);
		});
		console.log(`  ${c.cyan}0${c.reset}) ↩️ Back`);
		const answer = (await prompt('\n> ')).trim();
		if (answer === '' || answer === '0') return;
		const action = actions[Number(answer) - 1];
		if (!action) {
			console.log(`${c.yellow}Unknown choice: ${answer}${c.reset}`);
			continue;
		}
		runAction(platform, action);
	}
}

async function interactiveMenu(platforms: PlatformDescriptor[]): Promise<void> {
	console.log(`${c.bold}Ancient Beast — platform tools${c.reset}`);
	for (;;) {
		console.log(`\n${c.bold}Choose a platform:${c.reset}`);
		platforms.forEach((platform, index) => {
			console.log(`  ${c.cyan}${index + 1}${c.reset}) ${platform.emoji} ${platform.label}`);
		});
		console.log(`  ${c.cyan}0${c.reset}) ❌ Exit`);
		const answer = (await prompt('\n> ')).trim();
		if (answer === '' || answer === '0') return;
		const platform = platforms[Number(answer) - 1];
		if (!platform) {
			console.log(`${c.yellow}Unknown choice: ${answer}${c.reset}`);
			continue;
		}
		await actionMenu(platform);
	}
}

async function main(): Promise<void> {
	const platforms = await loadPlatforms();
	const [command, platformId] = process.argv.slice(2);

	if (!command) {
		if (isTTY) await interactiveMenu(platforms);
		else printHelp();
		return;
	}

	if (command === 'list') {
		listPlatforms(platforms);
		return;
	}

	if (command === 'help' || command === '--help' || command === '-h') {
		printHelp();
		return;
	}

	if (command !== 'build' && command !== 'dev' && command !== 'deploy') {
		console.error(`${c.yellow}Unknown command: ${command}${c.reset}`);
		printHelp();
		process.exitCode = 1;
		return;
	}

	const targets = platformId
		? platforms.filter((platform) => platform.id === platformId)
		: platforms;

	if (targets.length === 0) {
		console.error(`${c.yellow}Unknown platform: ${platformId}${c.reset}`);
		listPlatforms(platforms);
		process.exitCode = 1;
		return;
	}

	for (const platform of targets) {
		if (!runAction(platform, command)) {
			process.exitCode = 1;
			return;
		}
	}
	console.log(`\n${c.green}Done.${c.reset}`);
}

void main();
