# assets

Images and audio that the game publishes at build time. `assets-manifest.mts` walks
these directories during the Vite build and writes the result to `assets/index.js`
(generated, git-ignored), which the game reads back.

## Phaser texture keys

Phaser addresses images by key, not by URL:

```
this.display.loadTexture("myKey");
```

Two things can provide that key.

### Preloaded

Everything under the preload list in `assets-manifest.mts` is queued into Phaser
before a match starts. The basename of each file is its texture key, so

```
assets/drops/apple.png
```

becomes

```
// done for you by assets.ts#use()
phaser.load.image('apple', 'assets/drops/apple.png');
```

The list is kept short on purpose — the shared unit sprites, plus the board chrome
named file by file in `assetFiles`. Those are needed the moment the board appears,
so there is nothing to gain by deferring them. `assets/interface` is a mixed bag of
board chrome and UI-only art, which is why its preload entries are individual paths
rather than a whole directory.

**Basenames must be unique across the preload list.** Because the key is the
basename, two files sharing one collide and the first match wins (with a console
warning).

### On demand

Everything else — per-unit cardboards, drop pickups, match backgrounds, artwork,
avatars, ability icons — is *not* preloaded. Instead it is fetched the first time
something needs to draw it:

```
import { loadTexture } from './assets';

// Redraw once the texture has arrived.
loadTexture('Abolished', 'units/cardboards/Abolished', () => redraw());
```

This is what keeps a match from downloading the whole roster: a game only pays for
the units, drops and screens it actually shows. Requesting the same key twice is a
no-op, so callers can be written as if every texture were already there.

The two hot paths are:

- **Unit cardboards** (`assets.ensureCardboard`). The placement preview measures a
  unit against its cardboard to work out where it will land, so the preview is what
  triggers the download — see `HexGrid#previewCreature`. Dark Priest is the
  exception: every player starts with one, so its variants join the first batch.
- **Drop pickups** (`assets.ensureDropTexture`). A unit only leaves a drop behind
  when it dies, so the art is warmed when the unit is created rather than at match
  start.

## Other keys

`assets.getUrl(key)` resolves a directory-and-extensionless path to a published URL
(`units/artwork/Chimera` → `assets/units/artwork/Chimera.jpg`). This is how CSS,
`<img>` tags and the on-demand loaders reach art that is not a Phaser texture.
Unlike texture keys these are not basenames, so there are no collisions.

Audio uses the same scheme: `units/shouts/Chimera` resolves to the matching `.ogg`.
