import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { AreaTileView } from "../areaEffectPool.js";
import { areaSurfaceScreen } from "../presentation/areaSurface.js";
import {
  AREA_POISON_BUBBLES,
  PUDDLE_INSET_PX,
} from "../presentation/areaVisualStyle.js";

export interface PoisonBubbleSample {
  readonly x: number;
  readonly y: number;
  readonly phaseMs: number;
  readonly radiusFactor: number;
}

export interface PoisonBubbleFrame {
  alpha: number;
  radiusX: number;
  radiusY: number;
  y: number;
}

export function createPoisonBubbleSamples(
  tiles: readonly AreaTileView[],
  maximum: number,
): PoisonBubbleSample[] {
  const sorted = [...tiles].sort(compareProjectedX);
  const samples: PoisonBubbleSample[] = [];
  for (
    let pass = 0;
    pass < AREA_POISON_BUBBLES.perTile && samples.length < maximum;
    pass++
  ) {
    appendBubblePass({
      output: samples,
      tiles: sorted,
      pass,
      available: maximum - samples.length,
    });
  }
  return samples;
}

export function createPoisonBubbleFrame(): PoisonBubbleFrame {
  return { alpha: 0, radiusX: 0, radiusY: 0, y: 0 };
}

export function updatePoisonBubbleFrame(
  frame: PoisonBubbleFrame,
  sample: PoisonBubbleSample,
  nowMs: number,
): void {
  const progress = (
    (nowMs + sample.phaseMs) % AREA_POISON_BUBBLES.periodMs
  ) / AREA_POISON_BUBBLES.periodMs;
  const dome = Math.sin(progress * Math.PI);
  const radiusRange = AREA_POISON_BUBBLES.maximumRadiusPx -
    AREA_POISON_BUBBLES.minimumRadiusPx;
  frame.alpha = Math.max(0, dome);
  frame.radiusX = (
    AREA_POISON_BUBBLES.minimumRadiusPx + radiusRange * dome
  ) * sample.radiusFactor;
  frame.radiusY = frame.radiusX * AREA_POISON_BUBBLES.heightRatio;
  frame.y = sample.y - progress * 2;
}

function appendBubblePass(
  input: {
    readonly output: PoisonBubbleSample[];
    readonly tiles: readonly AreaTileView[];
    readonly pass: number;
    readonly available: number;
  },
): void {
  const { output, tiles, pass, available } = input;
  const count = Math.min(tiles.length, available);
  if (count <= 0) return;
  const stride = tiles.length / count;
  for (let index = 0; index < count; index++) {
    const tileIndex = Math.min(
      tiles.length - 1,
      Math.floor((index + 0.5) * stride),
    );
    const tile = tiles[tileIndex];
    if (tile) output.push(createBubbleSample(tile, pass));
  }
}

function createBubbleSample(
  tile: AreaTileView,
  pass: number,
): PoisonBubbleSample {
  const center = areaSurfaceScreen(tile);
  const safeRadius = AREA_POISON_BUBBLES.maximumRadiusPx;
  const safeExtent = SCREEN_TILE_PX / 2 - PUDDLE_INSET_PX - safeRadius;
  const key = `${tile.id}:${pass}`;
  const xNoise = deterministicUnit(key, 0x1f123bb5);
  const yNoise = deterministicUnit(key, 0x5f356495);
  return {
    x: center.x + signedNoise(xNoise) * safeExtent,
    y: center.y + signedNoise(yNoise) * safeExtent,
    phaseMs: deterministicUnit(key, 0x6c8e9cf5) *
      AREA_POISON_BUBBLES.periodMs,
    radiusFactor: 0.78 + deterministicUnit(key, 0x2c9277b5) * 0.22,
  };
}

function compareProjectedX(a: AreaTileView, b: AreaTileView): number {
  return a.screenX - b.screenX;
}

function deterministicUnit(value: string, salt: number): number {
  let hash = salt;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x45d9f3b);
  }
  return (hash >>> 0) / 0xffffffff;
}

function signedNoise(value: number): number {
  return value * 2 - 1;
}
