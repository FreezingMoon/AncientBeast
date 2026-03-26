import { Drop } from '../drop';

type ModifierKind = 'buff' | 'debuff' | 'neutral';

type ModifierSource = {
	kind: ModifierKind;
	text: string;
};

function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function getBaseValue(creature: any, statKey: string, fallbackBaseValue: number): number {
	const baseValue = creature?.baseStats?.[statKey];

	return typeof baseValue === 'number' ? baseValue : fallbackBaseValue;
}

export function getBuffDebuffSources(creature: any, statKey: string): ModifierSource[] {
	if (!creature) {
		return [];
	}

	return [...creature.effects, ...creature.dropCollection].flatMap((modifier) => {
		if (!modifier.alterations || !(statKey in modifier.alterations)) {
			return [];
		}

		const value = modifier.alterations[statKey];
		const source = modifier instanceof Drop ? modifier.name : modifier.name || 'Unknown';

		if (typeof value === 'number') {
			if (value === 0) {
				return [];
			}

			return [
				{
					kind: value > 0 ? 'buff' : 'debuff',
					text: `${value > 0 ? '+' : ''}${value} from ${source}`,
				},
			];
		}

		if (typeof value === 'string') {
			const kind = value.includes('*') ? 'buff' : value.includes('/') ? 'debuff' : 'neutral';

			return [{ kind, text: `${value} from ${source}` }];
		}

		if (typeof value === 'boolean') {
			return [{ kind: 'neutral', text: `${source}: ${value ? 'enabled' : 'disabled'}` }];
		}

		return [];
	});
}

export function getStatWithBuffs(
	creature: any,
	statKey: string,
	fallbackBaseValue: number,
): {
	current: number;
	change: number;
	sources: ModifierSource[];
	isBuffed: boolean;
	isDebuffed: boolean;
} {
	const baseValue = getBaseValue(creature, statKey, fallbackBaseValue);

	if (!creature) {
		return {
			current: baseValue,
			change: 0,
			sources: [],
			isBuffed: false,
			isDebuffed: false,
		};
	}

	const currentValue = creature.stats?.[statKey] ?? baseValue;
	const change = currentValue - baseValue;
	const sources = getBuffDebuffSources(creature, statKey);

	return {
		current: currentValue,
		change,
		sources,
		isBuffed: change > 0,
		isDebuffed: change < 0,
	};
}

export function generateStatTooltip(
	creature: any,
	statKey: string,
	fallbackBaseValue: number,
): string {
	const statData = getStatWithBuffs(creature, statKey, fallbackBaseValue);

	if (statData.sources.length === 0) {
		return '';
	}

	const changeText =
		statData.change === 0 ? '' : ` (${statData.change > 0 ? '+' : ''}${statData.change})`;
	const sources = statData.sources
		.map(
			(source) =>
				`<div class="stat-modifier-source ${source.kind}">${escapeHtml(source.text)}</div>`,
		)
		.join('');

	return `
		<div class="modifiers stat-modifiers">
			<div class="stat-modifier-title">${escapeHtml(statKey.toUpperCase())}</div>
			<div class="stat-modifier-summary">Base: ${statData.current - statData.change}</div>
			<div class="stat-modifier-summary">Current: ${statData.current}${changeText}</div>
			${sources}
		</div>
	`;
}

export function applyBuffDebuffStyle(
	$stat: any,
	creature: any,
	statKey: string,
	fallbackBaseValue: number,
	isBrowsing = false,
): void {
	$stat.removeClass('buff debuff').removeAttr('title');

	const $statContainer = $stat.closest('.stat');
	$statContainer.children('.stat-modifiers').remove();

	if (isBrowsing || !creature) {
		return;
	}

	const statData = getStatWithBuffs(creature, statKey, fallbackBaseValue);

	if (statData.isBuffed) {
		$stat.addClass('buff');
	} else if (statData.isDebuffed) {
		$stat.addClass('debuff');
	}

	const tooltipHtml = generateStatTooltip(creature, statKey, fallbackBaseValue);
	if (tooltipHtml !== '') {
		$statContainer.append(tooltipHtml);
	}
}
