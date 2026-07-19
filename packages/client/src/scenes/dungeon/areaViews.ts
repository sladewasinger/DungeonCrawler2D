// Maps Connection.areaTiles ("x,y" -> area defId) into vfx/index.ts's AreaTileView
// list, resolving each area's sprite kind from content/areas.json instead of a second
// hardcoded id->sprite table.
import { areasData } from "@dc2d/content";
import type { AreaSpriteKind, AreaTileView } from "../../vfx/index.js";

interface AreaDef {
  readonly id: string;
  readonly sprite: AreaSpriteKind;
}

function isAreaDef(value: unknown): value is AreaDef {
  const record = value as Partial<AreaDef>;
  return typeof record?.id === "string" && typeof record?.sprite === "string";
}

const spriteByAreaId = new Map<string, AreaSpriteKind>(
  (areasData as readonly unknown[]).filter(isAreaDef).map((def) => [def.id, def.sprite]),
);

/** Parses a Connection.areaTiles key ("x,y") back into tile coordinates. */
function parseTileKey(key: string): { x: number; y: number } {
  const [xs, ys] = key.split(",");
  return { x: Number(xs), y: Number(ys) };
}

export function buildAreaTileViews(areaTiles: ReadonlyMap<string, string>): AreaTileView[] {
  const views: AreaTileView[] = [];
  for (const [key, defId] of areaTiles) {
    const sprite = spriteByAreaId.get(defId);
    if (!sprite) continue;
    const { x, y } = parseTileKey(key);
    views.push({ id: key, x: x + 0.5, y: y + 0.5, sprite });
  }
  return views;
}
