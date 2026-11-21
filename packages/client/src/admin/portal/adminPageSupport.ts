import type { AdminPalette } from "@dc2d/engine";

export type AdminSpawnKind = "enemy" | "item" | "weapon" | "pet";

export function paletteDefinitions(
  palette: AdminPalette,
  kind: AdminSpawnKind,
): readonly string[] {
  if (kind === "enemy") return palette.enemies;
  if (kind === "item") return palette.items;
  return kind === "weapon" ? palette.weapons : palette.pets;
}

export function boundedAdminFloor(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 64 ? parsed : fallback;
}
