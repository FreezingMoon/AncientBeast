import * as jQuery from 'jquery';

export class MusicPlayer {
	constructor() {
		this.current = 0;
		this.audio = jQuery('#audio')[0];
		this.playlist = jQuery('#playlist');
		this.tracks = this.playlist.find('li a');

		this.repeat = true;
		this.shuffle = true;

		this.audio.volume = .25;
		this.audio.pause();

		jQuery('#mp_shuffle').addClass("active").click((e) => {
			jQuery(e.currentTarget).toggleClass("active");
			this.shuffle = !this.shuffle;
		});

		this.playlist.find('a').click((e) => {
			e.preventDefault();
			this.current = jQuery(e.currentTarget).parent().index();
			this.run(jQuery(e.currentTarget));
		});

		this.audio.addEventListener('ended', (e) => {
			if (this.shuffle) {
				this.playRandom();
			} else {
				this.playNext();
			}
		});
	}

	playRandom() {
		let rand;
		do {
			rand = Math.floor(Math.random() * (this.tracks.length - 1));
		} while (rand == this.current); // Don't play the same track twice in a row

		this.current = rand;
		let link = this.playlist.find('a')[this.current];
		this.run(jQuery(link));
	}

	playNext() {
		this.current++;

		if (this.current == this.tracks.length && this.repeat) {
			this.current = 0;
		}

		let link = this.playlist.find('a')[this.current];
		this.run(jQuery(link));
	}

	run(link) {
		// Style the active track in the playlist
		let par = link.parent();

		par.addClass('active').siblings().removeClass('active');
		this.audio.src = link.attr("href");
		this.audio.load();
		this.audio.play();
	}
};
