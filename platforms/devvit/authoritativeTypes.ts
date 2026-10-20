/**
 * Backwards-compatible re-export of the transport-agnostic authoritative types.
 *
 * The real definitions now live in `../multiplayer/authoritative` so any
 * transport (Devvit, PeerJS, Rivalis, Hono, …) can carry them without coupling
 * to the `devvit` layer. This file keeps existing imports working.
 */
export type {
	Intent,
	CreatureSnapshot,
	PlayerSnapshot,
	AuthoritativeState,
	IntentStore,
	InMemoryIntentStore,
} from '../../src/multiplayer/authoritative';
