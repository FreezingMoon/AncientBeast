# Ancient Beast AI guidance

This repository is a Phaser 4 strategy game built with TypeScript, Vite, and a custom HTML5 game engine.

## Project context
- Prefer Phaser 4 APIs and patterns compatible with the existing codebase.
- Keep gameplay logic under `src/` and rendering/scene concerns under `src/phaser/` or closely related modules.
- Reuse existing architecture instead of introducing framework churn.
- Preserve the project’s TypeScript and Jest-based testing conventions.

## Coding expectations
- Favor small, focused edits that match the surrounding code style.
- Prefer existing utility functions, asset-loading patterns, and scene lifecycle patterns already used in the repo.
- Avoid adding unnecessary dependencies or switching the project to another game framework.
- When changing gameplay systems, update or add tests in `src/__tests__/` when practical.

## Validation
- Run targeted tests or type checks for changed behavior when feasible.
- Prefer the existing project scripts in `package.json` over ad hoc commands.
