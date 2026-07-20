// Converts live bench state into the exact view shapes the REAL renderer consumes
// (render/entities + vfx/areaEffectPool) — the bench drives that renderer, it never
// reimplements it. Area sprite kinds read off the content registry's own `sprite`
// field, the same source the live dungeon scene's areaViews.ts resolves from.
import type { AreaTileView, AreaSpriteKind } from "../../../vfx/index.js";
import type { ItemEntityView, MonsterEntityView } from "../../../render/entities/index.js";
import { groundItemFrame } from "../../dungeon/itemFrame.js";
import { DUMMY_NAME } from "./dummy.js";
import type { BenchState } from "./state.js";

/** Assumption #62: the id folds in defId (not just "x,y") so a same-tile meeting (oil
 * catching fire, fire+wet becoming steam — system.ts's AREA_MEETS) reads as a fresh
 * tile to AreaEffectPool.sync, which only rebuilds a rig for an id it hasn't seen
 * before; a bare position id would let it keep reusing the old sprite kind's rig. */
export function benchAreaTileViews(state: BenchState): AreaTileView[] {
  const out: AreaTileView[] = [];
  for (const tile of state.areas.allTiles()) {
    const def = state.content.areas.get(tile.defId);
    if (!def) continue;
    out.push({ id: `${tile.x},${tile.y}:${tile.defId}`, x: tile.x + 0.5, y: tile.y + 0.5, sprite: def.sprite as AreaSpriteKind });
  }
  return out;
}

function dummyView(state: BenchState): MonsterEntityView {
  const dummy = state.dummy;
  return {
    id: dummy.id,
    defId: "training-dummy",
    name: dummy.name ?? DUMMY_NAME,
    x: dummy.body.x,
    y: dummy.body.y,
    z: dummy.body.z,
    hp: dummy.hp,
    maxHp: dummy.maxHp,
    fx: dummy.statuses.map((s) => s.defId),
    anim: "idle",
    faceX: 1,
    air: false,
  };
}

export function benchMonsterViews(state: BenchState): MonsterEntityView[] {
  const out: MonsterEntityView[] = [];
  for (const enemy of state.enemies.values()) {
    out.push({
      id: enemy.entity.id,
      defId: enemy.entity.defId ?? "",
      name: enemy.def.name,
      x: enemy.entity.body.x,
      y: enemy.entity.body.y,
      z: enemy.entity.body.z,
      hp: enemy.entity.hp,
      maxHp: enemy.entity.maxHp,
      fx: enemy.entity.statuses.map((s) => s.defId),
      anim: "idle",
      faceX: enemy.entity.facing?.x ?? 1,
      air: !enemy.entity.body.grounded,
    });
  }
  out.push(dummyView(state));
  return out;
}

export function benchItemViews(state: BenchState): ItemEntityView[] {
  return [...state.items.values()].map((item) => ({ id: item.id, x: item.x, y: item.y, frame: groundItemFrame(item.defId) }));
}
