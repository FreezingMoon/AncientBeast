export class Signal {
	private listeners: Array<{
		fn: (...args: unknown[]) => void;
		context: unknown;
		once: boolean;
	}> = [];

	add(fn: (...args: unknown[]) => void, context?: unknown): void {
		this.listeners.push({ fn, context, once: false });
	}

	addOnce(fn: (...args: unknown[]) => void, context?: unknown): void {
		this.listeners.push({ fn, context, once: true });
	}

	remove(fn: (...args: unknown[]) => void, context?: unknown): void {
		this.listeners = this.listeners.filter(
			(l): boolean => l.fn !== fn || (context && l.context !== context),
		);
	}

	removeAll(): void {
		this.listeners = [];
	}

	dispatch(...args: unknown[]): void {
		const toRemove: number[] = [];
		this.listeners.forEach((listener, index) => {
			listener.fn.apply(listener.context, args);
			if (listener.once) toRemove.push(index);
		});
		for (let i = toRemove.length - 1; i >= 0; i--) {
			this.listeners.splice(toRemove[i], 1);
		}
	}

	get numListeners(): number {
		return this.listeners.length;
	}
}
