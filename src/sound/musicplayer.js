import * as $j from 'jquery';
import skin from './skin';
import beastAudioFile from 'assets/sounds/AncientBeast.ogg';

export class MusicPlayer {
	constructor() {
		this.audio = skin;
		this.playlist = $j('#playlist');
		this.tracks = this.playlist.find('li.epic');

		this.repeat = true;

		this.audio.volume = 0.25;
		this.audio.pause();

		this.beastAudio = new Audio(beastAudioFile);

		$j('#genre-epic').addClass('active-text');
		this.playlist.find('li').not('.epic').addClass('hidden');

		$j('.musicgenres__title').on('click', (e) => {
			e.preventDefault();

			const clickedGenre = $j(e.target);
			clickedGenre.toggleClass('active-text');

			if (!clickedGenre.hasClass('active-text')) {
				// The inner text is capitalized but the class name is not (e.g Epic vs epic).
				// We must use toLowerCase so that it works correctly.
				const clickedGenreClass = e.target.innerText.toLowerCase();
				const unusedTracks = this.playlist.find(`li.${clickedGenreClass}`);
				unusedTracks.addClass('hidden');
			}

			const activeGenres = clickedGenre.parent().find('.active-text');
			const allGenres = clickedGenre.parent().find('.musicgenres__title'); // This will fetch all the genres

			const activeGenresSelectors = Array.prototype.map.call(
				activeGenres.length === 0 ? allGenres : activeGenres, // Here if no genre is active then all genres shall pass
				(genreNode) => `li.${genreNode.innerText.toLowerCase()}`,
			);
			const allGenresSelectors = Array.prototype.map.call(
				allGenres,
				(genreNode) => `li.${genreNode.innerText.toLowerCase()}`,
			);
			const activeTracks = this.playlist.find(activeGenresSelectors.join());
			const allTracks = this.playlist.find(allGenresSelectors.join()); // This will fetch all the tracks

			allTracks.addClass('hidden'); // First we will hide all the tracks and then
			activeTracks.removeClass('hidden'); // Make the active ones visible
		});

		this.playlist.find('li').on('click', (e) => {
			e.preventDefault();
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

		$j('.audio-player-beast').on('click', (e) => {
			// Perform on beast click
			this.beastAudio.play();
		});
	}

	getCurrentTrackIndex() {
		return Array.prototype.findIndex.call(this.tracks, (track) =>
			track.classList.contains('active-text'),
		);
	}

	playRandom() {
		const currentTrackIndex = this.getCurrentTrackIndex();
		// Check if any genre is active
		const genreExists = $j('.musicgenres__items').children().hasClass('active-text');
		// If a genre is active, get a random track and play it, else stop audio
		if (genreExists) {
			let rand;

			do {
				rand = Math.floor(Math.random() * (this.tracks.length - 1));
			} while (rand === currentTrackIndex); // Don't play the same track twice in a row

			const track = this.tracks[rand];

			this.run($j(track));
		} else {
			this.stopMusic();
		}
	}

	playNext() {
		const currentTrackIndex = this.getCurrentTrackIndex();
		const nextTrackIndex = currentTrackIndex + 1;
		const isNextTrackExists = this.tracks[nextTrackIndex];
		const shouldRepeat = !isNextTrackExists && this.repeat;

		const track = shouldRepeat ? this.tracks[0] : this.tracks[nextTrackIndex];

		this.run($j(track));
	}

	run(track) {
		// Style the active track in the playlist
		const link = track.find('a');

		track.addClass('active-text').siblings().removeClass('active-text');
		this.audio.src = link.attr('href');
		this.audio.load();
		this.audio.play();
	}

	stopMusic() {
		this.audio.pause();
	}
}
