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

		test('load and play communicate distinct replay modes', () => {
			const onLoad = jest.fn();
			const gl = new GameLog(() => undefined, onLoad);
			const str = gl.stringify();

			gl.load(str);
			gl.play(str);

			expect(onLoad.mock.calls[0][1]).toBe('load');
			expect(onLoad.mock.calls[1][1]).toBe('play');
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

		test('loadedFromLog is false by default on a new GameLog', () => {
			const gl = new GameLog();
			expect(gl.loadedFromLog).toBe(false);
		});

		test('loadedFromLog is true after gamelog.load(str)', () => {
			const gl = new GameLog();
			const str = gl.stringify();
			expect(gl.loadedFromLog).toBe(false);
			gl.load(str);
			expect(gl.loadedFromLog).toBe(true);
		});

		test('loadedFromLog is false after gamelog.reset()', () => {
			const gl = new GameLog();
			const str = gl.stringify();
			gl.load(str);
			expect(gl.loadedFromLog).toBe(true);
			gl.reset();
			expect(gl.loadedFromLog).toBe(false);
		});
	});

	describe('performer stamping', () => {
		const performer = { id: 2, name: 'Gumble', player: 1 };

		test('add(action, performer) stamps the performer onto the action', () => {
			const gl = new GameLog();
			gl.add({ action: 'skip' }, performer);
			expect(gl.actions[0].performer).toEqual(performer);
		});

		test('add(action) falls back to the configured performer source', () => {
			const current: typeof performer | null = performer;
			const gl = new GameLog(
				() => undefined,
				() => undefined,
				() => current,
			);
			gl.add({ action: 'move' });
			expect(gl.actions[0].performer).toEqual(performer);
		});

		test('add(action) leaves actions alone when no performer source is configured', () => {
			const gl = new GameLog();
			gl.add({ action: 'move' });
			expect(gl.actions[0].performer).toBeUndefined();
		});

		test('add(action, performer) does not overwrite an existing performer', () => {
			const gl = new GameLog(
				() => undefined,
				() => undefined,
				() => ({ id: 9, name: 'Other', player: 0 }),
			);
			gl.add({ action: 'skip', performer });
			expect(gl.actions[0].performer).toEqual(performer);
		});

		test('explicitly passed null performer still consults the source', () => {
			let current: typeof performer | null = null;
			const gl = new GameLog(
				() => undefined,
				() => undefined,
				() => current,
			);
			gl.add({ action: 'skip' }, null);
			expect(gl.actions[0].performer).toBeUndefined();
			current = performer;
			gl.add({ action: 'skip' }, null);
			expect(gl.actions[1].performer).toEqual(performer);
		});

		test('performers survive stringify/load', () => {
			const gl = new GameLog();
			gl.add({ action: 'skip' }, performer);
			const log = gl.load(gl.stringify());
			expect(log.actions[0].performer).toEqual(performer);
		});
	});
});
