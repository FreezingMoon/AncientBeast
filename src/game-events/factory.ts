import { tryGetPhaser } from '../phaser/runtime';
import type Phaser from 'phaser';
import type { GameChannels, MetaPowersState, MetaPowerMessage } from './channels.types';

/**
 * A minimal `on`/`off`/`emit` bus used only when the Phaser runtime is absent.
 *
 * The channels are Phaser `EventEmitter`s, which is the point of the migration —
 * but the authoritative Devvit server still boots before Phase 7 replaces its
 * fake engine with a real `Phaser.HEADLESS` game. This stand-in keeps that path
 * running with the same call surface (`on`, `off`, `emit`) so the eventual swap
 * is a one-line change in {@link createGameChannels}.
 *
 * It is deliberately not a general-purpose emitter: no once-listeners, no
 * context binding, no wildcard — nothing in AB's channel usage needs them.
 */
class FallbackEmitter {
	private listeners = new Map<string, Array<(...args: any[]) => void>>();

	on(event: string, fn: (...args: any[]) => void): this {
		const existing = this.listeners.get(event);
		if (existing) {
			existing.push(fn);
		} else {
			this.listeners.set(event, [fn]);
		}
		return this;
	}

	off(event: string, fn?: (...args: any[]) => void): this {
		if (!fn) {
			this.listeners.delete(event);
			return this;
		}
		const remaining = (this.listeners.get(event) ?? []).filter((l) => l !== fn);
		if (remaining.length) {
			this.listeners.set(event, remaining);
		} else {
			this.listeners.delete(event);
		}
		return this;
	}

	emit(event: string, ...args: unknown[]): boolean {
		const listeners = this.listeners.get(event);
		if (!listeners?.length) {
			return false;
		}
		// Iterate a copy: a handler is allowed to unsubscribe itself, and Phaser's
		// `emit` makes the same guarantee.
		for (const fn of [...listeners]) {
			fn(...args);
		}
		return true;
	}
}

/**
 * Build the meta power message name for a state key.
 *
 * Kept as a function rather than a template literal at the dispatch site so the
 * name and the `MetaPowerMessage` union cannot drift apart.
 */
export function metaPowerMessage(key: keyof MetaPowersState): MetaPowerMessage {
	return `toggle${key.charAt(0).toUpperCase()}${key.slice(1)}` as MetaPowerMessage;
}

/**
 * Factory for the game's gameplay message channels.
 *
 * `Phaser.Events.EventEmitter` replaces Phaser 2 CE's `Signal`, and that is not a
 * like-for-like swap: `Signal` was one listener list every handler filtered by
 * message name, whereas `EventEmitter` is keyed by event name and has no
 * wildcard. Each former `switch (message)` block is therefore now a set of `on()`
 * registrations — one per message it actually handles — so Phaser does the
 * dispatch and AB carries no catch-all listener anywhere.
 */
export function createGameChannels(): GameChannels {
	const phaser = tryGetPhaser();
	const make = (): Phaser.Events.EventEmitter =>
		phaser ? new phaser.Events.EventEmitter() : (new FallbackEmitter() as never);

	return {
		ui: make(),
		metaPowers: make(),
		creature: make(),
		hex: make(),
	};
}
