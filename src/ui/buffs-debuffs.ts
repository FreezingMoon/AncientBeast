/* eslint-disable @typescript-eslint/no-explicit-any */
import * as $j from 'jquery';
import { Drop } from '../drop';

type ModifierKind = 'buff' | 'debuff' | 'neutral';

type ModifierSource = {
	kind: ModifierKind;
	text: string;
};

type CreatureLike = {
	baseStats?: any;
	effects: { name?: string; alterations?: any }[];
	dropCollection: { name?: string; alterations?: any }[];
	stats?: any;
};

function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function getBaseValue(
	creature: CreatureLike | null,
	statKey: string,
	fallbackBaseValue: number,
): number {
	const baseValue = creature?.baseStats?.[statKey];

	return typeof baseValue === 'number' ? baseValue : fallbackBaseValue;
}

export function getBuffDebuffSources(
	creature: CreatureLike | null,
	statKey: string,
): ModifierSource[] {
	if (!creature) {
		return [];
	}

	const numericSources = new Map<string, { kind: ModifierKind; source: string; value: number }>();
	const nonNumericSources: ModifierSource[] = [];

	[...creature.effects, ...creature.dropCollection].forEach((modifier) => {
		if (!modifier.alterations || !(statKey in modifier.alterations)) {
			return;
		}

		const value = modifier.alterations[statKey];
		const source = modifier instanceof Drop ? modifier.name : modifier.name || 'Unknown';

		if (typeof value === 'number') {
			if (value === 0) {
				return;
			}

			const kind: ModifierKind = value > 0 ? 'buff' : 'debuff';
			const key = `${kind}::${source}`;
			const existing = numericSources.get(key);

			if (existing) {
				existing.value += value;
				return;
			}

			numericSources.set(key, { kind, source, value });
			return;
		}

		if (typeof value === 'string') {
			const kind = value.includes('*') ? 'buff' : value.includes('/') ? 'debuff' : 'neutral';

			nonNumericSources.push({ kind, text: `${value} from ${source}` });
			return;
		}

		if (typeof value === 'boolean') {
			nonNumericSources.push({ kind: 'neutral', text: `${source}: ${value ? 'enabled' : 'disabled'}` });
			return;
		}
	});

	const stackedNumericSources = [...numericSources.values()]
		.filter((entry) => entry.value !== 0)
		.map((entry) => ({
			kind: entry.kind,
			text: `${entry.value > 0 ? '+' : ''}${entry.value} from ${entry.source}`,
		}));

	return [...stackedNumericSources, ...nonNumericSources];
}

export function getStatWithBuffs(
	creature: CreatureLike | null,
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
	creature: CreatureLike | null,
	statKey: string,
	fallbackBaseValue: number,
): string {
	const statData = getStatWithBuffs(creature, statKey, fallbackBaseValue);

	if (statData.sources.length === 0) {
		return '';
	}

	const baseValue = statData.current - statData.change;
	const changeSign = statData.change > 0 ? '+' : '';
	const changeKind = statData.change > 0 ? 'buff' : 'debuff';
	const sources = statData.sources
		.map(
			(source) =>
				`<div class="stat-modifier-source ${source.kind}">${escapeHtml(source.text)}</div>`,
		)
		.join('');

	return `
		<div class="modifiers stat-modifiers">
			<div class="stat-modifier-title">${escapeHtml(statKey.charAt(0).toUpperCase() + statKey.slice(1).toLowerCase())}</div>
			<div class="stat-modifier-separator"></div>
			<div class="stat-modifier-formula">
				<span class="stat-modifier-base">${baseValue}</span>
				<span class="stat-modifier-change ${changeKind}">${changeSign}${statData.change}</span>
				<span class="stat-modifier-equals">= ${statData.current}</span>
			</div>
			<div class="stat-modifier-separator"></div>
			${sources}
		</div>
	`;
}

export function applyBuffDebuffStyle(
	$stat: ReturnType<typeof $j>,
	creature: CreatureLike | null,
	statKey: string,
	fallbackBaseValue: number,
	isBrowsing = false,
): void {
	$stat.removeClass('buff debuff').removeAttr('title');

	const $statContainer = $stat.closest('.stat');
	const defaultTitle = $statContainer.data('default-title') as string | undefined;
	if (defaultTitle === undefined) {
		const initialTitle = $statContainer.attr('title');
		if (initialTitle !== undefined) {
			$statContainer.data('default-title', initialTitle);
		}
	}

	const restoreTitle = () => {
		$statContainer.removeAttr('title');
	};
	$statContainer.removeAttr('title');
	$statContainer.children('.stat-modifiers').remove();

	if (isBrowsing || !creature) {
		restoreTitle();
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
		$statContainer.removeAttr('title');
		$statContainer.append(tooltipHtml);
		return;
	}

	restoreTitle();
}
