/*
 * Ancient Beast Plasma Field — GPU implementation.
 *
 * The Dark Priest shield was originally a per-pixel JavaScript loop writing into
 * a 2D canvas (`plasma-field.ts`), which cost ~15ms per field per frame at full
 * resolution — about 61ms/frame for the four shields a 2v2 puts on screen, i.e.
 * more than a whole frame budget. This module evaluates the identical maths in a
 * fragment shader so the GPU does the per-pixel work instead.
 *
 * The maths below is a line-for-line port of `PlasmaField.draw()` /
 * `surfaceScalar()` / `band()` / `hueRotateRgb()`, so the shader and the CPU
 * fallback produce the same image. Keep them in sync when changing either.
 *
 * Phaser 4 notes (verified against phaser 4.2.1):
 *  - `preFX` / `postFX` no longer exist; the FX system was renamed to *Filters*
 *    and custom shaders are RenderNodes. For a fully procedural effect the
 *    `Shader` game object is the simpler route and needs no node registration.
 *  - GLSL here is ES 1.00: `gl_FragColor`, `texture2D`, `varying`, no `#version`.
 *  - `Shader` mixes in `BlendMode` but NOT `Alpha`, and its `setAlpha()` is a
 *    documented no-op — so opacity is applied inside the shader via `uAlpha`.
 *  - On the CANVAS renderer `Shader`'s renderer is an empty stub, so the caller
 *    must fall back to the CPU path (see `plasma-field.ts`).
 */

import { PLASMA_LOOK_GLSL } from './look';

/**
 * Fragment shader source.
 *
 * `outTexCoord` is 0..1 across the quad. The field's own aspect is carried by
 * `uRadius` (in the same normalised units the CPU version used for rx/ry), so
 * the ellipse stays circular regardless of quad size or sprite scale.
 *
 * Coordinates are derived from `outTexCoord` rather than `gl_FragCoord` on
 * purpose: Phaser renders filters/frames with a vertical flip, so
 * `gl_FragCoord.y = 0` is the *bottom* of the buffer. `outTexCoord` is
 * consistent, which keeps the bottom-only fade the CPU version has.
 */
export const PLASMA_FRAGMENT_SOURCE = `
precision highp float;

// Tuning constants are generated from plasma-look.ts so that the shader and the
// Canvas2D fallback cannot drift apart. Do not hardcode look values below.
${PLASMA_LOOK_GLSL}

uniform float uTime;
uniform float uAlpha;
uniform float uHueShift;
uniform vec2 uRadius;
uniform float uFlowSpeed;
uniform float uWrap3D;
uniform float uDensity;
uniform float uThickness;
// Band weight for this specific field. Set from plasmaLookFor() so it tracks the
// Dark Priest's remaining plasma, and so the shader and the Canvas2D fallback
// read the identical number on the same tick.
uniform float uBandWiden;
uniform float uBandGain;
uniform float uSkin;
uniform float uContrast;
uniform float uBackSurface;
uniform float uTransparency;
uniform float uBottomFade;
uniform float uBottomFadeCurve;
uniform float uBurst;

varying vec2 outTexCoord;

float clampf(float v, float lo, float hi) {
    return clamp(v, lo, hi);
}

// Gaussian band, matching PlasmaField.band(): exp(-((s - c) / w)^2).
float band(float s, float c, float w) {
    float q = (s - c) / w;
    return exp(-q * q);
}

float smoothstepf(float a, float b, float x) {
    float t = clamp((x - a) / (b - a), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

// Luminance-preserving hue rotation, matching PlasmaField.hueRotateRgb().
vec3 hueRotate(vec3 rgb, float degrees) {
    float a = degrees * 0.017453292;
    float c = cos(a);
    float s = sin(a);
    return vec3(
        (0.213 + c * 0.787 - s * 0.213) * rgb.r + (0.715 - c * 0.715 - s * 0.715) * rgb.g + (0.072 - c * 0.072 + s * 0.928) * rgb.b,
        (0.213 - c * 0.213 + s * 0.143) * rgb.r + (0.715 + c * 0.285 + s * 0.14 ) * rgb.g + (0.072 - c * 0.072 - s * 0.283) * rgb.b,
        (0.213 - c * 0.213 - s * 0.787) * rgb.r + (0.715 - c * 0.715 + s * 0.715) * rgb.g + (0.072 + c * 0.928 + s * 0.072) * rgb.b
    );
}

// PlasmaField.surfaceScalar(), returning the surface scalar in .x and the
// drain term in .y (the CPU version returns them as an object).
vec2 surfaceScalar(float theta, float v, float depth, float mt, float isBack, float burstPower) {
    float dir = isBack == 0.0 ? 1.0 : -1.0;

    float baseFlow = mt * uFlowSpeed;
    float burstFlow = baseFlow * burstPower * 2.5;
    float drain = v - baseFlow - burstFlow;

    float T = theta;
    T += dir * uWrap3D * (0.72 * sin(mt * 1.35) + 0.22 * sin(v * 8.0 - mt * 2.8));
    T += uWrap3D * 0.28 * sin(v * 12.0 + theta * 0.8 + mt * 2.2);
    T += uWrap3D * 0.16 * sin(v * 21.0 - theta * 1.3 - mt * 3.6);

    float V = v;
    V += 0.055 * sin(theta * 2.4 + mt * 1.8 * dir);
    V += 0.035 * sin(theta * 5.0 - v * 10.0 + mt * 2.7);

    float s = 0.0;
    s += 0.92 * sin(1.75 * T + 4.1 * drain + 0.6 * sin(8.0 * V - mt * 2.0));
    s += 0.78 * sin(3.25 * T - 5.7 * drain + 0.44 * sin(2.2 * T + mt * 2.8));
    s += 0.62 * sin(5.6 * T + 6.4 * V - mt * 3.5);
    s += 0.42 * sin(9.2 * T - 7.8 * drain + 0.28 * sin(15.0 * V + mt * 1.6));
    s += 0.26 * sin(14.0 * T + 10.0 * V + mt * 4.0);
    s += 0.1 * depth * sin(6.0 * V + mt * 2.6);

    return vec2(s / 2.45, drain);
}

void main(void) {
    // Normalised quad coordinates with the centre at the origin.
    //
    // Phaser's default texture coordinates for a Shader quad are
    // topLeftY = 1 / bottomLeftY = 0 (Shader#setTextureCoordinates), so
    // outTexCoord.y is 1 at the visual TOP of the quad and 0 at the bottom.
    // The CPU version works in pixel space where y grows downward from the top.
    // Flip here so the bottom-only fade stays at the bottom and the shield is
    // not rendered upside down.
    vec2 p = vec2(outTexCoord.x, 1.0 - outTexCoord.y) - vec2(0.5);
    vec2 n = p / uRadius;
    float e = dot(n, n);

    if (e > 1.0) {
        gl_FragColor = vec4(0.0);
        return;
    }

    float t = uTime;
    float burst = uBurst;
    float mt = t * (0.28 + uFlowSpeed * 0.55);
    float mtBack = mt + 0.1 * (0.28 + uFlowSpeed * 0.55);

    float ny = n.y;
    float v = clamp((ny + 1.0) * 0.5, 0.0, 1.0);

    float rowWidth = sqrt(max(0.001, 1.0 - ny * ny));
    float u = clamp(n.x / max(0.08, rowWidth), -0.999, 0.999);
    float thetaFront = asin(u);
    float thetaBack = thetaFront + 3.14159265;
    float sideDepth = max(0.0, cos(thetaFront));
    float edge = clamp((e - 0.55) / 0.45, 0.0, 1.0);

    // BOTTOM ONLY. Top stays intact.
    float bottomMetric = 1.0 - v - uBottomFadeCurve * (1.0 - sideDepth) * 0.12;
    float bottomMask = smoothstepf(uBottomFade, uBottomFade + 0.11, bottomMetric);
    if (bottomMask <= 0.001) {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec2 front = surfaceScalar(thetaFront, v, sideDepth, mt, 0.0, burst);
    vec2 back = surfaceScalar(thetaBack, v, -sideDepth, mtBack, 1.0, burst);

    float dens = uDensity;
    float thick = uThickness;

        float f = 0.0;
    f = max(f, band(front.x * dens, -0.54 + 0.08 * sin(t * 1.8), BAND_W0 * thick * uBandWiden));
    f = max(f, band(front.x * dens, -0.2  + 0.07 * sin(t * 2.4 + 1.5), BAND_W1 * thick * uBandWiden));
    f = max(f, band(front.x * dens,  0.14 + 0.08 * sin(t * 2.0 + 2.2), BAND_W2 * thick * uBandWiden));
    f = max(f, band(front.x * dens,  0.48 + 0.06 * sin(t * 2.8 + 0.7), BAND_W3 * thick * uBandWiden));

    float b = 0.0;
    b = max(b, band(back.x * dens, -0.5  + 0.08 * sin(t * 1.5), BAND_W0 * thick * uBandWiden));
    b = max(b, band(back.x * dens, -0.15 + 0.07 * sin(t * 2.1 + 1.4), BAND_W1 * thick * uBandWiden));
    b = max(b, band(back.x * dens,  0.2  + 0.08 * sin(t * 2.4 + 2.0), BAND_W2 * thick * uBandWiden));
    b = max(b, band(back.x * dens,  0.52 + 0.06 * sin(t * 2.3 + 0.8), BAND_W3 * thick * uBandWiden));

    float crackleF =
        0.7 +
        0.18 * sin(8.0 * v + 1.8 * thetaFront - t * 5.2) +
        0.12 * sin(11.0 * front.y - 2.1 * thetaFront + t * 7.0);
    float crackleB = 0.58 + 0.16 * sin(7.6 * v + 1.7 * thetaBack + t * 3.6);
    f = clamp(f * crackleF, 0.0, 1.18);
    b = clamp(b * crackleB, 0.0, 1.05);

    float frontI = f * (0.22 + 0.52 * sideDepth + 0.12 * edge);
    float backI = b * uBackSurface * (0.05 + 0.38 * edge + 0.12 * (1.0 - sideDepth));

    float shock = 0.0;
    if (burst > 0.02) {
        float verticalPulse = smoothstepf(0.1, 0.55, v) * smoothstepf(0.1, 0.55, 1.0 - v);
        float blockT = t * (0.1 + 0.6 * 0.22);
        float drainPulse = 0.55 + 0.45 * sin(8.0 * v + blockT + thetaFront * 1.8);
        shock = burst * 0.16 * verticalPulse * drainPulse;
        frontI += f * 0.18 * burst;
        backI += b * 0.08 * burst;
    }

    float intensity = clamp((frontI + backI + shock) * uSkin * bottomMask, 0.0, 1.22);
    intensity = pow(intensity, 1.0 / uContrast);

    float core = clamp(
        ((frontI - 0.24) * 2.35 + (backI - 0.16) * 1.1 + shock * 1.2) * bottomMask,
        0.0,
        1.0
    );

    // Anti-aliased onset. A hard "if (intensity > 0.038)" cut the first band in
    // with a stair-stepped rim; ramping alpha in over that same threshold makes
    // the silhouette fade up instead, which is what removes the jagged edge.
    float onset = smoothstepf(ONSET_LOW, ONSET_HIGH, intensity);

    float alpha = (intensity * ALPHA_INTENSITY + core * ALPHA_CORE) * uBandGain * onset;

    // The aura is a rim glow, not an interior fill. Weighting it towards "edge"
    // alone still spread a milky film across the whole shield and hid the board
    // behind it; concentrating it near the silhouette keeps the middle readable.
    float aura =
        (0.018 + 0.028 * sin(t * 2.6 + v * 10.0 + thetaFront * 0.6)) *
        (AURA_EDGE_BASE + AURA_EDGE_WEIGHT * edge) *
        bottomMask;
    alpha += aura * AURA_AMOUNT;
    alpha = clamp(alpha * uTransparency, 0.0, 185.0) / 255.0;

    float i1 = min(1.0, intensity);
    float rr = 116.0 + 126.0 * i1 + 58.0 * core + 8.0 * sideDepth * f;
    float gg = 4.0 + 22.0 * i1 + 180.0 * core;
    float bb = 130.0 + 96.0 * i1 + 104.0 * core + 18.0 * edge * b;

    vec3 wave = hueRotate(vec3(rr, gg, bb), uHueShift) / 255.0;

    // Only the body of each wave carries the player's hue; the crest burns toward
    // white. Hue-rotating the crest as well left every field as one flat tinted
    // wash, so the white caps are mixed in after the rotation.
    vec3 colour = mix(wave, vec3(1.0), core * CREST_WHITE * onset);

    // The CPU version relied on the sprite's own alpha property, which Shader
    // does not have (its setAlpha is a no-op), so the opacity is folded in here.
    float a = alpha * uAlpha;

    // Must be PREMULTIPLIED. Phaser's ADD blend mode is srcFactor = ONE, so the
    // fragment's own alpha is discarded outright and raw RGB is added at full
    // strength. The CPU path gets this for free because a canvas texture is
    // uploaded with premultiplyAlpha (default true), which folds alpha into RGB
    // before it ever reaches the blend. Emitting straight RGB here therefore
    // made the shield roughly 3x too bright, blew the crests out to flat white
    // and filled the transparent interior with colour.
    gl_FragColor = vec4(colour * a, a);
}
`;

/** Uniform values a {@link PlasmaFieldShader} is configured with. */
export interface PlasmaShaderUniforms {
	time: number;
	alpha: number;
	hueShift: number;
	radiusX: number;
	radiusY: number;
	flowSpeed: number;
	wrap3d: number;
	density: number;
	thickness: number;
	skin: number;
	contrast: number;
	backSurface: number;
	transparency: number;
	bottomFade: number;
	bottomFadeCurve: number;
	burst: number;
}
