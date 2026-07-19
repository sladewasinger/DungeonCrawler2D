// VFX + lighting showcase for the gallery harness: hazard tiles (burning oil meeting a
// wet patch, a poison cloud), torch flame licks synced from LightingSystem, and combat
// juice (damage numbers, screen shake, dust/footstep) driven by the showcase player/row —
// proves the vfx system end-to-end without a live server.
import type { World } from "@dc2d/engine";
import type Phaser from "phaser";
import type { LightingSystem } from "../render/lighting/index.js";
import type { LightSource } from "../render/lighting/lightSource.js";
import { VfxSystem, type AreaTileView } from "../vfx/index.js";
import { DEMO_HIT_TICK_MS, demoSkeletonHp, showcaseMonsterSlot, SHOWCASE_ROW } from "./entityShowcaseLayout.js";
import { showcasePlayerPose } from "./showcasePlayerMotion.js";
import { HAZARD_TILES } from "./vfxShowcaseLayout.js";

const SHAKE_INTERVAL_MS = 2400;
const GLINT_INTERVAL_MS = 2200;

/** A standing arena-lantern glow over the combat row — every real encounter room has some light source; this demo's is implicit. */
const ARENA_LIGHT: LightSource = {
  id: "showcase-arena",
  x: SHOWCASE_ROW.baseX + 3,
  y: SHOWCASE_ROW.baseY,
  color: 0xff9e3d,
  radiusTiles: 5.5,
  kind: "torch",
  seed: 99,
};

/** Flattens the hand-placed HAZARD_TILES groups into the AreaTileView list AreaEffectPool expects. */
function hazardTiles(): AreaTileView[] {
  const groups: Array<{ sprite: AreaTileView["sprite"]; positions: readonly { x: number; y: number }[] }> = [
    { sprite: "oil", positions: HAZARD_TILES.oil },
    { sprite: "fire", positions: HAZARD_TILES.fire },
    { sprite: "steam", positions: HAZARD_TILES.steam },
    { sprite: "wet", positions: HAZARD_TILES.wet },
    { sprite: "poison", positions: HAZARD_TILES.poison },
  ];
  const tiles: AreaTileView[] = [];
  for (const group of groups) {
    for (const p of group.positions) tiles.push({ id: `hazard:${p.x},${p.y}`, x: p.x + 0.5, y: p.y + 0.5, sprite: group.sprite });
  }
  return tiles;
}

export class VfxShowcase {
  private readonly vfx: VfxSystem;
  private lastDamageTickMs = 0;
  private lastShakeMs = 0;
  private lastGlintMs = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
    private readonly lighting: LightingSystem,
  ) {
    this.vfx = new VfxSystem(scene);
  }

  update(nowMs: number): void {
    const hazardLights = this.vfx.syncAreas(hazardTiles());
    this.lighting.setAccentLights([...hazardLights, ARENA_LIGHT]);
    this.vfx.syncTorchFlames(this.lighting.activeTorches());
    this.trackPlayer(nowMs);
    this.tickDamageNumbers(nowMs);
    this.tickShake(nowMs);
    this.tickGlint(nowMs);
    this.vfx.update(nowMs);
  }

  /** Feeds the shared showcase-player trajectory into the vfx system for dust/footstep juice. */
  private trackPlayer(nowMs: number): void {
    const pose = showcasePlayerPose(this.world, nowMs, SHOWCASE_ROW.baseX, SHOWCASE_ROW.baseY - 3);
    this.vfx.trackPlayerMotion({ x: pose.x, y: pose.y, air: pose.air, faceX: pose.faceX }, nowMs);
  }

  /** Floating damage number timed to the skeleton's real hp dip (entityShowcaseLayout.ts's demoSkeletonHp) — the number, the hp bar, and the hit-flash all land on the same tick. */
  private tickDamageNumbers(nowMs: number): void {
    if (nowMs - this.lastDamageTickMs < DEMO_HIT_TICK_MS) return;
    this.lastDamageTickMs = nowMs;
    const hpBefore = demoSkeletonHp(nowMs - 1);
    const hpAfter = demoSkeletonHp(nowMs);
    if (hpAfter >= hpBefore) return;
    const slot = showcaseMonsterSlot(0);
    this.vfx.spawnDamageNumber(slot.x, slot.y - 0.6, hpBefore - hpAfter, nowMs);
  }

  /** Periodic small "own hit" screen shake, demonstrating the combat-moment juice budget. */
  private tickShake(nowMs: number): void {
    if (nowMs - this.lastShakeMs < SHAKE_INTERVAL_MS) return;
    this.lastShakeMs = nowMs;
    this.vfx.onOwnHit(nowMs);
  }

  /** Periodic pickup glint at the gallery's showcase ground-item tile. */
  private tickGlint(nowMs: number): void {
    if (nowMs - this.lastGlintMs < GLINT_INTERVAL_MS) return;
    this.lastGlintMs = nowMs;
    this.vfx.spawnPickupGlint(SHOWCASE_ROW.baseX, SHOWCASE_ROW.baseY + 2);
  }

  dispose(): void {
    this.vfx.dispose();
  }
}
