/** Renders bouncy resource harvest chips, leaves/sparks, structure build puffs, and bed-set pulses. */
import { TILE_PX, type PlayerSnapshot, type WorldEvent } from "@dc2d/engine";
import { Container, Graphics } from "pixi.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";

interface ChipParticle {
  readonly g: Graphics;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  ttl: number;
}

interface RingEffect {
  readonly g: Graphics;
  readonly color: number;
  age: number;
  ttl: number;
}

const WOOD_COLORS = [0x8a5a36, 0x683f22, 0xcfa067, 0x4a8742] as const;
const STONE_COLORS = [0x64748b, 0x94a3b8, 0x475569] as const;
const COPPER_COLORS = [0xf59e0b, 0xc2591b, 0x94a3b8] as const;
const IRON_COLORS = [0xe2e8f0, 0x94a3b8, 0x475569] as const;
const FORAGE_COLORS = [0x4ade80, 0x22c55e, 0xef4444, 0xfbbf24] as const;

function pickPalette(ev: WorldEvent): readonly number[] {
  if (ev.comboStep === 2) return ev.sweepDir === 1 ? COPPER_COLORS : ev.sweepDir === 2 ? IRON_COLORS : STONE_COLORS;
  if (ev.comboStep === 3) return FORAGE_COLORS;
  return WOOD_COLORS;
}

export class HarvestFxLayer {
  readonly container = new Container();
  private readonly chips: ChipParticle[] = [];
  private readonly rings: RingEffect[] = [];

  handleEvents(events: readonly WorldEvent[], players: readonly PlayerSnapshot[], fallbackElev = 0): void {
    for (const ev of events) {
      if (ev.kind === "harvestHit" || ev.kind === "harvestBreak") {
        this.spawnChips(ev, players, fallbackElev);
      } else if (ev.kind === "placeStructure" || ev.kind === "bedSet") {
        this.spawnRing(ev, fallbackElev, ev.kind === "bedSet" ? 0x4ade80 : 0xfde047);
      }
    }
  }

  private resolveElev(ev: WorldEvent, players: readonly PlayerSnapshot[], fallbackElev: number): number {
    const actor = ev.actorId ? players.find((p) => p.id === ev.actorId) : undefined;
    return actor?.elevation ?? fallbackElev;
  }

  private spawnChips(ev: WorldEvent, players: readonly PlayerSnapshot[], fallbackElev: number): void {
    const pal = pickPalette(ev);
    const count = ev.kind === "harvestBreak" ? 12 : 6;
    const baseY = ev.y * TILE_PX - this.resolveElev(ev, players, fallbackElev) * ELEVATION_LIFT_PX - 6;
    const baseX = ev.x * TILE_PX;
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const color = pal[i % pal.length]!;
      const sz = i % 2 === 0 ? 2.4 : 1.7;
      g.rect(-sz * 0.5, -sz * 0.5, sz, sz).fill(color);
      this.container.addChild(g);
      const ang = (ev.dirX || ev.dirY ? Math.atan2(ev.dirY ?? 0, ev.dirX ?? 1) : 0) + (Math.random() - 0.5) * 2.4;
      const spd = 28 + Math.random() * 48;
      this.chips.push({ g, x: baseX, y: baseY, z: 3 + Math.random() * 6, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd * 0.65, vz: 38 + Math.random() * 44, age: 0, ttl: 0.38 + Math.random() * 0.25 });
    }
  }

  private spawnRing(ev: WorldEvent, fallbackElev: number, color: number): void {
    const g = new Graphics();
    g.position.set(ev.x * TILE_PX, ev.y * TILE_PX - fallbackElev * ELEVATION_LIFT_PX - 3);
    this.container.addChild(g);
    this.rings.push({ g, color, age: 0, ttl: 0.45 });
  }

  private stepChips(dt: number): void {
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const c = this.chips[i]!;
      c.age += dt;
      if (c.age >= c.ttl) { c.g.destroy(); this.chips.splice(i, 1); continue; }
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.vz -= 210 * dt; c.z += c.vz * dt;
      if (c.z < 0) {
        c.z = 0; c.vz = -c.vz * 0.35; c.vx *= 0.65; c.vy *= 0.65;
      }
      c.g.position.set(c.x, c.y - c.z);
      c.g.alpha = Math.max(0, 1 - c.age / c.ttl);
    }
  }

  private stepRings(dt: number): void {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]!;
      r.age += dt;
      if (r.age >= r.ttl) { r.g.destroy(); this.rings.splice(i, 1); continue; }
      const t = r.age / r.ttl;
      r.g.clear().ellipse(0, 0, 5 + t * 14, 2.5 + t * 7).stroke({ color: r.color, width: 1.6, alpha: 1 - t });
    }
  }

  step(dt: number): void {
    this.stepChips(dt);
    this.stepRings(dt);
  }
}
