const CONST = {
	animationDuration: 250,
	animationEasing: 'ease-in-out',
};

export class QuickInfo {
	private el: HTMLElement;
	private vignetteEl: HTMLElement;
	private vignetteHash: string;

	constructor(quickInfoElement: HTMLElement) {
		this.el = quickInfoElement;
		this.el.innerHTML = '';

		this.vignetteEl = document.createElement('div');
		this.el.appendChild(this.vignetteEl);
	}

	set(str: string) {
		if (this.vignetteHash !== str) {
			this.clear();
			this.vignetteHash = str;

			const div = document.createElement('div');
			div.innerHTML = str;
			this.vignetteEl.innerHTML = '';
			this.vignetteEl.appendChild(div);
			div.style.position = 'relative';
			div.animate([{ right: '-100px' }, { right: '0px' }], {
				easing: CONST.animationEasing,
				duration: CONST.animationDuration,
			});
		}
	}

	private clear() {
		if (this.vignetteHash !== '') {
			this.vignetteHash = '';

			const div = document.createElement('div');
			div.append(this.vignetteEl.firstChild);
			this.vignetteEl.innerHTML = '';

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
