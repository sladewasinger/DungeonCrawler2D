import type { LightSource } from "../core/lightSource.js";

export function selectFrameLights(
  input: FrameLightSelectionInput,
): LightSource[] {
  collectCandidates(input);
  sortCandidates(input);
  return selectCappedLights(input);
}

export interface FrameLightSelectionInput {
  readonly chunkLights: Iterable<readonly LightSource[]>;
  readonly accentLights: readonly LightSource[];
  readonly center: Readonly<{ x: number; y: number }>;
  readonly personalLight: LightSource | null;
  readonly maxLights: number;
  readonly candidates: LightSource[];
  readonly selected: LightSource[];
}

function collectCandidates(input: FrameLightSelectionInput): void {
  input.candidates.length = 0;
  for (const lights of input.chunkLights) input.candidates.push(...lights);
  input.candidates.push(...input.accentLights);
}

function sortCandidates(input: FrameLightSelectionInput): void {
  input.candidates.sort((left, right) =>
    distanceSquared(left, input.center) - distanceSquared(right, input.center));
}

function selectCappedLights(input: FrameLightSelectionInput): LightSource[] {
  input.selected.length = 0;
  const limit = Math.max(0, input.maxLights - Number(Boolean(input.personalLight)));
  for (const light of input.candidates.slice(0, limit)) input.selected.push(light);
  if (input.personalLight) input.selected.push(input.personalLight);
  return input.selected;
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
  center: Readonly<{ x: number; y: number }>,
): number {
  const dx = light.x - center.x;
  const dy = light.y - center.y;
  return dx * dx + dy * dy;
}
