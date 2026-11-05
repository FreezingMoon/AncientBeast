---
applyTo: "**/*.{ts,js,tsx,jsx}"
---

# Phaser 4 instructions for Ancient Beast

This project uses Phaser 4 and should be treated as a browser game project rather than a generic TypeScript app.

- Prefer Phaser 4 scene, game object, and animation APIs already used in this codebase.
- Keep rendering concerns separated from core turn-based game logic.
- Preserve asset loading, scene creation, and lifecycle patterns that align with this repo.
- When modifying gameplay, consider both simulation logic and visual presentation.
- Keep edits compatible with Vite and the repository’s Jest setup.
- Do not rewrite the project around React, a different engine, or a new framework unless explicitly requested.
