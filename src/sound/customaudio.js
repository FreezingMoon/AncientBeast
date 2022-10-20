const audioPlayer = document.querySelector('.audio-player-custom');
const audio = new Audio();

audio.addEventListener(
	'loadeddata',
	() => {
		audioPlayer.querySelector('.time .length').textContent = getTimeCodeFromNum(audio.duration);
		audio.volume = 0.75;
	},
	false,
);

const timeline = audioPlayer.querySelector('.timeline');
timeline.addEventListener(
	'click',
	(e) => {
		const timelineWidth = window.getComputedStyle(timeline).width;
		const timeToSeek = (e.offsetX / parseInt(timelineWidth)) * audio.duration;
		audio.currentTime = timeToSeek;
	},
	false,
);

const volumeSlider = audioPlayer.querySelector('.controls .volume-slider');
volumeSlider.addEventListener(
	'click',
	(e) => {
		const sliderWidth = window.getComputedStyle(volumeSlider).width;
		const newVolume = e.offsetX / parseInt(sliderWidth);
		audio.volume = newVolume;
		audioPlayer.querySelector('.controls .volume-percentage').style.width = newVolume * 100 + '%';
	},
	false,
);

setInterval(() => {
	const progressBar = audioPlayer.querySelector('.progress-music');
	progressBar.style.width = (audio.currentTime / audio.duration) * 100 + '%';
	audioPlayer.querySelector('.time .current').textContent = getTimeCodeFromNum(audio.currentTime);
}, 500);

const playBtn = audioPlayer.querySelector('.controls .toggle-play');
playBtn.addEventListener(
	'click',
	() => {
		if (audio.paused) {
			playBtn.classList.remove('play');
			playBtn.classList.add('pause');
			audio.play();
		} else {
			playBtn.classList.remove('pause');
			playBtn.classList.add('play');
			audio.pause();
		}
	},
	false,
);

audioPlayer.querySelector('.volume-button').addEventListener('click', () => {
	const volumeEl = audioPlayer.querySelector('.volume-container .volume');
	audio.muted = !audio.muted;
	if (audio.muted) {
		volumeEl.classList.remove('icono-volumeMedium');
		volumeEl.classList.add('icono-volumeMute');
	} else {
		volumeEl.classList.add('icono-volumeMedium');
		volumeEl.classList.remove('icono-volumeMute');
	}
});

function getTimeCodeFromNum(num) {
	let seconds = parseInt(num);
	let minutes = parseInt(seconds / 60);
	seconds -= minutes * 60;
	const hours = parseInt(minutes / 60);
	minutes -= hours * 60;

	if (hours === 0) return `${minutes}:${String(seconds % 60).padStart(2, 0)}`;
	return `${String(hours).padStart(2, 0)}:${minutes}:${String(seconds % 60).padStart(2, 0)}`;
}

export default audio;
