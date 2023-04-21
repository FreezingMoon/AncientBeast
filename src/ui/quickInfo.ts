const CONST = {
	zIndexBase: '1',
	zIndexOverlay: '2',
	zIndexOverlayRemoval: '3',
	animationDuration: 250,
	animationEasing: 'ease-in-out',
};

export class QuickInfo {
	private el: HTMLElement;
	private baseEl: HTMLElement;
	private baseHash = '';

	private overlayEl: HTMLElement;
	private overlayHash = '';

	constructor(quickInfoElement: HTMLElement) {
		this.el = quickInfoElement;
		this.el.innerHTML = '';

		this.baseEl = document.createElement('div');
		this.baseEl.style.zIndex = CONST.zIndexBase;
		this.el.appendChild(this.baseEl);

		this.overlayEl = document.createElement('div');
		this.overlayEl.style.zIndex = CONST.zIndexOverlay;
		this.el.appendChild(this.overlayEl);
	}

	setBase(str: string) {
		this.clearOverlay();
		if (this.baseHash !== str) {
			this.baseHash = str;

			const div = document.createElement('div');
			div.innerHTML = str;
			this.baseEl.innerHTML = '';
			this.baseEl.appendChild(div);
			div.animate([{ opacity: 0 }, { opacity: 1 }], {
				easing: CONST.animationEasing,
				duration: CONST.animationDuration,
			});
		}
	}

	setOverlay(str: string) {
		if (this.overlayHash !== str) {
			this.clearOverlay();
			this.overlayHash = str;

			const div = document.createElement('div');
			div.innerHTML = str;
			this.overlayEl.innerHTML = '';
			this.overlayEl.appendChild(div);
			div.style.position = 'relative';
			div.animate([{ right: '-100px' }, { right: '0px' }], {
				easing: CONST.animationEasing,
				duration: CONST.animationDuration,
			});
		}
	}

	private clearOverlay() {
		if (this.overlayHash !== '') {
			this.overlayHash = '';

			const div = document.createElement('div');
			div.append(this.overlayEl.firstChild);
			this.overlayEl.innerHTML = '';

			div.style.zIndex = CONST.zIndexOverlayRemoval;
			div.style.position = 'relative';
			this.el.appendChild(div);
			div.animate(
				[
					{ opacity: 1, right: '0px' },
					{ opacity: 0, right: '50px' },
					{ opacity: 0, right: '100px' },
				],
				{
					easing: CONST.animationEasing,
					duration: CONST.animationDuration,
					fill: 'forwards',
				},
			);
			setTimeout(() => {
				div.remove();
			}, CONST.animationDuration);
		}
	}
}
