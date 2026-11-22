/** WebGL2 GLSL fragment shader for animated water caustics, shoreline foam, and glints. */

export const WATER_FRAGMENT_GLSL = /* glsl */ `#version 300 es
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

  float off = 3.0;
  float edgeMin = min(
    min(texture(uTexture, vTextureCoord + vec2(texel.x * off, 0.0)).a,
        texture(uTexture, vTextureCoord - vec2(texel.x * off, 0.0)).a),
    min(texture(uTexture, vTextureCoord + vec2(0.0, texel.y * off)).a,
        texture(uTexture, vTextureCoord - vec2(0.0, texel.y * off)).a)
  );
  float shoreWave = 0.5 + 0.5 * sin(uTime * 3.0 + qPx.x * 0.28 + qPx.y * 0.22);
  float foam = (1.0 - smoothstep(0.15, 0.92, edgeMin)) * (0.45 + 0.55 * shoreWave);

  float glint = pow(max(0.0, w1 * w2), 4.0) * (1.0 - uNightFactor * 0.45);
  vec3 tint = mix(vec3(0.45, 0.85, 0.96), uSunColor, 0.35);
  vec3 waterRgb = base.rgb;
  waterRgb += tint * caustic * 0.18;
  waterRgb = mix(waterRgb, vec3(0.86, 0.96, 1.0), foam * 0.62);
  waterRgb += uSunColor * glint * 0.42;

  finalColor = vec4(waterRgb * base.a, base.a);
}
`;
