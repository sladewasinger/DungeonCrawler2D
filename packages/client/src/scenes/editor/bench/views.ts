// Converts live bench state into the exact view shapes the production entity and VFX
// renderers consume, keeping the offline bench on the same presentation contracts.
import type { AreaTileView, AreaSpriteKind } from "../../../vfx/index.js";
import type { ItemEntityView, MonsterEntityView, ProjectileEntityView } from "../../../render/entities/index.js";
import { groundItemFrame } from "../../dungeon/itemFrame.js";
import { DUMMY_NAME } from "./dummy.js";
import type { BenchState } from "./state.js";

/** Stable tile ids plus the separate content effect id exercise the live rig-rebuild contract. */
export function benchAreaTileViews(state: BenchState): AreaTileView[] {
  const out: AreaTileView[] = [];
  for (const tile of state.areas.allTiles()) {
    const def = state.content.areas.get(tile.defId);
    if (!def) continue;
    out.push({ id: `${tile.x},${tile.y}`, effectId: tile.defId, x: tile.x + 0.5, y: tile.y + 0.5, sprite: def.sprite as AreaSpriteKind });
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
  return [...state.items.values()].map((item) => ({
    id: item.id,
    x: item.x,
    y: item.y,
    z: 0,
    frame: groundItemFrame(item.defId),
  }));
}

/** Adapts live bench projectiles to the exact view consumed by EntityRenderer.syncProjectiles. */
export function benchProjectileViews(state: BenchState): ProjectileEntityView[] {
  return [...state.projectiles.values()].map(({ entity }) => {
    const velocity = entity.vel ?? { x: 0, y: 0 };
    return { id: entity.id, x: entity.body.x, y: entity.body.y, frame: groundItemFrame(entity.defId), vx: velocity.x, vy: velocity.y };
  });
}
