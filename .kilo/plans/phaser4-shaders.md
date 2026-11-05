# Phaser 4 Shader Pipeline Plan

## Goal
Make the Infernal shaders in `src/shader.ts` actually render on-screen in WebGL mode as part of the Phaser 4 migration, without regressing the existing canvas-2D fallback that already works.

## Root cause
`src/shader.ts` defines GLSL ES 1.0 fragment sources but never compiles them. `animations.ts` only reads `defaultUniforms` and hand-computes the pulse in JS. The GLSL strings are dead code.

## Approach
Phaser 4 has no `addShader`/`createShader`/`Pipeline` class. Two real paths exist:
1. `Phaser.GameObjects.Shader` — a full Shader game object with a `ShaderQuad` render node. Simple, but each instance is a separate draw call and does not replace the sprite.
2. `Phaser.Filters` — `enableFilters()` + a custom `Controller` extending `BaseFilterShader` with a custom `Filter*` render node registered via `RenderNodeManager.addNodeConstructor`. This replaces the sprite's pixels with the shader output. Chosen.

## Files to change
- `src/shader.ts` — rewrite GLSL to GLSL ES 3.0, export compiled shader sources + a `registerShaderFilter` factory.
- `src/engine/Phaser4Handles.ts` — add `wrapShaderFilter` facade returning a `Controller`-like handle with `setUniform`/`destroy`.
- `src/engine/types.ts` — add `ShaderFilterHandle` to `SpriteHandle`.
- `src/engine/Phaser4Engine.ts` — expose `add.shaderFilter(...)` on the engine.
- `src/animations.ts` — replace the hand-computed pulse with `setUniform` calls; keep canvas-2D path as fallback.

## GLSL ES 3.0 conversions
- `attribute` → `in`, `varying` → `out` (vertex) / `in` (fragment)
- `texture2D(...)` → `texture(...)`
- `gl_FragColor` → `fragColor` (declare `vec4 fragColor;` first)
- `mat3 projectionMatrix` → `mat4 uProjectionMatrix` (Phaser 4 sets it automatically)

## Validation
- `npm run build` compiles
- `npm run lint` 0 errors
- `npm test` 415/415 pass
- Manual: WebGL desktop browser — Infernal cardboard shows animated glow instead of flat tint