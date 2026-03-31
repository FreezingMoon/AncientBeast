// Fix for iPhone music playback (#2530)
// Detect iOS and handle audio context appropriately

function initAudioForiOS() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
        // iOS requires user interaction to play audio
        document.addEventListener('touchstart', function initAudio() {
            // Initialize audio context on first touch
            if (window.audioContext && window.audioContext.state === 'suspended') {
                window.audioContext.resume();
            }
            document.removeEventListener('touchstart', initAudio);
        }, { once: true });
    }
}

export { initAudioForiOS };
