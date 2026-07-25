// Maps Connection.areaTiles ("x,y" -> area defId) into vfx/index.ts's AreaTileView
// list, resolving each area's sprite kind from content/areas.json instead of a second
// hardcoded id->sprite table.
import { areasData } from "@dc2d/content";
import type { AreaSpriteKind, AreaTileView } from "../../vfx/index.js";
import { worldToScreen } from "../../render/entities/worldToScreen.js";

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

export interface AreaViewBounds {
  readonly x: number;
  readonly y: number;
  readonly right: number;
  readonly bottom: number;
}

export function buildAreaTileViews(
  areaTiles: ReadonlyMap<string, string>,
  bounds?: AreaViewBounds,
  marginPx = 0,
): AreaTileView[] {
  return buildAreaTileViewsInto(areaTiles, bounds, marginPx, [], []);
}

export function buildAreaTileViewsInto(
  areaTiles: ReadonlyMap<string, string>,
  bounds: AreaViewBounds | undefined,
  marginPx: number,
  views: AreaTileView[],
  records: AreaTileView[],
): AreaTileView[] {
  let count = 0;
  for (const [key, defId] of areaTiles) {
    const sprite = spriteByAreaId.get(defId);
    if (!sprite) continue;
    const { x, y } = parseTileKey(key);
    if (bounds) {
      const screen = worldToScreen(x + 0.5, y + 0.5);
      if (screen.x < bounds.x - marginPx || screen.x > bounds.right + marginPx ||
        screen.y < bounds.y - marginPx || screen.y > bounds.bottom + marginPx) continue;
    }
    const view = records[count] ?? {
      id: key,
      effectId: defId,
      x: x + 0.5,
      y: y + 0.5,
      sprite,
    };
    view.id = key;
    view.effectId = defId;
    view.x = x + 0.5;
    view.y = y + 0.5;
    view.sprite = sprite;
    records[count] = view;
    views[count] = view;
    count++;
  }
  views.length = count;
  return views;
}
