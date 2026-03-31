// Quick fix for hexagon coordinate view tweaks (#2250)
// This is a placeholder fix - actual implementation would modify coordinate display

// Add to hex.ts or interface.ts
function updateCoordinateView() {
    // Improve hexagon coordinate visibility
    const coords = document.querySelectorAll('.hex-coordinates');
    coords.forEach(coord => {
        coord.style.fontSize = '12px';
        coord.style.fontWeight = 'bold';
        coord.style.color = '#fff';
        coord.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    });
}
