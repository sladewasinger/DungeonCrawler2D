// VFX facade: owns every particle/juice subsystem and exposes the small trigger surface
// scenes call into — area hazards, torch flames, player motion feel, and combat juice.
import type Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import type { LightSource } from "../render/lighting/lightSource.js";
import { AreaEffectPool, type AreaTileView } from "./areaEffectPool.js";
import { bloodTintFor } from "./bloodTint.js";
import { BloodDecalPool } from "./bloodDecalPool.js";
import { spawnDeathSplatter, spawnHitSplatter } from "./bloodSplatter.js";
import { BossDownFlourish } from "./bossDownFlourish.js";
import { CorpseDecalPool } from "./corpseDecalPool.js";
import { DamageNumberPool } from "./damageNumbers.js";
import { FloorBanner } from "./floorBanner.js";
import { spawnFistbumpFlourish } from "./fistbumpFlourish.js";
import { spawnGibBurst } from "./gibBurst.js";
import { HIT_STOP_DURATION_MS, HIT_STOP_ZOOM } from "./hitStop.js";
import { LevelUpFlourish } from "./levelUpFlourish.js";
import { TeleportFade } from "./teleportFade.js";
import { lowHpVignetteAlpha } from "./lowHpVignette.js";
import { LowHpOverlay } from "./lowHpOverlay.js";
import { MeleeWedgePool } from "./meleeWedge.js";
import { spawnDustPuff, spawnFootstepMote, spawnRunDust } from "./movementParticles.js";
import { footstepDue, isMoving, isRunning, motionEvents, type MotionSample } from "./motionFx.js";
import { spawnPickupGlint } from "./pickupGlint.js";
import { ScreenShakeBudget } from "./screenShake.js";
import { TorchFlamePool } from "./torchFlames.js";
import { XpNumberPool } from "./xpNumbers.js";

export type { AreaSpriteKind, AreaTileView } from "./areaEffectPool.js";

export class VfxSystem {
  private readonly areas: AreaEffectPool;
  private readonly torchFlames: TorchFlamePool;
  private readonly damageNumbers: DamageNumberPool;
  private readonly xpNumbers: XpNumberPool;
  private readonly meleeWedge: MeleeWedgePool;
  private readonly shake: ScreenShakeBudget;
  private readonly bloodDecals: BloodDecalPool;
  private readonly corpseDecals: CorpseDecalPool;
  private readonly levelUpFlourish: LevelUpFlourish;
  private readonly lowHpOverlay: LowHpOverlay;
  /** Epic 7.14: floor-entry title card, boss-death celebration, teleport fade-to-black. */
  private readonly floorBanner: FloorBanner;
  private readonly bossDownFlourish: BossDownFlourish;
  private readonly teleportFade: TeleportFade;
  private lastPlayerSample: MotionSample | undefined;
  private lastFrameMs = 0;
  private selfHpRatio = 1;

  constructor(private readonly scene: Phaser.Scene) {
    this.areas = new AreaEffectPool(scene);
    this.torchFlames = new TorchFlamePool(scene);
    this.damageNumbers = new DamageNumberPool(scene);
    this.xpNumbers = new XpNumberPool(scene);
    this.meleeWedge = new MeleeWedgePool(scene);
    this.shake = new ScreenShakeBudget(scene.cameras.main);
    this.bloodDecals = new BloodDecalPool(scene);
    this.corpseDecals = new CorpseDecalPool(scene);
    this.levelUpFlourish = new LevelUpFlourish(scene);
    this.lowHpOverlay = new LowHpOverlay(scene);
    this.floorBanner = new FloorBanner(scene);
    this.bossDownFlourish = new BossDownFlourish(scene);
    this.teleportFade = new TeleportFade(scene);
  }

  /** Rebuilds the active area-hazard rigs; returns their accent lights for LightingSystem.setAccentLights. */
  syncAreas(tiles: readonly AreaTileView[]): LightSource[] {
    return this.areas.sync(tiles);
  }

  syncTorchFlames(torches: readonly LightSource[]): void {
    this.torchFlames.sync(torches);
  }

  /** Feeds one frame of the tracked player's motion: fires dust/footstep edge triggers. */
  trackPlayerMotion(sample: MotionSample, nowMs: number): void {
    const prev = this.lastPlayerSample;
    const dt = (nowMs - this.lastFrameMs) / 1000;
    const moving = isMoving(prev, sample, dt);
    const running = isRunning(prev, sample, dt);
    const events = motionEvents(prev, sample);
    this.fireMotionParticles(sample, events, moving, running, nowMs);
    this.lastPlayerSample = sample;
    this.lastFrameMs = nowMs;
  }

  private fireMotionParticles(
    sample: MotionSample,
    events: readonly string[],
    moving: boolean,
    running: boolean,
    nowMs: number,
  ): void {
    const screen = worldToScreen(sample.x, sample.y);
    if (events.includes("jumped") || events.includes("turned")) spawnDustPuff(this.scene, screen.x, screen.y, 5);
    if (events.includes("landed")) spawnDustPuff(this.scene, screen.x, screen.y, 8);
    if (!footstepDue(this.lastFrameMs, nowMs, !sample.air, moving)) return;
    if (running) spawnRunDust(this.scene, screen.x, screen.y);
    else spawnFootstepMote(this.scene, screen.x, screen.y);
  }

  spawnDamageNumber(worldX: number, worldY: number, amount: number, nowMs: number, heal = false): void {
    const screen = worldToScreen(worldX, worldY);
    this.damageNumbers.spawn(screen.x, screen.y, amount, nowMs, heal);
  }

  spawnPickupGlint(worldX: number, worldY: number): void {
    const screen = worldToScreen(worldX, worldY);
    spawnPickupGlint(this.scene, screen.x, screen.y);
  }

  /** Fistbump-sealed success flourish (Epic 7.10) — call once per side, above their head. */
  spawnFistbumpFlourish(worldX: number, worldY: number): void {
    const screen = worldToScreen(worldX, worldY - 1.3);
    spawnFistbumpFlourish(this.scene, screen.x, screen.y);
  }

  /** Melee-arc swing telegraph, keyed by attacker id so a fresh swing reuses (redraws)
   * that id's pooled Graphics rather than allocating a new one. `z` is the wielder's
   * absolute height — the wedge anchors at their lifted feet (meleeWedge.ts). */
  spawnMeleeSwing(id: string, worldX: number, worldY: number, z: number, angleRad: number, depth: number, tilePx: number, nowMs: number): void {
    this.meleeWedge.spawn(id, worldX, worldY, z, angleRad, depth, tilePx, nowMs);
  }

  /** Splatter + one floor decal for a landed hit (Epic 7.11) — directional when `dirX`/`dirY`
   * (a knockback vector) is available, otherwise an even spray. `defId` (enemy content id,
   * undefined for players) picks the blood tint via bloodTint.ts. `groundHeight` is the hit
   * position's `groundAt` — the decal is GROUND-anchored, shifted by that height (section 5). */
  spawnBloodHit(worldX: number, worldY: number, groundHeight: number, defId: string | undefined, nowMs: number, dirX?: number, dirY?: number): void {
    const screen = worldToScreen(worldX, worldY);
    const tint = bloodTintFor(defId);
    spawnHitSplatter(this.scene, screen.x, screen.y, tint, dirX, dirY);
    this.bloodDecals.spawn(worldX, worldY, groundHeight, tint, nowMs);
  }

  /** Heavier splatter + a scattered handful of floor decals for a death (Epic 7.11). */
  spawnBloodDeath(worldX: number, worldY: number, groundHeight: number, defId: string | undefined, nowMs: number): void {
    const screen = worldToScreen(worldX, worldY);
    const tint = bloodTintFor(defId);
    spawnDeathSplatter(this.scene, screen.x, screen.y, tint);
    for (let i = 0; i < 4; i++) this.bloodDecals.spawn(worldX, worldY, groundHeight, tint, nowMs);
  }

  onOwnHit(nowMs: number): void {
    this.shake.onOwnHit(nowMs);
  }

  onOwnDeath(nowMs: number): void {
    this.shake.onOwnDeath(nowMs);
  }

  /** The full kill moment (wave-7 GRINDER demand): a chunkier gib burst than an
   * ordinary death, a brief corpse/bone decal, a kill-weight micro-shake, and a
   * ~60ms camera zoom-punch (hitStop.ts) so the kill reads with impact — a true
   * engine-wide time-scale pause would touch fixedStep.ts's simulation stepping
   * (another lane's file), so this fakes the same snap at the camera layer.
   * Enemy deaths only — call sites gate this to `kind === "enemy"`, ordinary
   * player deaths keep the plain blood-splatter treatment (spawnBloodDeath). */
  spawnKillMoment(worldX: number, worldY: number, groundHeight: number, defId: string | undefined, nowMs: number): void {
    const screen = worldToScreen(worldX, worldY);
    spawnGibBurst(this.scene, screen.x, screen.y, bloodTintFor(defId));
    this.corpseDecals.spawn(worldX, worldY, groundHeight, nowMs);
    this.shake.onKillMoment(nowMs);
    this.punchCamera();
  }

  private punchCamera(): void {
    const camera = this.scene.cameras.main;
    camera.zoomTo(HIT_STOP_ZOOM, HIT_STOP_DURATION_MS / 2, "Sine.easeOut", true, (_cam, progress) => {
      if (progress === 1) camera.zoomTo(1, HIT_STOP_DURATION_MS / 2, "Sine.easeIn");
    });
  }

  /** Floating "+N XP" above the self player — a kill's XP gain has no landed-hit
   * world position of its own (net/xpEvents.ts diffs the self snapshot only). */
  spawnXpNumber(amount: number, nowMs: number): void {
    const sample = this.lastPlayerSample;
    if (!sample) return;
    const screen = worldToScreen(sample.x, sample.y - 1);
    this.xpNumbers.spawn(screen.x, screen.y, amount, nowMs);
  }

  spawnLevelUpFlourish(level: number, nowMs: number): void {
    this.levelUpFlourish.trigger(level, nowMs);
  }

  /** Floor-entry title card (Epic 7.14) — "FLOOR N" + the announcer's line. */
  spawnFloorBanner(floor: number, line: string, nowMs: number): void {
    this.floorBanner.trigger(floor, line, nowMs);
  }

  /** Boss-death celebration (Epic 7.14) — red flash + "<NAME> FALLS". */
  spawnBossDownFlourish(bossName: string, nowMs: number): void {
    this.bossDownFlourish.trigger(bossName, nowMs);
  }

  /** Fade-through-black on any server teleport (Epic 7.14) — doors today, stairways once wired. */
  spawnTeleportFade(nowMs: number): void {
    this.teleportFade.trigger(nowMs);
  }

  /** Feeds the low-hp vignette its current ratio — call once per frame regardless
   * of whether hp changed, since the heartbeat throb animates continuously. */
  setSelfHp(hp: number, maxHp: number): void {
    this.selfHpRatio = maxHp > 0 ? Math.max(0, hp) / maxHp : 0;
  }

  /** Advances every per-frame subsystem (damage numbers rise/fade, wedge telegraphs fade). */
  update(nowMs: number): void {
    this.damageNumbers.update(nowMs);
    this.xpNumbers.update(nowMs);
    this.meleeWedge.update(nowMs);
    this.bloodDecals.update(nowMs);
    this.corpseDecals.update(nowMs);
    this.levelUpFlourish.update(nowMs);
    this.lowHpOverlay.update(lowHpVignetteAlpha(this.selfHpRatio, nowMs));
    this.floorBanner.update(nowMs);
    this.bossDownFlourish.update(nowMs);
    this.teleportFade.update(nowMs);
  }

  dispose(): void {
    this.areas.dispose();
    this.torchFlames.dispose();
    this.damageNumbers.dispose();
    this.xpNumbers.dispose();
    this.meleeWedge.dispose();
    this.bloodDecals.dispose();
    this.corpseDecals.dispose();
    this.levelUpFlourish.dispose();
    this.lowHpOverlay.dispose();
    this.floorBanner.dispose();
    this.bossDownFlourish.dispose();
    this.teleportFade.dispose();
  }
}
