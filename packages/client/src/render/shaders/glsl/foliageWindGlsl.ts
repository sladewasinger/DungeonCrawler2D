/** WebGL2 GLSL fragment shader for coherent world-space foliage wind gusts. */

export const FOLIAGE_WIND_FRAGMENT_GLSL = /* glsl */ `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uTime;
uniform float uWindStrength;
uniform float uZoom;
uniform float uInvZoom;
uniform vec2 uWorldOrigin;

void main(void) {
  if (uWindStrength < 0.01) {
    finalColor = texture(uTexture, vTextureCoord);
    return;
  }

  vec2 screenPx = vTextureCoord * uInputSize.xy;
  vec2 worldPx = uWorldOrigin + screenPx * uInvZoom;

  float primary = sin(worldPx.x * 0.042 + worldPx.y * 0.018 + uTime * 2.05);
  float secondary = cos(worldPx.x * 0.085 - worldPx.y * 0.03 + uTime * 3.15);
  float gust = primary * 0.68 + secondary * 0.32;

  float pxShift = gust * uWindStrength * uZoom;
  vec2 shiftedUv = vTextureCoord + vec2(pxShift * uInputSize.z, sin(uTime * 1.8 + worldPx.x * 0.05) * 0.25 * uInputSize.w * uWindStrength);
  vec4 sampleColor = texture(uTexture, shiftedUv);

  float shimmer = max(0.0, gust) * 0.06 * sampleColor.a;
  finalColor = vec4(sampleColor.rgb + vec3(0.18, 0.24, 0.08) * shimmer, sampleColor.a);
}
`;
