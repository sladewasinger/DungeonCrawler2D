/** Authoritative harvestable prop HP tracking, tool-gated gathering drops, and stump/node regrowth. */
import {
  PropKind, WorldChunkCache, computeHarvestDamage, getHarvestNodeSpec, isWithinSector, propFootprintCenter,
  rollHarvestDrops, sampleMacroBiome, worldToChunkCoord, type ChunkProp, type DepletedPropDelta, type HarvestToolKind, type WorldEvent,
} from "@dc2d/engine";
import type { LootManager } from "../wildlife/loot/lootManager.js";

function resourceCategoryCode(tool: HarvestToolKind): { readonly substance: "stone" | "straw"; readonly comboStep: number } {
  if (tool === "stone") return { substance: "stone", comboStep: 2 };
  if (tool === "wood") return { substance: "straw", comboStep: 1 };
  return { substance: "straw", comboStep: 3 };
}

function oreVariantCode(kind: PropKind): number {
  if (kind === PropKind.CopperVein) return 1;
  if (kind === PropKind.IronVein) return 2;
  return 0;
}

export class ResourceHarvester {
  private readonly hpByProp = new Map<string, number>();
  private readonly depleted = new Map<string, DepletedPropDelta>();

  private findTargetProp(opts: {
    readonly cache: WorldChunkCache; readonly x: number; readonly y: number;
    readonly dirX: number; readonly dirY: number; readonly range: number; readonly halfArcRad: number;
  }): ChunkProp | null {
    let best: ChunkProp | null = null;
    let bestDist = Infinity;
    for (const prop of opts.cache.propsNear(opts.x, opts.y)) {
      if (!getHarvestNodeSpec(prop.kind)) continue;
      const center = propFootprintCenter(prop);
      const effRange = opts.range + prop.radius + 0.15;
      const dist = Math.hypot(center.x - opts.x, center.y - opts.y);
      if (dist > effRange || dist >= bestDist) continue;
      const sectorOk = isWithinSector({
        origin: { x: opts.x, y: opts.y }, dir: { x: opts.dirX, y: opts.dirY },
        target: center, range: effRange, halfArcRad: Math.max(opts.halfArcRad, 0.78),
      });
      if (!sectorOk) continue;
      bestDist = dist;
      best = prop;
    }
    return best;
  }

  hitHarvestableInSector(opts: {
    readonly cache: WorldChunkCache; readonly loot: LootManager;
    readonly attacker: { readonly id: string; readonly x: number; readonly y: number; readonly aimX: number; readonly aimY: number };
    readonly range: number; readonly halfArcRad: number; readonly toolKind: HarvestToolKind; readonly toolPower: number;
    readonly timeSec: number; readonly events: WorldEvent[];
  }): boolean {
    const prop = this.findTargetProp({
      cache: opts.cache, x: opts.attacker.x, y: opts.attacker.y,
      dirX: opts.attacker.aimX, dirY: opts.attacker.aimY, range: opts.range, halfArcRad: opts.halfArcRad,
    });
    if (!prop) return false;
    const spec = getHarvestNodeSpec(prop.kind);
    if (!spec) return false;
    const dmg = computeHarvestDamage({ nodeKind: prop.kind, toolKind: opts.toolKind, toolPower: opts.toolPower });
    if (dmg <= 0) {
      opts.events.push({ kind: "arrowRicochet", x: prop.x, y: prop.y, dirX: -opts.attacker.aimX, dirY: -opts.attacker.aimY, actorId: opts.attacker.id });
      return true;
    }
    this.applyNodeDamage({ prop, dmg, spec, ...opts });
    return true;
  }

  private recordPartialHp(propId: string, remaining: number): void {
    if (!this.hpByProp.has(propId) && this.hpByProp.size >= 1024) {
      const oldest = this.hpByProp.keys().next().value;
      if (oldest !== undefined) this.hpByProp.delete(oldest);
    }
    this.hpByProp.set(propId, remaining);
  }

  private applyNodeDamage(opts: {
    readonly prop: ChunkProp; readonly dmg: number; readonly spec: NonNullable<ReturnType<typeof getHarvestNodeSpec>>;
    readonly cache: WorldChunkCache; readonly loot: LootManager;
    readonly attacker: { readonly id: string; readonly aimX: number; readonly aimY: number };
    readonly timeSec: number; readonly events: WorldEvent[];
  }): void {
    const { prop, dmg, spec, cache, loot, attacker, timeSec, events } = opts;
    const remaining = (this.hpByProp.get(prop.id) ?? spec.maxHp) - dmg;
    const meta = resourceCategoryCode(spec.requiredTool);
    const sweepDir = oreVariantCode(prop.kind);
    if (remaining > 0) {
      this.recordPartialHp(prop.id, remaining);
      events.push({ kind: "harvestHit", x: prop.x, y: prop.y, dirX: attacker.aimX, dirY: attacker.aimY, value: dmg, actorId: attacker.id, ...meta, sweepDir });
      return;
    }
    this.hpByProp.delete(prop.id);
    const delta: DepletedPropDelta = {
      propId: prop.id, replacementKind: spec.replacementKind, regrowAtSec: timeSec + spec.regrowSec,
      cx: worldToChunkCoord(Math.floor(prop.x)), cy: worldToChunkCoord(Math.floor(prop.y)),
    };
    this.depleted.set(prop.id, delta);
    cache.setDepletedProp(delta);
    events.push({ kind: "harvestBreak", x: prop.x, y: prop.y, dirX: attacker.aimX, dirY: attacker.aimY, value: spec.maxHp, actorId: attacker.id, ...meta, sweepDir });
    const drops = rollHarvestDrops(prop.kind);
    if (prop.kind === PropKind.IronVein && sampleMacroBiome(cache.worldSeed, prop.x, prop.y) === "craggy-highlands" && Math.random() < 0.3) {
      drops.push({ itemId: "sunstone", count: 1 });
    }
    drops.forEach((drop, idx) => {
      const ang = idx * 2.1 + Math.random() * 1.4;
      loot.spawnLoot({ itemId: drop.itemId, count: drop.count, x: prop.x, y: prop.y, vx: Math.cos(ang) * 1.9, vy: Math.sin(ang) * 1.9 });
    });
  }

  stepRegrowth(timeSec: number, cache: WorldChunkCache): void {
    for (const [propId, delta] of this.depleted) {
      if (timeSec < delta.regrowAtSec) continue;
      this.depleted.delete(propId);
      cache.restoreProp(propId);
    }
  }

  exportDepleted(): readonly DepletedPropDelta[] {
    return Array.from(this.depleted.values());
  }

  importDepleted(list: readonly DepletedPropDelta[], cache: WorldChunkCache): void {
    this.depleted.clear();
    this.hpByProp.clear();
    for (const d of list) {
      this.depleted.set(d.propId, d);
      cache.setDepletedProp(d);
    }
  }
}
