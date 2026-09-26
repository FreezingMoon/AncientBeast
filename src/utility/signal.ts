export class Signal {
	private listeners: Array<{ fn: (...args: any[]) => void; context: any; once: boolean }> = [];

	add(fn: (...args: any[]) => void, context?: any): void {
		this.listeners.push({ fn, context, once: false });
	}

	addOnce(fn: (...args: any[]) => void, context?: any): void {
		this.listeners.push({ fn, context, once: true });
	}

	remove(fn: (...args: any[]) => void, context?: any): void {
		this.listeners = this.listeners.filter(
			(l): boolean => l.fn !== fn || (context && l.context !== context),
		);
	}

	removeAll(): void {
		this.listeners = [];
	}

	dispatch(...args: any[]): void {
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
