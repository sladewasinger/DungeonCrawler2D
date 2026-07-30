import { CHUNK_SIZE, type World } from "@dc2d/engine";
import { viewChunkWorldOrigin } from "../core/viewChunkOrigin.js";
import { hashSeed, type LightSource } from "../core/lightSource.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import type { ChunkCoord } from "../../terrain/streaming/streaming.js";
import {
  doorLightPositions,
  type DoorLightMount,
} from "./doorLights.js";
import { TORCH_COLOR, TORCH_RADIUS_TILES } from "./torchLightStyle.js";
import {
  selectTorchPositions,
  torchCandidates,
  type TilePos,
  type TileRect,
} from "./torchPlacement.js";
import {
  PORTAL_LIGHT_COLOR,
  PORTAL_LIGHT_RADIUS_TILES,
} from "../lightingRuntimeStyle.js";

/** Scans one view-oriented runtime chunk for authored torch and door lights. */
export class ChunkLightScanner {
  constructor(private readonly world: World) {}

  scan(coord: ChunkCoord): LightSource[] {
    const bounds = chunkWorldBounds(coord);
    const torches = selectTorchPositions(torchCandidates(this.world, bounds))
      .map((position) => this.torchLight(position));
    const doors = doorLightPositions(this.world, bounds)
      .map((mount) => this.doorLight(mount));
    return [...torches, ...doors];
  }

  private torchLight(position: TilePos): LightSource {
    const id = `torch:${position.wx},${position.wy}`;
    return {
      id,
      x: position.wx + 0.5,
      y: position.wy + 1.1,
      color: TORCH_COLOR,
      radiusTiles: TORCH_RADIUS_TILES,
      kind: "torch",
      seed: hashSeed(id),
      groundHeight: this.world.groundAt(position.wx + 0.5, position.wy + 0.5),
    };
  }

  private doorLight(mount: DoorLightMount): LightSource {
    const id = `door:${mount.wx},${mount.wy}`;
    return {
      id,
      x: mount.x,
      y: mount.y,
      color: PORTAL_LIGHT_COLOR,
      radiusTiles: PORTAL_LIGHT_RADIUS_TILES,
      kind: "portal",
      seed: hashSeed(id),
      groundHeight: mount.projectionHeight,
    };
  }
}

function chunkWorldBounds(coord: ChunkCoord): TileRect {
  const origin = viewChunkWorldOrigin({
    baseVX: coord.cx * CHUNK_SIZE,
    baseVY: coord.cy * CHUNK_SIZE,
    size: CHUNK_SIZE,
    orientation: getViewOrientation(),
  });
  return {
    x0: origin.x,
    y0: origin.y,
    x1: origin.x + CHUNK_SIZE,
    y1: origin.y + CHUNK_SIZE,
  };
}
