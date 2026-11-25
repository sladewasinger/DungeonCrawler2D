/** WebGL2 full-screen atmosphere composite: lightmap, rim light, bloom, sunbeams, clouds, mist, and grading. */

export const LIGHTING_COMPOSITE_FRAGMENT_GLSL = /* glsl */ `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uLightMap;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uTime;
uniform float uBloomStrength;
uniform float uSunbeamStrength;
uniform float uCloudAlpha;
uniform float uNightFactor;
uniform float uInvZoom;
uniform vec2 uWorldOrigin;
uniform vec3 uSunColor;
uniform vec3 uFogColor;

const mat2 CLOUD_ROT = mat2(0.8, -0.6, 0.6, 0.8);

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float smoothNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float cloudFbm(vec2 p) {
  vec2 rp = CLOUD_ROT * p;
  float n1 = smoothNoise(rp);
  float n2 = smoothNoise(CLOUD_ROT * rp * 2.07 + vec2(17.3, 9.2));
  return n1 * 0.68 + n2 * 0.32;
}

vec3 bloomTap(vec2 uv) {
  vec3 c = texture(uTexture, uv).rgb;
  float warmth = max(0.0, max(c.r, c.g * 0.92) - c.b * 0.35);
  return c * smoothstep(0.62, 1.15, warmth);
}

vec3 sampleSelectiveBloom(vec2 uv, vec2 screenUv, vec2 texel) {
  vec3 acc = bloomTap(uv + vec2(2.5, 0.0) * texel)
    + bloomTap(uv + vec2(-2.5, 0.0) * texel)
    + bloomTap(uv + vec2(0.0, 2.5) * texel)
    + bloomTap(uv + vec2(0.0, -2.5) * texel);
  vec3 lGlow = max(vec3(0.0), texture(uLightMap, screenUv).rgb - vec3(0.95));
  return acc * 0.22 + lGlow * 0.42;
}

void main(void) {
  float t = mod(uTime, 4096.0);
  vec2 texel = uInputSize.zw;
  vec2 screenUv = clamp((vTextureCoord * uInputSize.xy) / max(uOutputFrame.zw, vec2(1.0)), 0.0, 1.0);
  vec2 worldPx = uWorldOrigin + (vTextureCoord * uInputSize.xy) * uInvZoom;

  vec4 scene = texture(uTexture, vTextureCoord);
  vec3 light = max(texture(uLightMap, screenUv).rgb, vec3(0.18, 0.21, 0.34));

  float lumL = dot(texture(uTexture, vTextureCoord - vec2(texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
  float lumR = dot(texture(uTexture, vTextureCoord + vec2(texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
  float lumU = dot(texture(uTexture, vTextureCoord - vec2(0.0, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
  float lumD = dot(texture(uTexture, vTextureCoord + vec2(0.0, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
  float rim = max(0.0, (lumL - lumR) * 0.65 + (lumU - lumD) * 0.85);
  vec3 reliefLight = light + uSunColor * rim * (0.24 - 0.12 * uNightFactor);

  float cloudField = cloudFbm(worldPx * 0.0034 + vec2(t * 0.028, t * 0.011));
  float cloudMask = 1.0 - smoothstep(0.46, 0.88, cloudField) * (uCloudAlpha * 0.82);
  vec3 lit = scene.rgb * reliefLight * mix(cloudMask, 1.0, clamp((light.r - 0.9) * 1.4, 0.0, 1.0));

  float fireMask = smoothstep(0.74, 1.05, max(scene.r, scene.g * 0.88) - scene.b * 0.45);
  lit = mix(lit, scene.rgb * 1.16, fireMask * 0.72);
  lit += sampleSelectiveBloom(vTextureCoord, screenUv, texel) * uBloomStrength;

  if (uSunbeamStrength > 0.01) {
    float rayAngle = worldPx.x * 0.022 + worldPx.y * 0.014;
    float rayWave = 0.5 + 0.5 * sin(rayAngle + t * 0.25 + smoothNoise(CLOUD_ROT * worldPx * 0.005) * 2.2);
    float topFade = 1.0 - smoothstep(0.15, 0.95, screenUv.y);
    float beams = pow(rayWave, 2.4) * topFade * uSunbeamStrength;
    lit += uSunColor * beams * 0.15;
  }

  float mistPattern = cloudFbm(worldPx * 0.0065 - vec2(t * 0.032, t * 0.012));
  float mistAmount = smoothstep(0.45, 0.92, mistPattern) * (0.06 + 0.12 * uNightFactor) * smoothstep(0.25, 0.95, screenUv.y);
  lit = mix(lit, uFogColor, mistAmount);

  vec2 centered = screenUv - vec2(0.5);
  float vignette = 1.0 - dot(centered, centered) * (0.28 + 0.26 * uNightFactor);
  vec3 graded = (lit * vignette) / (vec3(1.0) + max(vec3(0.0), lit - vec3(0.92)) * 0.35);

  finalColor = vec4(graded, max(scene.a, 1.0));
}
`;
