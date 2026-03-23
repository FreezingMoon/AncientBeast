const audioPlayer = document.querySelector('.audio-player-skin');
const skin = new Audio();

// Show total duration when audio data is loaded
skin.addEventListener(
	'loadeddata',
	() => {
		if (audioPlayer) {
			const lengthElement = audioPlayer.querySelector('.time .length');
			if (lengthElement) {
				lengthElement.textContent = getTimeCodeFromNum(skin.duration);
			}
		}
	},
	false,
);

// Click event for scrubbing
if (audioPlayer) {
	const timeline = audioPlayer.querySelector('.timeline-control');
	if (timeline) {
		timeline.addEventListener(
			'click',
			(e: PointerEvent) => {
				const timelineWidth = window.getComputedStyle(timeline).width;
				const timeToSeek = (e.offsetX / parseInt(timelineWidth)) * skin.duration;
				skin.currentTime = timeToSeek;
			},
			false,
		);
	}

	const playBtn = audioPlayer.querySelector('.controls .toggle-play');
	if (playBtn) {
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
	}
}

// Song progress bar
setInterval(() => {
	if (audioPlayer) {
		const progressBar = audioPlayer.querySelector('.progress-music') as HTMLElement;
		if (progressBar) {
			progressBar.style.width = (skin.currentTime / skin.duration) * 100 + '%';
		}
		const currentTime = audioPlayer.querySelector('.time .current');
		if (currentTime) {
			currentTime.textContent = getTimeCodeFromNum(skin.currentTime);
		}
	}
}, 500);

function getTimeCodeFromNum(num: number) {
	let seconds = Math.trunc(num);
	let minutes = Math.trunc(seconds / 60);
	seconds -= minutes * 60;
	const hours = Math.trunc(minutes / 60);
	minutes -= hours * 60;

	if (hours === 0) return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
	return `${String(hours).padStart(2, '0')}:${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export default skin;
