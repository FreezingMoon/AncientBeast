/**
 * Registers the Jest `phaser` stub as the Phaser runtime.
 *
 * Gameplay modules read engine values through `getPhaser()` / `tryGetPhaser()`
 * rather than importing `phaser` for values — that indirection is what keeps the
 * engine off the startup path. This setup file closes the loop for tests: the
 * namespace a suite gets from `jest.mock('phaser', …)` is handed to the runtime,
 * so `getPhaser()` resolves exactly as it does in the browser.
 *
 * It has to run before any suite's module graph is evaluated, hence
 * `setupFiles` rather than `setupFilesAfterEnv`. It requires the mock directly
 * instead of mocking the module, because `jest.mock` is hoisted per test file and
 * cannot be relied on from here.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { setPhaserNamespace } = require('../src/phaser/runtime');
const { createPhaserMock } = require('./phaser-mock');

setPhaserNamespace(createPhaserMock());
