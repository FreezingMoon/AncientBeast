import * as $j from 'jquery';

export class MusicPlayer {
	constructor() {
		this.audio = $j('#audio-player')[0];
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

		$j('#genre-epic').addClass('active');
		this.playlist.find('li').not('.epic').addClass('hidden');

		$j('.musicgenres__title').on('click', (e) => {
			e.preventDefault();

			const clickedGenre = $j(e.target);
			clickedGenre.toggleClass('active');

			if (!clickedGenre.hasClass('active')) {
				const clickedGenreClass = e.target.innerText;
				const unusedTracks = this.playlist.find(`li.${clickedGenreClass}`);
				unusedTracks.addClass('hidden');
			}

			const activeGenres = clickedGenre.parent().find('.active');
			const activeGenresSelectors = Array.prototype.map.call(
				activeGenres,
				(genreNode) => `li.${genreNode.innerText}`,
			);

			this.tracks = this.playlist.find(activeGenresSelectors.join());
			this.tracks.removeClass('hidden');
		});

		this.playlist.find('li').on('click', (e) => {
			e.preventDefault();
			this.run($j(e.currentTarget));
		});

		this.audio.addEventListener('ended', () => {
			if (this.shuffle) {
				this.playRandom();
			} else {
				this.playNext();
			}
		});
	}

	getCurrentTrackIndex() {
		return Array.prototype.findIndex.call(this.tracks, (track) =>
			track.classList.contains('active'),
		);
	}

	playRandom() {
		const currentTrackIndex = this.getCurrentTrackIndex();
		let rand;

		do {
			rand = Math.floor(Math.random() * (this.tracks.length - 1));
		} while (rand === currentTrackIndex); // Don't play the same track twice in a row

		const track = this.tracks[rand];

		this.run($j(track));
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

		track.addClass('active').siblings().removeClass('active');
		this.audio.src = link.attr('href');
		this.audio.load();
		this.audio.play();
	}

	stopMusic() {
		this.audio.pause();
	}
}
