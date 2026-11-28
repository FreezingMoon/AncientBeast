/**
 * Interface elements that react to hovering: ability buttons and the side
 * buttons show their tooltips, queue avatars point at their unit.
 */
const HOVERABLE = '#abilities .ability, #rightpanel .button, #leftpanel .button, #queue .vignette';

const fire = (element: Element, type: string, related: Element | null) =>
	element.dispatchEvent(
		new MouseEvent(type, {
			// mouseenter/mouseleave don't bubble, mouseover/mouseout do (jQuery's
			// mouseenter handlers are built on the latter)
			bubbles: type === 'mouseover' || type === 'mouseout',
			cancelable: true,
			view: window,
			relatedTarget: related,
		}),
	);

/**
 * Update touch while sliding a finger (#1527): on touch screens, dragging a
 * finger across the side and top interface hovers whatever is under it, the
 * same way a mouse would, so tooltips and units can be browsed in one slide.
 * Lifting the finger leaves the last element.
 */
export function installTouchSlideHover() {
	let current: Element | null = null;

	const hover = (next: Element | null) => {
		if (next === current) {
			return;
		}
		if (current) {
			fire(current, 'mouseout', next);
			fire(current, 'mouseleave', next);
		}
		const previous = current;
		current = next;
		if (next) {
			fire(next, 'mouseover', previous);
			fire(next, 'mouseenter', previous);
		}
	};

	document.addEventListener(
		'touchmove',
		(event) => {
			const touch = event.touches[0];
			if (!touch) {
				return;
			}
			const element = document.elementFromPoint(touch.clientX, touch.clientY);
			hover(element?.closest(HOVERABLE) ?? null);
		},
		{ passive: true },
	);
	document.addEventListener('touchend', () => hover(null), { passive: true });
	document.addEventListener('touchcancel', () => hover(null), { passive: true });
}
