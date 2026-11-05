/* eslint-disable @typescript-eslint/no-explicit-any */
import * as version from './version';
import { throttle } from 'underscore';

const SEPARATOR = '||';

export class SerializableLog {
	actions: any[];
	version: string;
	date: Date;
	custom: Record<string, any>;

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

/**
 * Identifies the creature that performed a logged action.
 *
 * Replaying a saved log has to apply each action to the creature that
 * originally performed it, but the turn hand-off that follows a move or an
 * ability is asynchronous, so once the replay is running `game.activeCreature`
 * is not guaranteed to be that creature yet. Stamping the performer on every
 * entry lets the replay wait for the right turn instead of guessing.
 */
export type LogPerformer = {
	/** Creature id, only unique for the match the log was recorded in. */
	id: number;
	/** Unit name, e.g. "Gumble". */
	name: string;
	/** Owning player id (0-3). */
	player: number;
};

export type ReplayMode = 'play' | 'load';

export class GameLog {
	onSave: (log: SerializableLog) => void;
	onLoad: (log: SerializableLog, mode: ReplayMode) => void;
	/**
	 * Fallback performer source used when {@link add} is called without one.
	 * Games wire this to `activeCreature`; abilities pass their own creature
	 * explicitly because they are not always the active one.
	 */
	getActivePerformer?: () => LogPerformer | null;
	actions: any[];

	/**
	 * True when this log was populated by `load()` (i.e. the match is a replay),
	 * false when it was built up organically via `add()` during a freshly played
	 * match, or cleared by `reset()`.
	 *
	 * Used by the `beforeunload` handler to avoid overwriting a clean stored
	 * match log with a replay's (potentially modified) log — which can include
	 * extra actions appended during live play after the replay finishes and
	 * would prevent the same match from being replayed again.
	 */
	loadedFromLog = false;

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	constructor(
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		onSave = (_log: SerializableLog) => {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		onLoad = (_log: SerializableLog, _mode: ReplayMode) => {},
		getActivePerformer?: () => LogPerformer | null,
	) {
		this.onSave = onSave;
		this.onLoad = onLoad;
		this.getActivePerformer = getActivePerformer;
		this.actions = [];
	}

	reset() {
		this.actions = [];
		this.loadedFromLog = false;
	}

	/**
	 * @param performer Creature performing the action. Defaults to the
	 *        `getActivePerformer` source given to the constructor. Existing
	 *        callers that pass a pre-built record (e.g. a move) are left alone
	 *        so the stamped value always reflects the real performer.
	 */
	add(action: any, performer?: LogPerformer | null) {
		const resolved = performer ?? this.getActivePerformer?.() ?? null;

		if (resolved && !action.performer) {
			action.performer = resolved;
		}

		this.actions.push(action);
	}

	private read(logOrStr: string | SerializableLog, mode: ReplayMode) {
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
		this.loadedFromLog = true;
		this.onLoad(log, mode);
		return log;
	}

	/** Load a log directly to its final match state. */
	load(logOrStr: string | SerializableLog) {
		return this.read(logOrStr, 'load');
	}

	/** Play a log with the normal match animations and pacing. */
	play(logOrStr: string | SerializableLog) {
		return this.read(logOrStr, 'play');
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

const throttledSaveFile = throttle(
	(data: string, filename: string) => saveFile(data, filename),
	1000,
);

const saveFile = (data: string, fileName: string) => {
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

function getYearMonthDayStr() {
	return new Date().toISOString().slice(0, 10);
}
