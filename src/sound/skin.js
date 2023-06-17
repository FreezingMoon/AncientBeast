const audioPlayer = document.querySelector('.audio-player-skin');
const skin = new Audio();

skin.addEventListener(
	'loadeddata',
	() => {
		audioPlayer.querySelector('.time .length').textContent = getTimeCodeFromNum(skin.duration);
	},
	false,
);

const timeline = audioPlayer.querySelector('.timeline-control');
timeline.addEventListener(
	'click',
	(e) => {
		const timelineWidth = window.getComputedStyle(timeline).width;
		const timeToSeek = (e.offsetX / parseInt(timelineWidth)) * skin.duration;
		skin.currentTime = timeToSeek;
	},
	false,
);

setInterval(() => {
	const progressBar = audioPlayer.querySelector('.progress-music');
	progressBar.style.width = (skin.currentTime / skin.duration) * 100 + '%';
	audioPlayer.querySelector('.time .current').textContent = getTimeCodeFromNum(skin.currentTime);
}, 500);

const playBtn = audioPlayer.querySelector('.controls .toggle-play');
playBtn.addEventListener(
	'click',
	() => {
		if (skin.paused) {
			playBtn.classList.remove('play');
			playBtn.classList.add('pause');
			skin.play();
		} else {
			playBtn.classList.remove('pause');
			playBtn.classList.add('play');
			skin.pause();
		}
	},
	false,
);

function getTimeCodeFromNum(num) {
	let seconds = parseInt(num);
	let minutes = parseInt(seconds / 60);
	seconds -= minutes * 60;
	const hours = parseInt(minutes / 60);
	minutes -= hours * 60;

	if (hours === 0) return `${minutes}:${String(seconds % 60).padStart(2, 0)}`;
	return `${String(hours).padStart(2, 0)}:${minutes}:${String(seconds % 60).padStart(2, 0)}`;
}

export default skin;
