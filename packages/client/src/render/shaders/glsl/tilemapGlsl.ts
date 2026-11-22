/** WebGL2 GLSL vertex and fragment shaders for 32x32 GPU tilemap atlas rendering. */

export const TILEMAP_VERTEX_GLSL = /* glsl */ `#version 300 es
in vec2 aPosition;
in vec2 aUV;

out vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main(void) {
  vUV = aUV;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`;

export const TILEMAP_FRAGMENT_GLSL = /* glsl */ `#version 300 es
in vec2 vUV;
out vec4 finalColor;

uniform sampler2D uAtlas;
uniform sampler2D uChunkMap;
uniform float uChunkSize;
uniform float uTileInner;
uniform float uTileStride;
uniform float uLayerMode;

vec4 fringeColor(int code) {
  if (code == 1) return vec4(220.0, 192.0, 136.0, 115.0) / 255.0;
  if (code == 2) return vec4(156.0, 115.0, 73.0, 115.0) / 255.0;
  if (code == 3) return vec4(82.0, 162.0, 70.0, 102.0) / 255.0;
  if (code == 4) return vec4(62.0, 139.0, 67.0, 102.0) / 255.0;
  return vec4(0.0);
}

int cornerBandWidth(int row) {
  if (row == 0) return 8;
  if (row == 1) return 6;
  if (row == 2) return 4;
  if (row == 3) return 3;
  if (row == 4) return 2;
  return 1;
}

bool inCutCorner(ivec2 px, int mask, int inner) {
  int rx = inner - 1 - px.x;
  int by = inner - 1 - px.y;
  if ((mask & 1) != 0 && px.y < 6 && px.x < cornerBandWidth(px.y)) return true;
  if ((mask & 2) != 0 && px.y < 6 && rx < cornerBandWidth(px.y)) return true;
  if ((mask & 4) != 0 && by < 6 && px.x < cornerBandWidth(by)) return true;
  if ((mask & 8) != 0 && by < 6 && rx < cornerBandWidth(by)) return true;
  return false;
}

vec3 applyGroundAo(vec3 rgb, ivec2 px, int aoMask, int inner) {
  vec3 aoColor = vec3(10.0, 14.0, 22.0) / 255.0;
  if ((aoMask & 1) != 0) {
    if (px.y < 6) rgb = mix(rgb, aoColor, 0.36);
    else if (px.y < 12) rgb = mix(rgb, aoColor, 0.16);
  }
  if ((aoMask & 2) != 0) {
    if (px.x < 4) rgb = mix(rgb, aoColor, 0.36);
    else if (px.x < 8) rgb = mix(rgb, aoColor, 0.16);
  }
  if ((aoMask & 4) != 0 && px.x >= inner - 6) rgb = mix(rgb, aoColor, 0.16);
  if ((aoMask & 8) != 0 && px.y >= inner - 6) rgb = mix(rgb, aoColor, 0.16);
  return rgb;
}

vec3 sampleTile(int kind, int variant, ivec2 px, int stride) {
  ivec2 atlasPx = ivec2(variant * stride + 1 + px.x, kind * stride + 1 + px.y);
  return texelFetch(uAtlas, atlasPx, 0).rgb;
}

void main(void) {
  int inner = int(uTileInner);
  int stride = int(uTileStride);
  vec2 clampedGrid = clamp(vUV * uChunkSize, vec2(0.0), vec2(uChunkSize - 0.0001));
  ivec2 cell = ivec2(floor(clampedGrid));
  ivec2 px = clamp(ivec2(floor((clampedGrid - vec2(cell)) * uTileInner)), ivec2(0), ivec2(inner - 1));
  ivec4 packed = ivec4(floor(texelFetch(uChunkMap, cell, 0) * 255.0 + 0.5));
  int variant = packed.g & 3;

  if (uLayerMode >= 0.5) {
    if (packed.r == 0) discard;
    int cornerMask = (packed.g >> 2) & 15;
    if (inCutCorner(px, cornerMask, inner)) discard;
    int wKind = packed.r == 1 ? 1 : 0;
    float alpha = packed.r == 1 ? 0.86 : 1.0;
    vec3 wRgb = sampleTile(wKind, variant, px, stride);
    finalColor = vec4(wRgb * alpha, alpha);
    return;
  }

  vec3 rgb = sampleTile(packed.r, variant, px, stride);
  int northFringe = packed.b & 7;
  int westFringe = (packed.b >> 3) & 7;
  if (northFringe > 0 && px.y < 4) {
    vec4 fc = fringeColor(northFringe);
    rgb = mix(rgb, fc.rgb, fc.a);
  }
  if (westFringe > 0 && px.x < 4) {
    vec4 fc = fringeColor(westFringe);
    rgb = mix(rgb, fc.rgb, fc.a);
  }
  int aoMask = (packed.g >> 2) & 15;
  finalColor = vec4(applyGroundAo(rgb, px, aoMask, inner), 1.0);
}
`;
