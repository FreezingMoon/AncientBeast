import { getUrl } from '../assets';
import type { CreatureType } from '../data/types';
import { unitData } from '../data/units';

type AvatarMetadata = {
	name: string;
	set: string;
};

const avatarMetadataByType = new Map<string, AvatarMetadata>();

for (const unit of unitData) {
	const type = `${unit.realm}${unit.level}`;
	if (!type || type === '--') continue;

	avatarMetadataByType.set(type, {
		name: unit.name,
		set: unit.set || '',
	});
}

let installed = false;

function cssEscape(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function getAvatarSet(type: CreatureType | string): string {
	return avatarMetadataByType.get(String(type))?.set || '';
}

export function installAvatarStyles(): void {
	if (installed) return;
	installed = true;

	const rules: string[] = [];

	for (const [type, metadata] of avatarMetadataByType.entries()) {
		const avatarUrl = getUrl(`units/avatars/${metadata.name}`);
		const escapedUrl = cssEscape(avatarUrl);
		const escapedSet = cssEscape(metadata.set);

		// Keep a generic fallback for today's single-set assets while also emitting
		// a set-aware selector so future alternate sets have a clean hook.
		rules.push(
			`.vignette.type${type}, .vignette.type${type}[data-set="${escapedSet}"] { background-image: url("${escapedUrl}"); }`,
		);
	}

	const style = document.createElement('style');
	style.id = 'generated-avatar-styles';
	style.textContent = rules.join('\n');
	document.head.appendChild(style);
}
