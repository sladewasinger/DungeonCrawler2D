import type { LightSource } from "./lightSource.js";

export function selectFrameLights(
  chunkLights: Iterable<readonly LightSource[]>,
  accentLights: readonly LightSource[],
  centerX: number,
  centerY: number,
  personalLight: LightSource,
  maxLights: number,
  candidates: LightSource[],
  selected: LightSource[],
): LightSource[] {
  candidates.length = 0;
  for (const lights of chunkLights) candidates.push(...lights);
  candidates.push(...accentLights);
  candidates.sort(
    (left, right) =>
      distanceSquared(left, centerX, centerY) -
      distanceSquared(right, centerX, centerY),
  );

  selected.length = 0;
  const nonPersonalLimit = Math.max(0, maxLights - 1);
  for (let index = 0; index < candidates.length && index < nonPersonalLimit; index++) {
    const light = candidates[index];
    if (light) selected.push(light);
  }
  selected.push(personalLight);
  return selected;
}

export function collectTorchLights(
  chunkLights: Iterable<readonly LightSource[]>,
  accentLights: readonly LightSource[],
  out: LightSource[],
): LightSource[] {
  out.length = 0;
  for (const lights of chunkLights) appendTorches(lights, out);
  appendTorches(accentLights, out);
  return out;
}

function appendTorches(
  lights: readonly LightSource[],
  out: LightSource[],
): void {
  for (const light of lights) {
    if (light.kind === "torch") out.push(light);
  }
}

function distanceSquared(
  light: LightSource,
  centerX: number,
  centerY: number,
): number {
  const dx = light.x - centerX;
  const dy = light.y - centerY;
  return dx * dx + dy * dy;
}
