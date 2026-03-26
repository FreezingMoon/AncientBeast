/**
 * Buffs/Debuffs Implementation for Card B Stats
 * 
 * Implements color-coding and tooltips for unit stats based on buff/debuff state.
 * 
 * Issue: #2852
 * Bounty: 60 XTR
 */

import { Effect } from '../effect';
import { Drop } from '../drop';

/**
 * Get all buff/debuff sources for a specific stat
 * 
 * @param creature - The creature to analyze
 * @param statKey - The stat key (e.g., 'health', 'offense', etc.)
 * @returns Array of buff/debuff descriptions
 */
export function getBuffDebuffSources(creature: any, statKey: string): string[] {
	const sources: string[] = [];
	
	if (!creature) {
		return sources;
	}

	const buffDebuffArray = [...creature.effects, ...creature.dropCollection];

	buffDebuffArray.forEach((buff: Effect | Drop) => {
		if (buff.alterations && statKey in buff.alterations) {
			const value = buff.alterations[statKey];
			const title = buff.title || 'Unknown';
			
			if (typeof value === 'number') {
				if (value > 0) {
					sources.push(`+${value} from ${title}`);
				} else if (value < 0) {
					sources.push(`${value} from ${title}`);
				}
			} else if (typeof value === 'string') {
				// Multiplication/Division
				sources.push(`${value} from ${title}`);
			} else if (typeof value === 'boolean') {
				sources.push(`${title}: ${value ? 'enabled' : 'disabled'}`);
			}
		}
	});

	return sources;
}

/**
 * Get stat value with buff/debuff indicator
 * 
 * @param creature - The creature
 * @param statKey - The stat key
 * @param baseValue - The base stat value
 * @returns Object with current value, change, and sources
 */
export function getStatWithBuffs(creature: any, statKey: string, baseValue: number): {
	current: number;
	change: number;
	sources: string[];
	isBuffed: boolean;
	isDebuffed: boolean;
} {
	if (!creature) {
		return {
			current: baseValue,
			change: 0,
			sources: [],
			isBuffed: false,
			isDebuffed: false
		};
	}

	const currentValue = creature.stats[statKey] || baseValue;
	const change = currentValue - baseValue;
	const sources = getBuffDebuffSources(creature, statKey);

	return {
		current: currentValue,
		change: change,
		sources: sources,
		isBuffed: change > 0,
		isDebuffed: change < 0
	};
}

/**
 * Generate tooltip HTML for a stat
 * 
 * @param creature - The creature
 * @param statKey - The stat key
 * @param baseValue - The base stat value
 * @returns HTML string for tooltip
 */
export function generateStatTooltip(creature: any, statKey: string, baseValue: number): string {
	const statData = getStatWithBuffs(creature, statKey, baseValue);
	
	if (statData.sources.length === 0) {
		return `<div class="stat-tooltip">No buffs or debuffs</div>`;
	}

	let tooltip = `<div class="stat-tooltip">`;
	tooltip += `<div class="stat-tooltip-title">${statKey.toUpperCase()}</div>`;
	tooltip += `<div class="stat-tooltip-base">Base: ${baseValue}</div>`;
	tooltip += `<div class="stat-tooltip-current">Current: ${statData.current}`;
	
	if (statData.change !== 0) {
		tooltip += ` (${statData.change > 0 ? '+' : ''}${statData.change})`;
	}
	tooltip += `</div>`;
	tooltip += `<div class="stat-tooltip-divider"></div>`;
	tooltip += `<div class="stat-tooltip-sources">`;
	
	statData.sources.forEach((source: string) => {
		tooltip += `<div class="stat-tooltip-source">${source}</div>`;
	});
	
	tooltip += `</div></div>`;
	
	return tooltip;
}

/**
 * Apply buff/debuff styling to a stat element
 * 
 * @param $stat - jQuery element for the stat
 * @param creature - The creature
 * @param statKey - The stat key
 * @param baseValue - The base stat value
 * @param isBrowsing - Whether unit is not materialized (browsing mode)
 */
export function applyBuffDebuffStyle(
	$stat: any,
	creature: any,
	statKey: string,
	baseValue: number,
	isBrowsing: boolean = false
): void {
	// Remove existing classes
	$stat.removeClass('buff debuff');
	
	// If browsing (unit not materialized), keep white (no colors)
	if (isBrowsing || !creature) {
		return;
	}

	const statData = getStatWithBuffs(creature, statKey, baseValue);
	
	// Apply appropriate class
	if (statData.isBuffed) {
		$stat.addClass('buff');
	} else if (statData.isDebuffed) {
		$stat.addClass('debuff');
	}
	
	// Add tooltip
	const tooltipHtml = generateStatTooltip(creature, statKey, baseValue);
	$stat.attr('title', tooltipHtml);
	
	// Enable qtip if available, otherwise use native title
	if ($stat.qtip) {
		$stat.qtip({
			content: {
				text: tooltipHtml,
				title: {
					text: `${statKey.toUpperCase()} Modifiers`,
					button: true
				}
			},
			position: {
				my: 'top left',
				at: 'bottom right',
				target: $stat
			},
			style: {
				classes: 'qtip-dark qtip-shadow stat-tooltip-custom'
			}
		});
	}
}
