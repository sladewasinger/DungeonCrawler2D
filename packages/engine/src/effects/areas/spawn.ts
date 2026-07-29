import type { AreaSpawn, AreaPlacement } from "./types.js";

export interface AreaSpawnContext {
  readonly spawn: AreaSpawn;
  readonly place: (placement: AreaPlacement) => void;
}

export function spawnArea({ spawn, place }: AreaSpawnContext): void {
  for (let dy = -spawn.radius; dy <= spawn.radius; dy++) {
    spawnRow({ spawn, place, dy });
  }
}

interface AreaSpawnRow extends AreaSpawnContext {
  readonly dy: number;
}

function spawnRow({ spawn, place, dy }: AreaSpawnRow): void {
  const offsets = Array.from(
    { length: spawn.radius * 2 + 1 },
    (_, index) => index - spawn.radius,
  );
  const validOffsets = offsets.filter((dx) => Math.hypot(dx, dy) <= spawn.radius + 0.01);
  for (const dx of validOffsets) {
    place({
      defId: spawn.defId,
      x: spawn.x + dx,
      y: spawn.y + dy,
      steps: 0,
      ...(spawn.sourceId === undefined ? {} : { sourceId: spawn.sourceId }),
    });
  }
}
