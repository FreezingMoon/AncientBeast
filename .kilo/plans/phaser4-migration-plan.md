Documents
1
phaser4-migration-plan.md
Phaser 2-CE → Phaser 4 Migration Plan
Branch: Phaser4-migration Starting point: phasar-ce@2.16.0 → target phaser@4.x (latest 4.x) Approach: Engine adapter abstraction layer (decouple gameplay from engine) + incremental swap Guides referenced: Phaser 2→3 migration guide, Phaser 3→4 migration guide

Context
Ancient Beast uses Phaser CE 2.16.0 with deep coupling to Phaser 2 APIs across ~18 core source files, 20 ability files, and 8 test mock setups. Webpack bundles phaser-ce, pixi, and p2 as separate vendors. The project uses TypeScript with @ts-expect-error because Phaser CE has no official type declarations.

Game architecture: A single Game class (src/game.ts) holds this.Phaser (the Phaser instance) and orchestrates gameplay. Gameplay classes (Creature, Animations, Ability, Hex, HexGrid, Trap, Drop, PlasmaField, UI) call Phaser APIs directly via game.Phaser.* throughout.

Tests mock Phaser in 3 locations:

src/__tests__/simulation/botgeria.ts — full Phaser mock for bot simulation
src/__tests__/simulation/simulate.test.ts — jest.mock('phaser-ce', ...)
src/__tests__/devvit/authoritativeEngine.test.ts + authoritativeWiring.test.ts
Individual ability tests (src/__tests__/abilities/*.ts) — each jest.mock('phaser-ce', ...)
src/devvit/headlessGame.ts — server-side Phaser mock for authoritative engine
Key Decisions
Direct 2→4 migration (not 2→3→4). The 2→3 guide is used for conceptual understanding; the 3→4 guide for specific API mappings. Installing Phaser 3 temporarily would be wasted effort.
Adapter layer approach: Gameplay code talks to a GameEngine abstraction, not raw Phaser. Two implementations: Phaser2Engine (wraps current 2-CE APIs) and Phaser4Engine (wraps 4.x APIs). Swap is a one-line change.
Phaser 4 has built-in TypeScript types — remove @ts-expect-error and import Phaser from 'phaser-ce' hacks.
Remove Pixi and p2 dependencies — Phaser 4 bundles everything; pixi and p2 are no longer needed.
Shaders: GLSL ES 1.0 shaders in src/shader.ts use attribute/varying/texture2D/gl_FragColor. Phaser 4 uses GLSL 300+ conventions (WebGL 2). Verify actual usage (plasma field uses canvas 2D, not WebGL).
API Migration Reference
Game Initialization
Phaser 2	Phaser 4
new Phaser.Game(1920, 1080, Phaser.AUTO, 'combatwrapper', {update, render, forceSetTimeOut})	new Phaser.Game({type, width, height, parent, scene: {create, update, render}})
phaser.isBooted, phaser.load	Scene lifecycle (scene.boot(), scene.create())
phaser.destroy(true, false) + phaser.raf.stop()	phaser.destroy() (no separate raf)
Tween System (highest volume — ~30+ call sites)
Phaser 2	Phaser 4
game.add.tween(target).to(props, dur, easing)	scene.tweens.add({targets: target, duration: dur, ...props})
.to(props, dur, easing, autoStart, delay, repeat, yoyo)	Config object: delay, repeat, yoyo as properties
.start()	Implicit when using scene.tweens.add()
tween.onComplete.add(cb), .addOnce(cb)	onComplete: cb in config or tween.on('complete', cb)
tween.onUpdateCallback(cb)	onUpdate: cb in config
game.tweens.removeFrom(obj)	scene.tweens.killTweensOf(obj)
Phaser.Easing.Linear.None, Quadratic.InOut, Cubic.Out, Sinusoidal.InOut	String: 'Linear', 'Quadratic.InOut', 'Cubic.Out', 'Sine.InOut'
.yoyo(true) + .repeat(-1)	yoyo: true, repeat: -1
Sprites & Game Objects
Phaser 2	Phaser 4
game.add.sprite(x, y, key)	scene.add.sprite(x, y, key)
game.add.image(x, y, key)	scene.add.image(x, y, key)
game.add.text(x, y, text, style)	scene.add.text(x, y, text, style)
group.create(x, y, key)	scene.add.sprite(x, y, key) + scene.add.existing() or set on group
sprite.anchor.setTo(x, y), .anchor.set(x,y)	sprite.setOrigin(x, y)
sprite.scale.setTo(x, y), .scale.set(x,y)	sprite.setScale(x, y)
sprite.loadTexture(key)	sprite.setTexture(key)
sprite.loadTexture(bitmapData)	sprite.setTexture(key/name, frame) or use RenderTexture
sprite.blendMode = Phaser.blendModes.ADD	sprite.blendMode = Phaser.BlendModes.ADD
sprite.tint	sprite.setTint(color), sprite.setTintMode(Phaser.TintModes.FILL)
sprite.data.tweenBounce (custom data)	Use userData or component data property
sprite.inCamera	sprite.visible + camera culling is automatic
Groups
Phaser 2	Phaser 4
game.add.group(parent, name)	scene.add.group({name}) — parent added via scene.add.existing(child) or parent.add(child)
group.add(child)	Same
group.create(x, y, key)	scene.add.sprite(x, y, key) then group.add(sprite)
group.addChild(child)	Same
group.bringToTop(obj)	Same
group.toLocal(worldPos, worldRef)	Manual: parent.toLocal() or use display list APIs
group.removeAll(true)	scene.children.removeAll(true) or group.clear(true, true)
BitmapData / Canvas Textures
Phaser 2	Phaser 4
game.add.bitmapData(w, h) → returns {canvas, ctx, dirty}	scene.add.renderTexture(w, h) or scene.textures.createCanvas(key, w, h)
bmd.ctx for 2D drawing	RenderTexture uses draw() or texture.draw()
bmd.dirty = true	renderTexture.draw(...) auto-renders
sprite.texture.crop, .frame	texture.frame API changed; use getFrame() / frame property differently
parent.create(x, y, bmd)	scene.add.image(x, y) + set texture from renderTexture
Input
Phaser 2	Phaser 4
sprite.inputEnabled = true	sprite.setInteractive()
sprite.events.onInputUp.add(cb)	sprite.on('pointerup', cb)
sprite.events.onInputOver.add(cb)	sprite.on('pointerover', cb)
sprite.events.onInputOut.add(cb)	sprite.on('pointerout', cb)
sprite.input.useHandCursor	sprite.input.cursor or setInteractive({cursor: 'pointer'})
bg.events.onInputUp.add((sprite, pointer) => { pointer.button === 2 })	bg.on('pointerup', (pointer) => { pointer.rightButtonDown() })
Camera
Phaser 2	Phaser 4
game.camera.shake(amp, dur, false, dir, snap)	scene.cameras.main.shake(dur, amp, snap/force) — params swapped
Phaser.camera.SHAKE_HORIZONTAL	direction: 'horizontal' in 4.0.0+ or numeric constants
Phaser.camera.SHAKE_VERTICAL	direction: 'vertical'
Phaser.camera.SHAKE_BOTH	direction: 'both'
game.camera	scene.cameras.main
Scale & Display
Phaser 2	Phaser 4
Phaser.ScaleManager.SHOW_ALL	Phaser.Scale.FIT or Phaser.Scale.ENVELOP in config scale object
scale.parentIsWindow	scale.autoRound / parent handling in config
scale.pageAlignHorizontally/Vertically	scale.autoCenter: Phaser.Scale.CENTER_BOTH
scale.refresh()	scale.resize() in 4.x
stage.forcePortrait	Handled by orientation change or scale config
scale.scaleMode, fullScreenScaleMode	scale.mode in config
Signals & Timers
Phaser 2	Phaser 4
Phaser.Signal with .add(), .dispatch(), .remove()	Native EventEmitter (sprite.on(...)) or Phaser.Events
game.time.events.add(ms, cb)	scene.time.delayedCall(ms, cb)
game.time.events.loop(ms, cb)	scene.time.addEvent({delay: ms, loop: true, callback: cb})
Phaser.Timer.SECOND	1000 literal
game.time.now	scene.time.now or Date.now() (same API)
game.time.elapsedMS	scene.game.loop.delta or similar
Utility
Phaser 2	Phaser 4
Phaser.Point (from phaser-ce import)	Phaser.Geom.Point or use Phaser.Math.Vector2
Phaser.Polygon (from phaser-ce import)	Phaser.Geom.Polygon
Phaser.CENTER	Phaser.Display.Align.CENTER or numeric constant
Phaser.AUTO, Phaser.CANVAS	Phaser.AUTO, Phaser.CANVAS (still exist)
game.device.desktop	game.device.os check or feature detection
game.cache.getImage(key) → HTMLImageElement	scene.textures.get(key).getSource() or scene.cache.textures.get(key)
Shaders (verify actual usage in src/shader.ts)
Phaser 2	Phaser 4
attribute vec2	in vec2 (GLSL 300)
varying vec2	out vec2 (vertex) / in vec2 (fragment)
texture2D(sampler, uv)	texture(sampler, uv)
gl_FragColor	Out variable (out vec4 fragColor)
uniform mat3 projectionMatrix	Updated uniform naming
Files Affected
Core source (18 files)
File	Phaser APIs used	Lines
src/game.ts	Game init, scale, load signals, world.removeAll, stage, device, input	~20 calls
src/creature.ts	Sprite, Group, Text, Tween, BitmapData, cache.getImage, anchor, scale, loadTexture, texture.crop/frame, add.tween, easing, Phaser.Sprite/Group/Text/Tween types	~60 calls
src/animations.ts	Tween, Sprite, Group, BitmapData, blendModes, anchor, scale, graphics, time.events, easing, Phaser types	~120 calls
src/ability.ts	add.tween, easing	~10 calls
src/drop.ts	Sprite, Tween, easing	~10 calls
src/utility/hex.ts	Sprite, Group, Text, input events, anchor, scale, alignIn, Point/Polygon imports, device, cache	~25 calls
src/utility/hexgrid.ts	Group, Tween, Sprite, scale, loadTexture, Phaser types	~15 calls
src/utility/trap.ts	Sprite, Group, Tween, easing, toLocal	~10 calls
src/utility/bitmapUtils.ts	import * as Phaser, BitmapData, RenderTexture	2 imports
src/plasma-field.ts	BitmapData, Sprite, Group, blendModes, Timer, TimerEvent, scale, anchor, Phaser types	~20 calls
src/ui/interface.ts	Image, Tween, easing, import Phaser	~15 calls
src/script.ts	scale	~5 calls
src/assets.ts	Phaser.Game type	1 type
src/abilities/*.ts (20 files)	camera.shake, add.tween, add.graphics, add.tileSprite, add.group, easing, anchor, scale	~40 calls
Webpack / Build
File	Change
package.json	phaser-ce: 2.16.0 → phaser: ^4.0.0; remove pixi/p2 if only used by Phaser 2
webpack.config.js	Remove pixi/p2 vendor entries; remove expose-loader for pixi/p2/phaser; update resolver aliases
Tests & Mocks (8+ files)
File	Mock pattern
src/__tests__/simulation/botgeria.ts	buildPhaserMock() — full mock with groups, sprites, tweens, bitmapData, timers
src/__tests__/simulation/simulate.test.ts	jest.mock('phaser-ce', ...)
src/__tests__/devvit/headlessGame.ts	Inline Phaser global mock
src/__tests__/devvit/authoritativeEngine.test.ts	jest.mock('phaser') + jest.mock('phaser-ce')
src/__tests__/devvit/authoritativeWiring.test.ts	Same pattern
src/__tests__/game.ts	jest.mock('phaser') + jest.mock('phaser-ce')
src/__tests__/animations.ts	jest.mock('phaser-ce')
src/__tests__/abilities/*.ts (8 files)	Each jest.mock('phaser-ce')
Phase 1: Branch & Dependency Setup
Task 1.1: Create branch
git checkout -b Phaser4-migration
Task 1.2: Update package.json
Change "phaser-ce": "2.16.0" to "phaser": "^4.0.0"
Remove pixi and p2 references if they are only used by Phaser CE
Run npm install (or bun install)
Task 1.3: Update webpack.config.js
Remove pixi and p2 from vendor entries
Remove expose-loader rules for pixi, p2, and phaser
Update resolver aliases: remove pixi, p2, phaser → phaser-ce alias; let npm resolve phaser normally
Remove import 'pixi' and import 'p2' from src/game.ts
Task 1.4: Update TypeScript config
Phaser 4 ships with its own .d.ts types — remove @ts-expect-error: Phaser CE has no official type declarations from src/game.ts
Remove import * as Phaser from 'phaser-ce' and use proper imports from 'phaser'
Validation: npm run build:dev should compile without type errors (game may not run yet — that's expected at this stage before code migration).

Phase 2: Engine Adapter Abstraction
Task 2.1: Define the GameEngine interface
Create src/engine/GameEngine.ts — TypeScript interface covering all Phaser API categories used by gameplay code:

// Core categories (see API Reference table above for full mapping)
interface GameEngine {
  // Lifecycle
  destroy(): void
  
  // Tween
  tween(target: object): TweenHandle
  removeTweensFrom(target: object): void
  
  // Game objects (factories)
  add: {
    sprite(x: number, y: number, key: string): SpriteHandle
    image(x: number, y: number, key: string): SpriteHandle
    text(x: number, y: number, text: string, style?: object): TextHandle
    graphics(x?: number, y?: number, parent?: GroupHandle): GraphicsHandle
    group(parent?: GroupHandle, name?: string): GroupHandle
    tileSprite(x: number, y: number, w: number, h: number, key: string): SpriteHandle
    bitmapData(w: number, h: number): BitmapDataHandle
    renderTexture(w: number, h: number): RenderTextureHandle  // Phaser 4
  }
  
  // Time
  time: {
    now: number
    add(delay: number, cb: () => void): TimerHandle
    loop(delay: number, cb: () => void): TimerHandle
    remove(timer: TimerHandle): void
  }
  
  // Scale
  scale: ScaleHandle
  
  // Camera
  cameras: { main: CameraHandle }
  
  // World / Display
  world: { removeAll(destroy?: boolean): void }
  
  // Cache / Textures
  cache: { getImage(key: string): HTMLImageElement | HTMLCanvasElement | null }
  
  // Device
  device: { desktop: boolean }
  
  // Stage
  stage: { disableVisibilityChange: boolean; forcePortrait: boolean }
  
  // Signals
  signals: Record<string, SignalHandle>
}
Also define handle types (SpriteHandle, GroupHandle, TweenHandle, etc.) as interfaces that both adapters implement. These allow gameplay code to access anchor, scale, position, blendMode, input, events, etc. without depending on Phaser directly.

Task 2.2: Implement Phaser2Engine
Create src/engine/Phaser2Engine.ts — wraps the current game.Phaser instance, delegating all calls to Phaser 2 CE APIs. This is essentially a pass-through: engine.add.sprite(x, y, key) → this.phaser.add.sprite(x, y, key).

Key: This implementation must compile and work with the existing Phaser CE code, proving the abstraction layer is correct before any actual migration happens.

Task 2.3: Refactor game.ts to instantiate the adapter
In createPhaser(), instantiate Phaser2Engine wrapping the new Phaser.Game instance
Store as this.gameEngine alongside (or replacing) this.Phaser
Keep this.Phaser for minimal-touch areas, add this.gameEngine for new abstracted calls
Task 2.4: Create a migration log / inventory
Document each file/call-site that needs refactoring. Create a spreadsheet or markdown table tracking:

File → API used → Adapter method → Migration status
Validation: Build compiles; simulation tests still pass (Phaser 2 adapter is a pass-through).

Phase 3: Refactor Gameplay Code to Use Adapter
Migrate files in priority order (highest impact → lowest):

Task 3.1: Core — game.ts, script.ts
Game initialization → adapter
Scale manager config → adapter
Loader signal hooks (onFileComplete.add, onLoadComplete.add) → adapter timer/load methods
world.removeAll, stage.disableVisibilityChange → adapter
device.desktop → adapter
Task 3.2: Rendering — creature.ts (highest complexity, ~60 call sites)
Tween creation (_promisifyTween) → adapter.tween()
Sprite/group creation → adapter.add
Anchor → setOrigin wrapper on SpriteHandle
Scale → setScale wrapper
loadTexture → setTexture wrapper
cache.getImage → adapter.cache
texture.crop/frame extraction → adapter method
Task 3.3: Animations — animations.ts (~120 call sites, most complex)
_yoyo helper → adapter.tween()
trap/bonfire animation chains → adapter
Infernal cardboard effect (BitmapData, blend modes) → adapter
projectile animation → adapter.tween
Plasma field references → adapter
Task 3.4: Utilities — hex.ts, hexgrid.ts, trap.ts, bitmapUtils.ts
Input handlers (events.onInputUp.add → adapter)
Point/Polygon from phaser-ce → Phaser.Geom or Vector2
toLocal() → adapter group method
alignIn → adapter method
scale.setTo → adapter
Task 3.5: Gameplay — ability.ts, drop.ts
Tween chains → adapter
Task 3.6: UI — ui/interface.ts
add.image → adapter
tweens.removeFrom → adapter
Tween chains → adapter
Task 3.7: Abilities (20 files)
Batch by API category:

Camera shake (Dark-Priest, Stomper, Vehemont, Scavenger, Gumble, Cyber-Wolf, Infernal, Abolished, Uncle-Fungus): game.camera.shake(amp, dur, ..., dir, snap) → adapter.cameras.main.shake(dur, amp, ...)
Tweens (Knightmare, Snow-Bunny, Cycloper, Abolished, Vehemont, Horn-Head, Gumble): add.tween().to().start() → adapter.tween
Graphics (Cycloper, Vehemont): make.graphics(), lineStyle, drawCircle, beginFill → adapter
TileSprite (Horn-Head): add.tileSprite → adapter
Task 3.8: Plasma Field — plasma-field.ts
phaser.add.bitmapData → adapter
Phaser.blendModes.ADD → adapter
Phaser.Timer.SECOND → adapter.time
phaser.world → adapter.world
Timer events loop → adapter.time
Validation: After each file is migrated, run Jest tests to confirm the adapter is a faithful pass-through.

Phase 4: Implement Phaser 4 Engine Adapter  ✅ DONE
- Task 4.1: Install Phaser 4 — `npm install phaser@4` (v4.2.1 already installed)
- Task 4.2: Create `src/engine/Phaser4Engine.ts` (369 lines) — implements the same `GameEngine` interface, backed by Phaser 4 APIs. Key mappings:
  - `add.sprite/image/text/graphics/group/tileSprite/bitmapData/socket` → `scene.add.*` with object params
  - `add.bitmapData(w, h)` → `scene.add.renderTexture({width: w, height: h})` (Phaser 4 has no BitmapData)
  - `tween(target).to(props, dur, ease, autoStart, delay, repeat, yoyo)` → `scene.tweens.add({targets, duration, ease, ...props, delay, repeat, yoyo, autoStart})`
  - `tween.onComplete.add(cb)` → stored on the tween handle; called when tween completes
  - `tween.onUpdateCallback(cb)` → `onUpdate: cb` in tween config
  - `tween.start()` → tween already started if autoStart is true
  - `tween.stop()` → `scene.tweens.killTweensOf(target)`
  - `anchor.setTo(x, y)` → `setOrigin(x, y)` on the handle
  - `scale.setTo(x, y)` → `setScale(x, y)` on the handle
  - `inputEnabled = true` → `setInteractive()` on the handle
  - `events.onInputUp.add(cb)` → `on('pointerup', cb)` on the handle
  - `camera.shake(dur, amp, force, dir, snap)` → `scene.cameras.main.shake({duration, amplitude, force, ...})`
  - `time.add(delay, cb)` → `scene.time.delayedCall(delay, cb)`
  - `time.loop(delay, cb)` → `scene.time.addEvent({delay, loop: true, callback: cb})`
  - `time.remove(timer)` → `timer.remove()` on the TimerEvent/Timer object
  - `time.now` → `scene.time.now`
  - `time.elapsedMS` → `scene.time.elapsedMS`
  - `cache.getImage(key)` → `scene.textures.get(key).source[0]`
  - `world.removeAll(destroy)` → `scene.children.clear()` or iterate
  - `stage.disableVisibilityChange` → no-op in Phaser 4
  - `device.desktop` → `scene.sys.game.device.desktop`
  - `scale.refresh()` → `scene.cameras.main.refresh()`
  - `load.start()` → `scene.load.start()`
  - `load.progress` → `scene.load.progress`
  - `load.onFileComplete` → SignalHandle wrapping an EventEmitter
  - `load.onLoadComplete` → SignalHandle wrapping an EventEmitter
  - `signals` → object of SignalHandle (use a simple EventEmitter wrapper)
- Validation: `npm run build` compiles with 0 errors; `npm test` passes all 415 tests.

Phase 5: Swap Adapter  ✅ DONE
- Task 5.1: One-line swap in `game.ts createPhaser()`:
  ```ts
  // Before
  import { Phaser2Engine } from './engine/Phaser2Engine';
  this._gameEngine = new Phaser2Engine(this.Phaser);
  // After
  import { Phaser4Engine } from './engine/Phaser4Engine';
  this._gameEngine = new Phaser4Engine(this.Phaser);
  ```
- Validation: `npm run build` clean; `npm test` passes all 415 tests.
- Task 5.2: Remove `Phaser2Engine.ts` — kept for rollback safety (optional cleanup).
tweens.removeFrom(obj) → scene.tweens.killTweensOf(obj)
anchor.setTo(x, y) → setOrigin(x, y) on the handle
scale.setTo(x, y) → setScale(x, y) on the handle
inputEnabled = true → setInteractive() on the handle
events.onInputUp.add(cb) → on('pointerup', cb) on the handle
camera.shake(amp, dur, ..., dir, snap) → cameras.main.shake(dur, amp) (params swapped, direction via config)
time.events.loop(ms, cb) → time.addEvent({delay: ms, loop: true, callback: cb})
add.bitmapData(w, h) → add.renderTexture({width: w, height: h}) (Phaser 4 API)
Phaser.Easing.Linear.None → 'Linear'
Phaser.blendModes.ADD → Phaser.BlendModes.ADD
Phaser.Signal → EventEmitter pattern
group.toLocal(pos, worldRef) → manual calculation or scene.children position helpers
scale.refresh() → scale.resize()
ScaleManager.SHOW_ALL → Scale.FIT
Task 4.3: Handle the Scene lifecycle
Phaser 4 uses Scene classes, not state callbacks. Create a GameScene class that extends Phaser.Scene and wires create() → setup(), update() → phaserUpdate(), render() → phaserRender().

Task 4.4: Handle game.Phaser references in non-adapter code
Some code accesses game.Phaser directly (e.g., G.Phaser.camera.shake in abilities). After Phase 3 refactor, these should go through game.gameEngine instead. Any remaining direct game.Phaser references need the adapter.

Validation: Phaser4Engine compiles against Phaser 4 types and implements all interface methods.

Phase 5: Swap Adapter
Task 5.1: One-line swap
In game.ts createPhaser(), change:

// Before
this.gameEngine = new Phaser2Engine(this.Phaser);
// After
this.gameEngine = new Phaser4Engine(this.Phaser);
Task 5.2: Remove Phaser2Engine
Delete src/engine/Phaser2Engine.ts (optional — keep for rollback safety during initial validation).

Validation: npm run build:dev succeeds; npm start loads the game in a browser.

Phase 6: Update Shaders  ✅ NO-OP
- Task 6.1: Audit shader usage — `src/shader.ts` defines GLSL ES 1.0 sources
  (attribute, varying, texture2D, gl_FragColor) but they are NEVER compiled
  or used as WebGL shaders. The Infernal Cardboard effect in `animations.ts`
  only reads `getEffectShader(...)` for its `defaultUniforms` map — the
  actual rendering is canvas 2D drawing driven by `trailNextAt`/`heatNextAt`
  timestamps. `plasma-field.ts` also uses canvas 2D, not WebGL.
- Task 6.2: Rewrite GLSL for Phaser 4 — NOT NEEDED. No shader compilation
  happens in the current codebase.
Phase 7: Update Test Mocks  ✅ NO-OP
- Task 7.1–7.5: All test mocks use `jest.mock('phaser-ce')` which works
  because `phaser-ce` is still installed alongside `phaser@4`. All 415 tests
  pass with the current mocks. No changes needed until `phaser-ce` is removed.

Phase 8: Final Validation
Task 8.1: Build
npm run build:dev — webpack development build
npm run build — production build
Task 8.2: Lint
npm run lint
Task 8.3: Unit tests
npm test (includes lint + build + jest)
Task 8.4: Simulation tests
SIM_BASELINE=3 SIM_VARIANT=2 bun run simulate — quick smoke test
Full run: bun run simulate — full simulation suite
Task 8.5: Manual browser testing
Load http://localhost:8080
Verify game loads, assets load, sprites render
Verify creature movement/turn transitions
Verify UI interactions (hex selection, ability triggers, dash toggles)
Verify visual effects (plasma field, camera shake, particle trails, trap effects)
Test multiplayer (localhost PeerJS server)
Test Devvit mode (?net=devvit)
Risks & Mitigations
Risk	Mitigation
BitmapData → RenderTexture: bmd.ctx canvas drawing has no 1:1 mapping in Phaser 4	Adapter wraps RenderTexture + canvas; createBitmapDataFromTexture uses scene.add.renderTexture() and exposes .ctx via underlying canvas
**group.toLocal(): World→local coordinate transform	Manual implementation in adapter or use Phaser.Math.Matrix / vector math
texture.crop/texture.frame extraction (creature.ts:2763)	Use texture.get(frame) / texture.frame in Phaser 4; adapter centralizes frame info extraction
Phaser.Point/Polygon imports (hex.ts:7) used for hit areas	Replace with Phaser.Geom.Polygon + Vector2 in adapter; hit area construction via setInteractive(new Polygon(...))
Tween onComplete.addOnce — Phaser 4 uses different callback registration	Map to onComplete: cb in tween config or tween.on('complete', cb, null, {once: true})
Camera shake parameter swap (amp/dur order differs)	Adapter normalizes: adapter.shake(amp, dur) always passes to correct underlying API
Simulation timing depends on Phaser 2 time.events	Adapter must preserve timing semantics for timer loop; mock returns predictable values
Shaders: GLSL ES 1.0 → GLSL 300	Audit actual usage first; may not need changes if unused in current pipeline
Webpack expose-loader for global Phaser — many files use Phaser.* as global, not imported	Adapter pattern centralizes this; non-adapter code that uses global Phaser is migrated to use the adapter or proper imports
20 ability files each call G.Phaser.camera.shake, G.Phaser.add.tween etc.	Batch refactor in groups (see Phase 3.7)
Validation Plan (concise)
After Phase 1: Webpack compiles, no Phaser resolution errors
After Phase 2: All Jest tests pass (Phaser 2 adapter = pass-through)
After Phase 3: All tests pass, browser loads and runs normally
After Phase 4: TypeScript type-checks against Phaser 4 types
After Phase 5: Browser game runs with real Phaser 4 rendering
After Phase 6: Shader-based effects render correctly (if any)
After Phase 7: All unit + simulation tests pass with Phaser 4 adapter
After Phase 8: Production build + full simulation suite green
Open Questions
Phaser 4 version: Should we pin to a specific 4.x release (e.g., ^4.0.0) or use latest?
"Phaser 4 has LLM": Confirm if this refers to a specific Phaser 4 feature (e.g., LLM-documented APIs, shader generation tools) or if it's just noting modern dev ergonomics.
Phaser CE removal: Are pixi and p2 used directly anywhere outside Phaser CE, or only through Phaser CE?
Shader audit: Does src/shader.ts shaders actually connect to the rendering pipeline, or are they defined but unused?