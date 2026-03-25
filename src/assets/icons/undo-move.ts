/**
 * Undo Move Icon (SVG)
 * 
 * Backward time icon for undo button.
 * Source: https://game-icons.net/1x1/delapouite/backward-time.html
 * Style: White foreground, transparent background, 4px black stroke
 */

export const undoMoveIconSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <!-- Background (transparent) -->
  <rect width="64" height="64" fill="none"/>
  
  <!-- Clock face -->
  <circle cx="32" cy="32" r="24" fill="none" stroke="white" stroke-width="3"/>
  
  <!-- Clock hands -->
  <line x1="32" y1="32" x2="32" y2="20" stroke="white" stroke-width="3" stroke-linecap="round"/>
  <line x1="32" y1="32" x2="42" y2="32" stroke="white" stroke-width="3" stroke-linecap="round"/>
  
  <!-- Counter-clockwise arrow (undo symbol) -->
  <path d="M 20 32 A 12 12 0 1 1 32 20" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" marker-end="url(#arrowhead)"/>
  
  <!-- Arrow marker -->
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="white"/>
    </marker>
  </defs>
</svg>
`;

/**
 * Create undo icon as data URL
 */
export function createUndoIconDataURL(): string {
  const svg = undoMoveIconSVG.trim();
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml,${encoded}`;
}

/**
 * Create undo icon element
 */
export function createUndoIconElement(): HTMLImageElement {
  const img = document.createElement('img');
  img.src = createUndoIconDataURL();
  img.alt = 'Undo Move';
  img.className = 'btn-icon';
  return img;
}

/**
 * Save undo icon to assets folder
 * Call this during build process
 */
export function saveUndoIconAsset(): void {
  // This would be called during build to save the SVG file
  console.log('Undo icon SVG:', undoMoveIconSVG);
}
