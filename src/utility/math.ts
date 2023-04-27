export function clamp(value: number, min: number, max: number) {
	min = isNaN(min) ? Number.NEGATIVE_INFINITY : min;
	max = isNaN(max) ? Number.POSITIVE_INFINITY : max;
	if (min > max) {
		[min, max] = [max, min];
	}
	return Math.max(Math.min(value, max), min);
}
