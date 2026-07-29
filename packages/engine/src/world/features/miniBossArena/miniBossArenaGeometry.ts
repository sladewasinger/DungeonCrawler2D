import { hash2D, mixSeeds } from "../../../core/rng.js";
import { FEATURE_FACE, type FeatureFace } from "../../core/types.js";
import { populationRoomsForChunk } from "../../generate/populationRooms.js";
import { WORLD_GENERATION_TUNING } from "../../generate/tuning.js";
import type {
  MiniBossArenaBounds,
  MiniBossArenaChunk,
  MiniBossArenaGate,
  MiniBossArenaSite,
} from "./miniBossArena.js";

const TUNING = WORLD_GENERATION_TUNING.miniBossArena;
const GATE_SALT = 0x6a7e;

export function arenaBoundsForChunk(
  chunk: MiniBossArenaChunk,
  roll: number,
): MiniBossArenaBounds | null {
  const span = TUNING.outerSpan;
  const rooms = populationRoomsForChunk(chunk).filter((room) =>
    room.x1 - room.x0 + 1 >= span && room.y1 - room.y0 + 1 >= span
  );
  if (rooms.length === 0) return null;
  const room = rooms[roll % rooms.length];
  if (!room) return null;
  const centerX = Math.floor((room.x0 + room.x1) / 2);
  const centerY = Math.floor((room.y0 + room.y1) / 2);
  const half = Math.floor(span / 2);
  return {
    x0: centerX - half,
    y0: centerY - half,
    x1: centerX + half,
    y1: centerY + half,
  };
}

export function buildMiniBossArenaSite(
  chunk: MiniBossArenaChunk,
  bounds: MiniBossArenaBounds,
): MiniBossArenaSite {
  const center = {
    x: Math.floor((bounds.x0 + bounds.x1) / 2),
    y: Math.floor((bounds.y0 + bounds.y1) / 2),
  };
  return {
    key: `${chunk.floor}:${chunk.cx},${chunk.cy}`,
    chunk: { cx: chunk.cx, cy: chunk.cy },
    bounds,
    interior: inset(bounds),
    center,
    gates: chooseGates({ chunk, bounds, center }),
  };
}

function inset(bounds: MiniBossArenaBounds): MiniBossArenaBounds {
  return {
    x0: bounds.x0 + 1,
    y0: bounds.y0 + 1,
    x1: bounds.x1 - 1,
    y1: bounds.y1 - 1,
  };
}

interface GateSelection {
  readonly chunk: MiniBossArenaChunk;
  readonly bounds: MiniBossArenaBounds;
  readonly center: { readonly x: number; readonly y: number };
}

function chooseGates(input: GateSelection): readonly MiniBossArenaGate[] {
  const { chunk, bounds, center } = input;
  const seed = mixSeeds(chunk.worldSeed, chunk.floor, GATE_SALT);
  const roll = hash2D(seed, chunk.cx, chunk.cy);
  const count = TUNING.minimumGates +
    roll % (TUNING.maximumGates - TUNING.minimumGates + 1);
  const candidates = gateCandidates(bounds, center);
  const start = Math.floor(roll / 7) % candidates.length;
  const stride = roll % 2 === 0 ? 1 : 3;
  return selectedGates({ candidates, count, start, stride });
}

interface GateIndexes {
  readonly candidates: readonly MiniBossArenaGate[];
  readonly count: number;
  readonly start: number;
  readonly stride: number;
}

function selectedGates(input: GateIndexes): MiniBossArenaGate[] {
  const selected: MiniBossArenaGate[] = [];
  for (let index = 0; index < input.count; index++) {
    const candidateIndex =
      (input.start + index * input.stride) % input.candidates.length;
    const candidate = input.candidates[candidateIndex];
    if (candidate) selected.push(candidate);
  }
  return selected;
}

function gateCandidates(
  bounds: MiniBossArenaBounds,
  center: { readonly x: number; readonly y: number },
): readonly MiniBossArenaGate[] {
  return [
    gate({ x: center.x, y: bounds.y0, face: FEATURE_FACE.North, dx: 0, dy: 1 }),
    gate({ x: bounds.x1, y: center.y, face: FEATURE_FACE.East, dx: -1, dy: 0 }),
    gate({ x: center.x, y: bounds.y1, face: FEATURE_FACE.South, dx: 0, dy: -1 }),
    gate({ x: bounds.x0, y: center.y, face: FEATURE_FACE.West, dx: 1, dy: 0 }),
  ];
}

interface GatePlacement {
  readonly x: number;
  readonly y: number;
  readonly face: FeatureFace;
  readonly dx: number;
  readonly dy: number;
}

function gate(input: GatePlacement): MiniBossArenaGate {
  const { x, y, face, dx, dy } = input;
  return {
    x,
    y,
    featureFace: face,
    inside: { x: x + dx + 0.5, y: y + dy + 0.5 },
    outside: { x: x - dx + 0.5, y: y - dy + 0.5 },
  };
}
