/**
 * Quadratic Curve Class
 *
 * Used to define a quadratic curve of the form y = ax^2 + bx + c
 */
export class QuadraticCurve {
	a: number;
	b: number;
	c: number;

	/**
	 * @constructor
	 * @param{number} a - Coefficient of the second order term
	 * @param{number} b - Coefficient of the first order term
	 * @param{number} c - Intercept of the curve
	 */
	constructor(a: number, b: number, c: number) {
		this.a = a;
		this.b = b;
		this.c = c;
	}

	/**
	 * Calculates the resulting y value given x
	 * @param{number} x - the x value to use for calculation
	 * @returns{number} y - the resulting y value
	 */
	calc_y(x: number): number {
		return this.a * Math.pow(x, 2) + this.b * x + this.c;
	}
}
