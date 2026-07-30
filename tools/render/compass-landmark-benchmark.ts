import {
  LEVEL,
  World,
  type WorldFeatures,
} from "../../packages/engine/src/index.js";
import {
  CompassLandmarkLocator,
} from "../../packages/client/src/scenes/dungeon/world/landmarks/compassLandmarks.js";

const SAMPLE_COUNT = 25;

export function benchmarkCompassLandmarks(
  worldSeed: number,
  features: WorldFeatures,
) {
  const samples: number[] = [];
  let maximumGeneratedChunks = 0;
  for (let index = 0; index < SAMPLE_COUNT; index++) {
    const world = new World(worldSeed, 1, {
      level: LEVEL.Dungeon,
      features,
    });
    const locator = new CompassLandmarkLocator();
    const start = performance.now();
    locator.resolve({
      world,
      x: 0.5,
      y: 0.5,
      viewBearingDeg: 0,
      miniBossArenaWindowCenter: { cx: 0, cy: 0 },
    });
    samples.push(performance.now() - start);
    maximumGeneratedChunks = Math.max(
      maximumGeneratedChunks,
      world.cachedChunkCount,
    );
  }
  samples.sort((left, right) => left - right);
  return {
    medianMs: samples[Math.floor(samples.length / 2)] ?? 0,
    minimumMs: samples[0] ?? 0,
    maximumMs: samples.at(-1) ?? 0,
    maximumGeneratedChunks,
  };
}
