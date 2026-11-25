/** WebGL2 GLSL fragment shader for animated water caustics, rounded white shoreline foam, and glints. */

export const WATER_FRAGMENT_GLSL = /* glsl */ `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uTime;
uniform float uEnabled;
uniform float uNightFactor;
uniform float uInvZoom;
uniform vec2 uWorldOrigin;
uniform vec3 uSunColor;

float ringAlphaMin(vec2 uv, vec2 pxStep) {
  vec2 d = pxStep * 0.7071;
  float a = min(texture(uTexture, uv + vec2(pxStep.x, 0.0)).a, texture(uTexture, uv - vec2(pxStep.x, 0.0)).a);
  float b = min(texture(uTexture, uv + vec2(0.0, pxStep.y)).a, texture(uTexture, uv - vec2(0.0, pxStep.y)).a);
  float c = min(texture(uTexture, uv + d).a, texture(uTexture, uv - d).a);
  float e = min(texture(uTexture, uv + vec2(d.x, -d.y)).a, texture(uTexture, uv + vec2(-d.x, d.y)).a);
  return min(min(a, b), min(c, e));
}

void main(void) {
  vec4 base = texture(uTexture, vTextureCoord);
  if (base.a < 0.02 || uEnabled < 0.5) {
    finalColor = base;
    return;
  }

  vec2 texel = uInputSize.zw;
  vec2 screenPx = vTextureCoord * uInputSize.xy;
  vec2 worldPx = uWorldOrigin + screenPx * uInvZoom;
  vec2 qPx = floor(worldPx);

  float w1 = sin(qPx.x * 0.16 + uTime * 2.1 + sin(qPx.y * 0.22 - uTime * 1.5));
  float w2 = cos(qPx.y * 0.19 - uTime * 1.7 + sin(qPx.x * 0.13 + uTime * 1.1));
  float caustic = smoothstep(0.55, 1.45, w1 + w2);

  float nearMin = ringAlphaMin(vTextureCoord, texel * 2.4);
  float farMin = ringAlphaMin(vTextureCoord, texel * 5.2);
  float wave = 0.5 + 0.5 * sin(uTime * 2.4 + qPx.x * 0.22 + qPx.y * 0.24);
  float crest = 1.0 - smoothstep(0.08, 0.75, nearMin);
  float surf = (1.0 - smoothstep(0.15, 0.92, farMin)) * smoothstep(0.35, 0.85, wave);
  float foamMask = clamp(crest * 0.92 + surf * 0.5, 0.0, 1.0);

  float glint = pow(max(0.0, w1 * w2), 4.0) * (1.0 - uNightFactor * 0.45);
  vec3 tint = mix(vec3(0.45, 0.85, 0.96), uSunColor, 0.35);
  vec3 waterRgb = base.rgb + tint * caustic * 0.18;
  waterRgb = mix(waterRgb, vec3(0.96, 0.99, 1.0), foamMask);
  waterRgb += uSunColor * glint * 0.36;

  finalColor = vec4(waterRgb * base.a, base.a);
}
`;
