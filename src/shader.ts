export type ShaderUniformValue = number | number[];

export type ShaderUniformMap = Record<string, ShaderUniformValue>;

export type EffectShaderKey =
	| 'xray'
	| 'infernal-luminescence'
	| 'infernal-heat'
	| 'scorched-ground-trap'
	| 'bonfire-spring-trap';

export type EffectShader = {
	key: EffectShaderKey;
	vertexSource: string;
	fragmentSource: string;
	defaultUniforms: ShaderUniformMap;
	aliases?: string[];
};

const DEFAULT_VERTEX_SOURCE = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat3 projectionMatrix;
varying vec2 vTextureCoord;

void main(void) {
	vTextureCoord = aTextureCoord;
	vec3 position = projectionMatrix * vec3(aVertexPosition, 1.0);
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const XRAY_FRAGMENT_SOURCE = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uScanlineStrength;
uniform float uGhostAlpha;

void main(void) {
	vec4 base = texture2D(uSampler, vTextureCoord);
	float scan = 0.5 + 0.5 * sin((vTextureCoord.y * 120.0) + (uTime * 9.5));
	float edge = smoothstep(0.08, 0.55, base.a);
	vec3 tint = mix(base.rgb, vec3(0.62, 0.84, 1.0), 0.55);
	tint += vec3(0.08, 0.16, 0.24) * scan * uScanlineStrength;
	float alpha = base.a * mix(1.0, uGhostAlpha, edge);
	gl_FragColor = vec4(tint, alpha);
}
`;

const INFERNAL_LUMINESCENCE_FRAGMENT_SOURCE = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uGlowStrength;
uniform float uPulseSpeed;

void main(void) {
	vec4 base = texture2D(uSampler, vTextureCoord);
	float pulse = 0.5 + 0.5 * sin((uTime * uPulseSpeed) + vTextureCoord.y * 10.0);
	vec3 ember = vec3(1.0, 0.44, 0.12);
	vec3 glow = ember * pulse * uGlowStrength * (0.2 + base.a * 0.8);
	vec3 color = base.rgb + glow;
	gl_FragColor = vec4(color, base.a);
}
`;

const INFERNAL_HEAT_FRAGMENT_SOURCE = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uDistortion;
uniform float uBanding;

void main(void) {
	float waveA = sin((vTextureCoord.y * 24.0) + (uTime * 4.0));
	float waveB = sin((vTextureCoord.y * 42.0) - (uTime * 5.5));
	float offsetX = (waveA + waveB) * 0.5 * uDistortion;
	float offsetY = sin((vTextureCoord.x * 18.0) + (uTime * 3.0)) * uDistortion * 0.3;
	vec2 uv = vec2(vTextureCoord.x + offsetX, vTextureCoord.y + offsetY);
	vec4 base = texture2D(uSampler, uv);
	float heatBand = 0.5 + 0.5 * sin((vTextureCoord.y * 85.0) + (uTime * 7.0));
	vec3 warmShift = vec3(0.06, 0.02, -0.01) * heatBand * uBanding;
	gl_FragColor = vec4(base.rgb + warmShift, base.a);
}
`;

const SCORCHED_GROUND_TRAP_FRAGMENT_SOURCE = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uInnerGlow;
uniform float uOuterAura;

void main(void) {
	vec4 base = texture2D(uSampler, vTextureCoord);
	vec2 p = vTextureCoord - vec2(0.5);
	float r = length(p);
	float emberPulse = 0.5 + 0.5 * sin((uTime * 3.2) + r * 28.0);
	float inner = smoothstep(0.52, 0.08, r) * uInnerGlow;
	float outer = smoothstep(0.86, 0.24, r) * uOuterAura;
	vec3 ember = vec3(1.0, 0.48, 0.18) * inner * (0.7 + emberPulse * 0.3);
	vec3 aura = vec3(1.0, 0.26, 0.05) * outer * (0.6 + emberPulse * 0.4);
	vec3 color = base.rgb + ember + aura;
	gl_FragColor = vec4(color, base.a);
}
`;

const BONFIRE_SPRING_TRAP_FRAGMENT_SOURCE = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uFlameLift;
uniform float uTipFlicker;

void main(void) {
	vec2 uv = vTextureCoord;
	float lift = sin((uv.x * 16.0) + (uTime * 6.0)) * uFlameLift * (1.0 - uv.y);
	uv.x += lift;
	vec4 base = texture2D(uSampler, uv);
	float tongue = smoothstep(0.2, 1.0, 1.0 - uv.y);
	float flicker = 0.5 + 0.5 * sin((uTime * 14.0) + uv.x * 30.0 + uv.y * 24.0);
	vec3 flame = vec3(1.0, 0.62, 0.24) * tongue * flicker * uTipFlicker;
	vec3 color = base.rgb + flame * (0.4 + base.a * 0.8);
	gl_FragColor = vec4(color, base.a);
}
`;

const SHADERS_BY_KEY: Record<EffectShaderKey, EffectShader> = {
	xray: {
		key: 'xray',
		vertexSource: DEFAULT_VERTEX_SOURCE,
		fragmentSource: XRAY_FRAGMENT_SOURCE,
		defaultUniforms: {
			uTime: 0,
			uScanlineStrength: 0.55,
			uGhostAlpha: 0.3,
		},
		aliases: ['x-ray', 'queue-xray', 'ghost-overlap'],
	},
	'infernal-luminescence': {
		key: 'infernal-luminescence',
		vertexSource: DEFAULT_VERTEX_SOURCE,
		fragmentSource: INFERNAL_LUMINESCENCE_FRAGMENT_SOURCE,
		defaultUniforms: {
			uTime: 0,
			uGlowStrength: 0.95,
			uPulseSpeed: 4.2,
		},
		aliases: ['infernal-glow', 'cardboard-luminescence', 'infernal-aura'],
	},
	'infernal-heat': {
		key: 'infernal-heat',
		vertexSource: DEFAULT_VERTEX_SOURCE,
		fragmentSource: INFERNAL_HEAT_FRAGMENT_SOURCE,
		defaultUniforms: {
			uTime: 0,
			uDistortion: 0.01,
			uBanding: 0.8,
		},
		aliases: ['infernal-heat-distortion', 'cardboard-heat', 'heat-haze'],
	},
	'scorched-ground-trap': {
		key: 'scorched-ground-trap',
		vertexSource: DEFAULT_VERTEX_SOURCE,
		fragmentSource: SCORCHED_GROUND_TRAP_FRAGMENT_SOURCE,
		defaultUniforms: {
			uTime: 0,
			uInnerGlow: 0.72,
			uOuterAura: 0.58,
		},
		aliases: ['scorched-ground', 'infernal-trap'],
	},
	'bonfire-spring-trap': {
		key: 'bonfire-spring-trap',
		vertexSource: DEFAULT_VERTEX_SOURCE,
		fragmentSource: BONFIRE_SPRING_TRAP_FRAGMENT_SOURCE,
		defaultUniforms: {
			uTime: 0,
			uFlameLift: 0.012,
			uTipFlicker: 1.0,
		},
		aliases: ['bonfire-spring', 'bonfire-trap', 'abolished-bonfire-spring'],
	},
};

export const effectShaders: Record<string, EffectShader> = (() => {
	const result: Record<string, EffectShader> = {};

	for (const shader of Object.values(SHADERS_BY_KEY)) {
		result[shader.key] = shader;
		for (const alias of shader.aliases ?? []) {
			result[alias] = shader;
		}
	}

	return result;
})();

export const getEffectShader = (key: string): EffectShader | undefined => {
	return effectShaders[key];
};

export const advanceShaderTime = (
	uniforms: ShaderUniformMap,
	deltaSeconds: number,
): ShaderUniformMap => {
	const currentTime = typeof uniforms.uTime === 'number' ? uniforms.uTime : 0;

	return {
		...uniforms,
		uTime: currentTime + deltaSeconds,
	};
};
