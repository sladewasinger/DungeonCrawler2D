import { BIOME, type BiomeKind } from "@dc2d/engine";

const BIOME_LABELS: Readonly<Record<BiomeKind, string>> = {
  [BIOME.Maze]: "Maze",
  [BIOME.OpenHalls]: "Open Halls",
  [BIOME.Ruins]: "Ruins",
  [BIOME.Pillars]: "Pillar Forest",
  [BIOME.Pools]: "Flooded Pools",
  [BIOME.Arena]: "Arena",
};

export const biomeLabel = (biome: BiomeKind): string => BIOME_LABELS[biome];

export function aimHeadingDegrees(
  origin: { x: number; y: number },
  target: { x: number; y: number },
): number {
  const degrees = Math.atan2(target.x - origin.x, origin.y - target.y) * 180 / Math.PI;
  return Math.round((degrees + 360) % 360);
}
