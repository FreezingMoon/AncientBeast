// Make JQuery globally available for ESLint and TypeScript
declare global {
	// eslint-disable-next-line no-unused-vars
	interface JQuery<T = HTMLElement> extends $j.fn.init {}
}
interface Window {
	// Global debugging object added to `window.AB`.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	AB: any;
}
