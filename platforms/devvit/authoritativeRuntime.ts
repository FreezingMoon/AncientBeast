import { AuthoritativeProcessor } from '../../src/multiplayer/authoritativeProcessor';
import { InMemoryIntentStore } from '../../src/multiplayer/authoritative';

/**
 * Shared authoritative runtime for the Devvit *server*.
 *
 * Deliberately engine-agnostic: the server stores the ordered intent log and
 * the engine-free `AuthoritativeProcessor` keeps the serverless bundle free
 * of browser-only deps (pixi/phaser via `game.ts`). State reconstruction is
 * the engine's job and runs in the client browser (or a dedicated engine
 * node / playtest runner) via `LobbyEngine.fromLog`. The store is pluggable:
 * swap `InMemoryIntentStore` for a `RedisIntentStore` for serverless prod.
 */
export const intentStore = new InMemoryIntentStore();
export const authoritativeProcessor = new AuthoritativeProcessor({ store: intentStore });
