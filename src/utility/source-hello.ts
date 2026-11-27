/** Where people peeking under the hood can get involved (#247). */
const REPO_URL = 'https://github.com/FreezingMoon/AncientBeast';
const CONTRIBUTING_URL = `${REPO_URL}/blob/master/CONTRIBUTING.md`;
const BOUNTIES_URL = `${REPO_URL}/issues?q=is%3Aissue+is%3Aopen+label%3Abounty`;
const DISCORD_URL = 'https://discord.gg/x78rKen';

/**
 * A greeting in the browser console for curious players who open the developer
 * tools (#247), pointing them at the open source repository, like SoundCloud
 * did. Printed once, at startup.
 */
export function printSourceHello() {
	if (typeof console === 'undefined' || typeof console.log !== 'function') {
		return;
	}
	console.log(
		'%c🐺 Ancient Beast%c is free & open source!\n\n' +
			`Peeking at the code? Come and help make it better:\n` +
			`• Source code: ${REPO_URL}\n` +
			`• How to contribute: ${CONTRIBUTING_URL}\n` +
			`• Issues with bounties: ${BOUNTIES_URL}\n` +
			`• Chat with us on Discord: ${DISCORD_URL}`,
		'color: #f5c542; font-size: 20px; font-weight: bold; text-shadow: 1px 1px 0 #000;',
		'font-size: 14px;',
	);
}
