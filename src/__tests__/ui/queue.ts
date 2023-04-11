import { Queue } from '../../ui/queue';
import { expect, describe, test } from '@jest/globals';

describe('Queue', () => {
	test('empties the HTML element argument', () => {
		const div = document.createElement('div');
		div.innerHTML = '<a>Hello</a>';
		expect(div.innerHTML).toBe('<a>Hello</a>');

		const queue = new Queue(div);
		expect(queue).toBeDefined();
		expect(div.innerHTML).toBe('');
	});
});
