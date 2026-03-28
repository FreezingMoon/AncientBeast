import { jest, expect, describe, test } from '@jest/globals';
import { full } from '../../utility/version';
import {
	ConcurrentLogFilePickerError,
	GameLog,
	LogFileSelectionCancelledError,
	readLogFromFile,
} from '../../utility/gamelog';

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

	describe('readLogFromFile()', () => {
		test('blocks concurrent file pickers and resolves the selected log once', async () => {
			const originalCreateElement = document.createElement.bind(document);
			const fileInput = originalCreateElement('input') as HTMLInputElement;
			const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => undefined);
			const createElementSpy = jest
				.spyOn(document, 'createElement')
				.mockImplementation(((tagName: string) =>
					tagName === 'input'
						? fileInput
						: originalCreateElement(tagName)) as typeof document.createElement);

			class MockFileReader {
				result: string | ArrayBuffer | null = 'serialized-log';
				error: DOMException | null = null;
				onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
				onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

				readAsText() {
					this.onload?.({} as ProgressEvent<FileReader>);
				}
			}

			const originalFileReader = window.FileReader;
			window.FileReader = MockFileReader as typeof FileReader;

			try {
				const firstRead = readLogFromFile();
				await expect(readLogFromFile()).rejects.toBeInstanceOf(ConcurrentLogFilePickerError);
				expect(clickSpy).toHaveBeenCalledTimes(1);

				Object.defineProperty(fileInput, 'files', {
					configurable: true,
					value: [{}],
				});
				fileInput.onchange?.({ target: fileInput } as Event);

				await expect(firstRead).resolves.toBe('serialized-log');
			} finally {
				window.FileReader = originalFileReader;
				createElementSpy.mockRestore();
				clickSpy.mockRestore();
			}
		});

		test('cancelling the picker clears the guard so the next attempt can open', async () => {
			jest.useFakeTimers();

			const originalCreateElement = document.createElement.bind(document);
			const firstInput = originalCreateElement('input') as HTMLInputElement;
			const secondInput = originalCreateElement('input') as HTMLInputElement;
			const firstClickSpy = jest.spyOn(firstInput, 'click').mockImplementation(() => undefined);
			const secondClickSpy = jest.spyOn(secondInput, 'click').mockImplementation(() => undefined);
			const inputs = [firstInput, secondInput];
			const createElementSpy = jest
				.spyOn(document, 'createElement')
				.mockImplementation(((tagName: string) =>
					tagName === 'input'
						? inputs.shift() ?? originalCreateElement(tagName)
						: originalCreateElement(tagName)) as typeof document.createElement);

			try {
				const firstRead = readLogFromFile();
				window.dispatchEvent(new Event('focus'));
				jest.runAllTimers();

				await expect(firstRead).rejects.toBeInstanceOf(LogFileSelectionCancelledError);
				expect(firstClickSpy).toHaveBeenCalledTimes(1);

				const secondRead = readLogFromFile();
				expect(secondClickSpy).toHaveBeenCalledTimes(1);

				window.dispatchEvent(new Event('focus'));
				jest.runAllTimers();

				await expect(secondRead).rejects.toBeInstanceOf(LogFileSelectionCancelledError);
			} finally {
				createElementSpy.mockRestore();
				firstClickSpy.mockRestore();
				secondClickSpy.mockRestore();
				jest.useRealTimers();
			}
		});
	});
});
