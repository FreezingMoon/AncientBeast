// Landscape orientation lock for mobile devices (#2711)

function lockLandscapeOrientation() {
    // Check if screen orientation API is supported
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(err => {
            console.log('Orientation lock failed:', err);
        });
    }
    
    // For iOS Safari
    if (window.orientation !== undefined) {
        // iOS doesn't support orientation lock, but we can warn users
        if (Math.abs(window.orientation) !== 90) {
            console.log('Please rotate your device to landscape mode for best experience');
        }
    }
}

function unlockOrientation() {
    if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
    }
}

// Auto-lock on game start
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        // Only lock on mobile devices
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            lockLandscapeOrientation();
        }
    });
}

export { lockLandscapeOrientation, unlockOrientation };
