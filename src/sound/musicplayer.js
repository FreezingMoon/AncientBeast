import * as $j from 'jquery';
import skin from './skin';
export class MusicPlayer {
	constructor() {
		this.audio = skin;
		this.playlist = $j('#playlist');
		this.tracks = this.playlist.find('li.epic');

		this.repeat = true;
		this.shuffle = true;

		this.audio.volume = 0.25;
		this.audio.pause();

		$j('#mp_shuffle')
			.addClass('active')
			.on('click', (e) => {
				$j(e.currentTarget).toggleClass('active');
				this.shuffle = !this.shuffle;
			});

		$j('#genre-epic').addClass('active-text');
		this.playlist.find('li').not('.epic').addClass('hidden');

		$j('.musicgenres__title').on('click', (e) => {
			e.preventDefault();

			const clickedGenre = $j(e.target);
			clickedGenre.toggleClass('active-text');

			if (!clickedGenre.hasClass('active-text')) {
				const clickedGenreClass = e.target.innerText;
				const unusedTracks = this.playlist.find(`li.${clickedGenreClass}`);
				unusedTracks.addClass('hidden');
			}

			const activeGenres = clickedGenre.parent().find('.active-text');
			const allGenres = clickedGenre.parent().find('.musicgenres__title'); // This will fetch all the genres

			const activeGenresSelectors = Array.prototype.map.call(
				activeGenres.length === 0 ? allGenres : activeGenres, // Here if no genre is active then all genres shall pass
				(genreNode) => `li.${genreNode.innerText}`,
			);
			const allGenresSelectors = Array.prototype.map.call(
				allGenres,
				(genreNode) => `li.${genreNode.innerText}`,
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
			// Check if tracks list exists, and if it does, play random or next track based on whether shuffle is on or not, else stop playback
			if (this.tracks) {
				if (this.shuffle) {
					this.playRandom();
				} else {
					this.playNext();
				}
			} else {
				this.stopMusic();
			}
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
