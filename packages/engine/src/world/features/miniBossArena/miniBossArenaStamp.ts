import { CHUNK_SIZE, FEATURE_FACE, TILE } from "../../core/types.js";
import { WORLD_GENERATION_TUNING } from "../../generate/tuning.js";
import {
  miniBossArenaForChunk,
  type MiniBossArenaChunk,
  type MiniBossArenaSite,
} from "./miniBossArena.js";

const WALL_RISE = WORLD_GENERATION_TUNING.miniBossArena.wallRise;

export interface MiniBossArenaStamp extends MiniBossArenaChunk {
  readonly tiles: Uint8Array;
  readonly featureTiles: Uint8Array;
  readonly featureFaces: Uint8Array;
  readonly featureHeight: Float32Array;
  readonly height: Float32Array;
}

/** Applies the ordinary-floor arena after terrain polish and showcase details. */
export function applyMiniBossArena(
  context: MiniBossArenaStamp,
): MiniBossArenaSite | null {
  const site = miniBossArenaForChunk(context);
  if (!site || footprintHasAuthoredFeature(context, site)) return null;
  for (let y = site.bounds.y0; y <= site.bounds.y1; y++) {
    for (let x = site.bounds.x0; x <= site.bounds.x1; x++) {
      stampArenaCell({ context, site, worldX: x, worldY: y });
    }
  }
  for (const gate of site.gates) stampGateApproach(context, gate);
  for (const platform of site.platforms) stampPlatform(context, platform);
  for (const gate of site.gates) stampGate(context, gate);
  return site;
}

function footprintHasAuthoredFeature(
  context: MiniBossArenaStamp,
  site: MiniBossArenaSite,
): boolean {
  for (let y = site.bounds.y0; y <= site.bounds.y1; y++) {
    for (let x = site.bounds.x0; x <= site.bounds.x1; x++) {
      const index = localIndex(context, x, y);
      if (context.featureTiles[index] !== TILE.Floor) return true;
    }
  }
  return site.gates.some((gate) => {
    const point = gateOutsideTile(gate);
    return context.featureTiles[localIndex(context, point.x, point.y)] !==
      TILE.Floor;
  });
}

interface ArenaCellStamp {
  readonly context: MiniBossArenaStamp;
  readonly site: MiniBossArenaSite;
  readonly worldX: number;
  readonly worldY: number;
}

function stampArenaCell(input: ArenaCellStamp): void {
  const { context, site, worldX, worldY } = input;
  const index = localIndex(context, worldX, worldY);
  const wall = worldX === site.bounds.x0 || worldX === site.bounds.x1 ||
    worldY === site.bounds.y0 || worldY === site.bounds.y1;
  context.tiles[index] = wall ? TILE.Bedrock : TILE.Floor;
  context.height[index] = wall ? WALL_RISE : 0;
  clearFeature(context, index);
}

function stampGate(
  context: MiniBossArenaStamp,
  gate: MiniBossArenaSite["gates"][number],
): void {
  const index = localIndex(context, gate.x, gate.y);
  context.tiles[index] = TILE.Floor;
  context.height[index] = 0;
  context.featureTiles[index] = TILE.ArenaGate;
  context.featureFaces[index] = gate.featureFace;
  context.featureHeight[index] = 0;
}

function stampGateApproach(
  context: MiniBossArenaStamp,
  gate: MiniBossArenaSite["gates"][number],
): void {
  const point = gateOutsideTile(gate);
  const index = localIndex(context, point.x, point.y);
  context.tiles[index] = TILE.Floor;
  context.height[index] = 0;
  clearFeature(context, index);
}

function gateOutsideTile(
  gate: MiniBossArenaSite["gates"][number],
): { readonly x: number; readonly y: number } {
  return {
    x: Math.floor(gate.outside.x),
    y: Math.floor(gate.outside.y),
  };
}

function stampPlatform(
  context: MiniBossArenaStamp,
  platform: MiniBossArenaSite["platforms"][number],
): void {
  for (let dy = 0; dy < platform.screenDepthTiles; dy++) {
    stampPlatformCell(context, platform, platform.y + dy);
  }
}

function stampPlatformCell(
  context: MiniBossArenaStamp,
  platform: MiniBossArenaSite["platforms"][number],
  worldY: number,
): void {
  const index = localIndex(context, platform.x, worldY);
  context.tiles[index] = TILE.Floor;
  context.height[index] = platform.height;
  clearFeature(context, index);
}

function clearFeature(context: MiniBossArenaStamp, index: number): void {
  context.featureTiles[index] = TILE.Floor;
  context.featureFaces[index] = FEATURE_FACE.Top;
  context.featureHeight[index] = 0;
}

function localIndex(
  context: Pick<MiniBossArenaStamp, "cx" | "cy">,
  worldX: number,
  worldY: number,
): number {
  const x = worldX - context.cx * CHUNK_SIZE;
  const y = worldY - context.cy * CHUNK_SIZE;
  return y * CHUNK_SIZE + x;
}
