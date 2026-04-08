import * as version from './version';
import { throttle } from 'underscore';

const SEPARATOR = '||';
let pendingLogFileRead: Promise<string> | null = null;

export class ConcurrentLogFilePickerError extends Error {
	constructor() {
		super('A log file picker is already open.');
		this.name = 'ConcurrentLogFilePickerError';
	}
}

export class LogFileSelectionCancelledError extends Error {
	constructor() {
		super('No log file selected.');
		this.name = 'LogFileSelectionCancelledError';
	}
}

export class SerializableLog {
	actions: any[];
	version: string;
	date: Date;
	custom: any;

	constructor(actions) {
		this.actions = actions;
		this.version = version.full;
		this.date = new Date();
		this.custom = {};
	}

	stringify() {
		// TODO:
		// The `replacer` in `JSON.stringify` was added as a bugfix for #2323
		// Some abilities have a circular reference that can't be stringified - `sourceCreature`.
		// The fix doesn't really fit here, but it's currently the only place where it
		// doesn't cause an error to be thrown and doesn't break game playback.
		// The replacer should really be factored into individual abilities, to
		// allow them to be serialized.
		// Note that several options exist to serialize circular references, but
		// when added here, they result in serialized strings larger than 100 MB.
		const json = JSON.stringify(this, (key, value) => (key === 'sourceCreature' ? {} : value));
		const prefix = `Ancient Beast ${version.full} GameLog | Generated on ${getYearMonthDayStr()} `;
		return prefix + SEPARATOR + window.btoa(json);
	}

	static from(str: string) {
		const logStr = str.split(SEPARATOR)[1];
		const log = JSON.parse(window.atob(logStr));
		const sl = new SerializableLog(log.actions);
		sl.actions = log.actions;
		sl.date = new Date(log.date);
		sl.version = log.version;
		sl.custom = log.custom;
		return sl;
	}
}

export class GameLog {
	onSave: (log: SerializableLog) => void;
	onLoad: (log: SerializableLog) => void;
	actions: any[];

	constructor(onSave = (log: SerializableLog) => {}, onLoad = (log: SerializableLog) => {}) {
		this.onSave = onSave;
		this.onLoad = onLoad;
		this.actions = [];
	}

	reset() {
		this.actions = [];
	}

	add(action: any) {
		this.actions.push(action);
	}

	load(logOrStr: string | SerializableLog) {
		let log: SerializableLog;

		if (typeof logOrStr === 'string') {
			try {
				log = SerializableLog.from(logOrStr);
			} catch (e) {
				console.error('Could not load log.\n', e);
				alert('Could not load log. See console for error details.');
				return;
			}
		} else {
			log = logOrStr;
		}

		if (!version.equals(log.version)) {
			alert(
				`Attempting to load log with version ${log.version}. The game version is ${version.full}.`,
			);
		}

		this.actions = [...log.actions];
		this.onLoad(log);
		return log;
	}

	stringify() {
		const serializeableLog = new SerializableLog(this.actions);
		this.onSave(serializeableLog);
		return serializeableLog.stringify();
	}

	save() {
		const data = this.stringify();
		const fileName = `AB-${version.major_minor}_${getYearMonthDayStr()}.ab`;
		throttledSaveFile(data, fileName);
	}
}

const throttledSaveFile = throttle((data: any, filename: string) => saveFile(data, filename), 1000);

const saveFile = (data: any, fileName: string) => {
	// Set a trap to block consecutive calls within one second
	const a = document.createElement('a');
	const file = new Blob([data]);
	const url = URL.createObjectURL(file);
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}, 1000);
};

export function readLogFromFile() {
	if (pendingLogFileRead !== null) {
		return Promise.reject(new ConcurrentLogFilePickerError());
	}

	pendingLogFileRead = new Promise((resolve, reject) => {
		const fileInput = document.createElement('input') as HTMLInputElement;
		let settled = false;

		const finish = (callback: () => void) => {
			if (settled) {
				return;
			}

			settled = true;
			window.removeEventListener('focus', onWindowFocus, true);
			pendingLogFileRead = null;
			callback();
		};

		const onWindowFocus = () => {
			window.setTimeout(() => {
				if (settled || fileInput.files?.length) {
					return;
				}

				finish(() => reject(new LogFileSelectionCancelledError()));
			}, 0);
		};

		fileInput.accept = '.ab';
		fileInput.type = 'file';

		fileInput.onchange = (event) => {
			const file = (event.target as HTMLInputElement).files?.[0];

			if (!file) {
				finish(() => reject(new LogFileSelectionCancelledError()));
				return;
			}

			const reader = new FileReader();
			reader.onload = () => {
				finish(() => resolve(reader.result as string));
			};

			reader.onerror = () => {
				finish(() => reject(reader.error ?? new Error('Could not read log file.')));
			};

			reader.readAsText(file);
		};

		window.addEventListener('focus', onWindowFocus, true);
		fileInput.click();
	});

	return pendingLogFileRead;
}

function getYearMonthDayStr() {
	return new Date().toISOString().slice(0, 10);
}
