export interface FrontEndI {
	load(): void;
	unload(): void;
	update(dt: Number): void;
	render(dt: Number): void;
}
