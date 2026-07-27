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
  return buildAreaTileViewsInto({ areaTiles, bounds, marginPx, views: [], records: [] });
}

export interface AreaTileViewFrame {
  readonly areaTiles: ReadonlyMap<string, string>;
  readonly bounds: AreaViewBounds | undefined;
  readonly marginPx: number;
  readonly views: AreaTileView[];
  readonly records: AreaTileView[];
}

export function buildAreaTileViewsInto(frame: AreaTileViewFrame): AreaTileView[] {
  const { areaTiles, bounds, marginPx, views, records } = frame;
  let count = 0;
  for (const [key, defId] of areaTiles) {
    const sprite = spriteByAreaId.get(defId);
    if (!sprite) continue;
    const { x, y } = parseTileKey(key);
    if (!visibleAt({ x, y, bounds, marginPx })) continue;
    const view = updateAreaView(records[count], { key, defId, x, y, sprite });
    records[count] = view;
    views[count] = view;
    count++;
  }
  views.length = count;
  return views;
}

function visibleAt(input: { readonly x: number; readonly y: number; readonly bounds: AreaViewBounds | undefined; readonly marginPx: number }): boolean {
  const { x, y, bounds, marginPx } = input;
  if (!bounds) return true;
  const screen = worldToScreen(x + 0.5, y + 0.5);
  return screen.x >= bounds.x - marginPx && screen.x <= bounds.right + marginPx &&
    screen.y >= bounds.y - marginPx && screen.y <= bounds.bottom + marginPx;
}

function updateAreaView(target: AreaTileView | undefined, input: { readonly key: string; readonly defId: string; readonly x: number; readonly y: number; readonly sprite: AreaSpriteKind }): AreaTileView {
  const view = target ?? {} as AreaTileView;
  view.id = input.key; view.effectId = input.defId;
  view.x = input.x + 0.5; view.y = input.y + 0.5; view.sprite = input.sprite;
  return view;
}
