/**
 * src/demo/index.ts
 *
 * WHY: barrel export so the rest of the codebase imports from a stable
 * path ('src/demo') rather than a deep file path. If we restructure
 * internals later, consumers don't break.
 */
export { DemoMode } from './DemoMode';
export type { DemoStep } from './DemoMode';
export { DemoSequenceType, HOW_TO_PLAY_STEPS } from './DemoMode';
