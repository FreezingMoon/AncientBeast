import { jest, expect, describe, test } from '@jest/globals';
import { full } from '../../utility/version';
import { GameLog } from '../../utility/gamelog';

describe('GameLog', () => {
	describe('new GameLog(onSave, onLoad)', () => {
		test('onSave is called when log is stringified', () => {
			const onSave = jest.fn();
			const gl = new GameLog(onSave);
			expect(onSave).toBeCalledTimes(0);
			gl.stringify();
			expect(onSave).toBeCalledTimes(1);
			gl.stringify();
			expect(onSave).toBeCalledTimes(2);
		});

		test('onLoad is called when log is loaded', () => {
			const onLoad = jest.fn();
			const gl = new GameLog(() => undefined, onLoad);
			const str = gl.stringify();
			expect(onLoad).toBeCalledTimes(0);
			gl.load(str);
			expect(onLoad).toBeCalledTimes(1);
			gl.load(str);
			expect(onLoad).toBeCalledTimes(2);
		});

		test('custom data saved onSave can be retrieved onLoad', () => {
			let a = -1;
			let b = -1;
			const gl = new GameLog(
				(log) => {
					log.custom.a = 1;
					log.custom.b = 2;
				},
				(log) => {
					a = log.custom.a;
					b = log.custom.b;
				},
			);
			const str = gl.stringify();
			const log = gl.load(str);
			expect(log.custom.a).toBe(1);
			expect(log.custom.b).toBe(2);
			expect(a).toBe(1);
			expect(b).toBe(2);
		});

		test('gamelog.add(action) actions can be retrieved', () => {
			const gl = new GameLog();
			gl.add('action1');
			gl.add(['action2']);
			const str = gl.stringify();
			const log = gl.load(str);
			expect(log.actions[0]).toBe('action1');
			expect(log.actions[1][0]).toBe('action2');
		});

		test('gamelog.load(str) returns an object with current game version', () => {
			const gl = new GameLog();
			const str = gl.stringify();
			const log = gl.load(str);
			expect(log.version).toBe(full);
		});

		test('gamelog.load(str) returns an object with the log Date()', () => {
			const gl = new GameLog();
			const str = gl.stringify();
			const date = new Date();
			const log = gl.load(str);
			const diffSeconds = Math.abs(date.getTime() / 1000 - log.date.getTime() / 1000);
			expect(diffSeconds).toBeLessThan(10);
		});
	});
});
