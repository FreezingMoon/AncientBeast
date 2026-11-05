import skin from './skin';
import beastAudioFile from 'assets/sounds/AncientBeast.ogg';

interface JQueryEventObject {
	preventDefault(): void;
	stopPropagation(): void;
	target: HTMLElement;
	currentTarget: HTMLElement;
}

interface JQuery<T = HTMLElement> extends ArrayLike<T> {
	addClass(className: string): this;
	removeClass(className?: string): this;
	toggleClass(className: string, state?: boolean): this;
	hasClass(className: string): boolean;
	find(selector: string): JQuery<HTMLElement>;
	parent(): JQuery<HTMLElement>;
	children(): JQuery<HTMLElement>;
	attr(name: string): string | undefined;
	text(): string;
	off(event: string): this;
	on(event: string, handler: (e: JQueryEventObject) => void): this;
	not(selector: string): JQuery<HTMLElement>;
	length: number;
	[index: number]: T;
}

interface JQueryStatic {
	(selector: string | HTMLElement | JQuery<HTMLElement>): JQuery<HTMLElement>;
}

import $j from 'jquery';

export class MusicPlayer {
	audio: HTMLAudioElement;
	playlist: JQuery<HTMLElement>;
	tracks: JQuery<HTMLElement>;
	repeat: boolean;
	beastAudio: HTMLAudioElement;
	currentlyPlaying?: JQuery<HTMLElement>;

	constructor() {
		this.audio = skin as unknown as HTMLAudioElement;
		this.playlist = $j('#playlist');
		this.tracks = this.playlist.find('li.epic');

		this.repeat = true;

		this.audio.volume = 0.25;
		this.audio.pause();

		this.beastAudio = new Audio(beastAudioFile);

		$j('#genre-epic').addClass('active-text');
		this.playlist.find('li').not('.epic').addClass('hidden');

		// Debug genre selection
		$j('.musicgenres__title')
			.off('click')
			.on('click', (e: JQuery.ClickEvent) => {
				e.preventDefault();
				e.stopPropagation();

				const clickedGenre = $j(e.target);
				clickedGenre.toggleClass('active-text');

				if (!clickedGenre.hasClass('active-text')) {
					// The inner text is capitalized but the class name is not (e.g Epic vs epic).
					// We must use toLowerCase so that it works correctly.
					const clickedGenreClass = (e.target as HTMLElement).innerText.toLowerCase();
					const unusedTracks = this.playlist.find(`li.${clickedGenreClass}`);
					unusedTracks.addClass('hidden');
				}

				const activeGenres = clickedGenre.parent().find('.active-text');
				const allGenres = clickedGenre.parent().find('.musicgenres__title'); // This will fetch all the genres

				const activeGenresSelectors = Array.prototype.map.call(
					activeGenres.length === 0 ? allGenres : activeGenres, // Here if no genre is active then all genres shall pass
					(genreNode: HTMLElement) => `li.${genreNode.innerText.toLowerCase()}`,
				);
				const allGenresSelectors = Array.prototype.map.call(
					allGenres,
					(genreNode: HTMLElement) => `li.${genreNode.innerText.toLowerCase()}`,
				);
				const activeTracks = this.playlist.find(activeGenresSelectors.join());
				const allTracks = this.playlist.find(allGenresSelectors.join()); // This will fetch all the tracks

				allTracks.addClass('hidden'); // First we will hide all the tracks and then
				activeTracks.removeClass('hidden'); // Make the active ones visible
			});

		// Debug playlist track selection
		this.playlist
			.find('li')
			.off('click')
			.on('click', (e: JQuery.ClickEvent) => {
				e.preventDefault();
				e.stopPropagation();
				this.run($j(e.currentTarget));
			});

		this.audio.addEventListener('ended', () => {
			// Check if tracks list exists, and if it does, play random track, else stop playback
			if (this.tracks) {
				this.playRandom();
			} else {
				this.stopMusic();
			}
		});

		$j('.audio-player-beast')
			.off('click')
			.on('click', (e: JQuery.ClickEvent) => {
				e.stopPropagation();
				// Perform on beast click
				this.beastAudio.play();
			});

		// Volume sliders requested
		$j('#vol')
			.off('change')
			.on('change', (e: JQuery.ChangeEvent) => {
				this.audio.volume = Number((e.target as HTMLInputElement).value);
			});

		$j('#sfx')
			.off('change')
			.on('change', (e: JQuery.ChangeEvent) => {
				const game = (
					window as unknown as { game?: { soundsys?: { allEffectsMultiplier: number } } }
				).game;
				if (game && game.soundsys) {
					game.soundsys.allEffectsMultiplier = Number((e.target as HTMLInputElement).value);
				}
			});
	}

	getCurrentTrackIndex(): number {
		return Array.prototype.findIndex.call(this.tracks, (track: HTMLElement) =>
			track.classList.contains('active-text'),
		);
	}

	playRandom(): void {
		const currentTrackIndex = this.getCurrentTrackIndex();
		// Check if any genre is active
		const genreExists = $j('.musicgenres__items').children().hasClass('active-text');
		// If a genre is active, get a random track and play it, else stop audio
		if (genreExists) {
			let rand: number;

			do {
				rand = Math.floor(Math.random() * (this.tracks.length - 1));
			} while (rand === currentTrackIndex); // Don't play the same track twice in a row

			const track = this.tracks[rand];

			this.run($j(track));
		} else {
			this.stopMusic();
		}
	}

	playNext(): void {
		const currentTrackIndex = this.getCurrentTrackIndex();
		const nextTrackIndex = currentTrackIndex + 1;
		const isNextTrackExists = this.tracks[nextTrackIndex];
		const shouldRepeat = !isNextTrackExists && this.repeat;

		const track = shouldRepeat ? this.tracks[0] : this.tracks[nextTrackIndex];

		this.run($j(track));
	}

	run(track: JQuery<HTMLElement>): void {
		// Style the active track in the playlist
		const link = track.find('a');
		const nextSrc = link.attr('href');

		if (!nextSrc) {
			return;
		}

		const resolvedNextSrc = new URL(nextSrc, window.location.href).href;
		const currentSrc = this.audio.currentSrc || this.audio.src;
		if (currentSrc === resolvedNextSrc && !this.audio.paused) {
			return;
		}

		track.addClass('active-text');
		(track as any).siblings?.().removeClass('active-text');
		this.audio.src = nextSrc;
		this.audio.load();

		// Debug play button state
		const playBtn = document.querySelector('.controls .toggle-play');
		if (playBtn) {
			playBtn.classList.remove('play');
			playBtn.classList.add('pause');
		}

		// Play audio
		this.audio.play().catch((error: any) => {
			if (error?.name === 'AbortError') {
				return;
			}
			console.error('Error playing audio:', error);
		});
	}

	stopMusic(): void {
		if (this.audio && typeof this.audio.pause === 'function') {
			this.audio.pause();
		}
	}
}
