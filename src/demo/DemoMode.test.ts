/**
 * DemoMode.test.ts
 *
 * WHY these tests:
 *   1. Verify idle timer triggers demo after timeout
 *   2. Verify user interaction during demo cancels it and returns to menu
 *   3. Verify kiosk-mode guard: demo never starts when disabled
 */

import { DemoMode, DemoSequenceType, HOW_TO_PLAY_STEPS } from './DemoMode';

// ---------------------------------------------------------------------------
// Minimal Game stub – only the three hooks DemoMode calls
// ---------------------------------------------------------------------------
function makeGameStub() {
  return {
    onDemoStart: jest.fn(),
    onDemoStep: jest.fn(),
    onDemoCancel: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Setup: use fake timers for deterministic idle / step scheduling
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  // Clean up any listeners that may have leaked between tests
  document.dispatchEvent(new PointerEvent('pointerdown'));
});

// ---------------------------------------------------------------------------
// Test 1: Demo starts after 2-minute idle timeout in kiosk mode
// ---------------------------------------------------------------------------
test('starts demo after 2-minute idle when enabled', () => {
  const game = makeGameStub() as any;
  const demo = new DemoMode(game);

  demo.enable();

  // Advance just under the timeout – demo should NOT start yet
  jest.advanceTimersByTime(119_000);
  expect(game.onDemoStart).not.toHaveBeenCalled();

  // Advance past the 2-minute mark
  jest.advanceTimersByTime(2_000);
  expect(game.onDemoStart).toHaveBeenCalledTimes(1);
  expect(game.onDemoStart).toHaveBeenCalledWith(DemoSequenceType.TUTORIAL);

  // First step should also have fired
  expect(game.onDemoStep).toHaveBeenCalledWith(
    HOW_TO_PLAY_STEPS[0],
    0,
    HOW_TO_PLAY_STEPS.length,
  );

  demo.disable();
});

// ---------------------------------------------------------------------------
// Test 2: Tapping screen mid-demo cancels it and notifies the game
// ---------------------------------------------------------------------------
test('cancels demo instantly on pointer interaction and notifies game', () => {
  const game = makeGameStub() as any;
  const demo = new DemoMode(game);

  demo.enable();

  // Trigger the demo
  jest.advanceTimersByTime(120_001);
  expect(game.onDemoStart).toHaveBeenCalledTimes(1);
  expect(demo.isRunning).toBe(true);

  // Simulate a tap / pointer down while demo is playing
  document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

  // Cancel should have been called synchronously (capture-phase listener)
  expect(game.onDemoCancel).toHaveBeenCalledTimes(1);
  expect(demo.isRunning).toBe(false);

  // The idle timer should be re-armed; if we wait another 2 min the demo
  // would start again – verify onDemoStart is called a second time
  game.onDemoStart.mockClear();
  jest.advanceTimersByTime(120_001);
  expect(game.onDemoStart).toHaveBeenCalledTimes(1);

  demo.disable();
});

// ---------------------------------------------------------------------------
// Test 3: Demo never starts when DemoMode is not enabled (non-kiosk mode)
// ---------------------------------------------------------------------------
test('does not start demo when disabled (non-kiosk mode)', () => {
  const game = makeGameStub() as any;
  const demo = new DemoMode(game);

  // Deliberately do NOT call demo.enable()

  // Advance well past the idle timeout
  jest.advanceTimersByTime(300_000);

  expect(game.onDemoStart).not.toHaveBeenCalled();
  expect(demo.isRunning).toBe(false);
});

// ---------------------------------------------------------------------------
// Test 4: notifyMeaningfulActivity resets idle timer (meaningful action guard)
// ---------------------------------------------------------------------------
test('resets idle timer on meaningful game activity, preventing premature demo', () => {
  const game = makeGameStub() as any;
  const demo = new DemoMode(game);

  demo.enable();

  // 90 s in – creature moves (meaningful action)
  jest.advanceTimersByTime(90_000);
  demo.notifyMeaningfulActivity();

  // Another 90 s – still under 2 min from last activity
  jest.advanceTimersByTime(90_000);
  expect(game.onDemoStart).not.toHaveBeenCalled();

  // Now let the full 2 min elapse from the reset point
  jest.advanceTimersByTime(30_001);
  expect(game.onDemoStart).toHaveBeenCalledTimes(1);

  demo.disable();
});
