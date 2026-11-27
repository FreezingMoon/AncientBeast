/** Largest tilt of the unit card, in degrees, when the pointer is at an edge. */
const MAX_TILT_DEG = 8;
/** Largest shift of the artwork behind the card's margin, in pixels. */
const MAX_ART_SHIFT_PX = 10;
/** Device tilt, in degrees, that maps to a full card tilt on mobiles. */
const DEVICE_TILT_RANGE_DEG = 30;

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/**
 * Parallax for the unit cards in the dash (#1592): the card tilts towards the
 * pointer while the unit artwork drifts the other way behind the card margin,
 * giving it some depth. On mobiles, tilting the device does the same.
 *
 * Only CSS variables are set here (`--card-tilt-x/y`, `--card-art-x/y`); the
 * transforms live in the stylesheet, so the card flip animation is untouched.
 */
export function installCardParallax(card: HTMLElement | undefined) {
	if (!card) {
		return;
	}

	// x and y are the pointer position on the card, from -1 to 1 on each axis
	const apply = (x: number, y: number) => {
		card.style.setProperty('--card-tilt-x', `${(-y * MAX_TILT_DEG).toFixed(2)}deg`);
		card.style.setProperty('--card-tilt-y', `${(x * MAX_TILT_DEG).toFixed(2)}deg`);
		card.style.setProperty('--card-art-x', `${(-x * MAX_ART_SHIFT_PX).toFixed(1)}px`);
		card.style.setProperty('--card-art-y', `${(-y * MAX_ART_SHIFT_PX).toFixed(1)}px`);
	};

	card.addEventListener('pointermove', (event) => {
		if (event.pointerType === 'touch') {
			return;
		}
		const rect = card.getBoundingClientRect();
		if (!rect.width || !rect.height) {
			return;
		}
		apply(
			clamp(((event.clientX - rect.left) / rect.width) * 2 - 1),
			clamp(((event.clientY - rect.top) / rect.height) * 2 - 1),
		);
	});
	card.addEventListener('pointerleave', () => apply(0, 0));

	window.addEventListener('deviceorientation', (event) => {
		if (event.gamma === null || event.beta === null || !card.offsetParent) {
			return;
		}
		// Holding the device at about 45 degrees is the resting position
		apply(
			clamp(event.gamma / DEVICE_TILT_RANGE_DEG),
			clamp((event.beta - 45) / DEVICE_TILT_RANGE_DEG),
		);
	});

	apply(0, 0);
}
