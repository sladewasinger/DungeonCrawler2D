// VFX facade: owns every particle/juice subsystem and exposes the small trigger surface
// scenes call into — area hazards, torch flames, player motion feel, and combat juice.
import type Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import type { LightSource } from "../render/lighting/lightSource.js";
import { AreaEffectPool, type AreaTileView } from "./areaEffectPool.js";
import { BossDownFlourish } from "./bossDownFlourish.js";
import { CombatEffects, type CarnageAppearance } from "./combatEffects.js";
import { DamageNumberPool } from "./damageNumbers.js";
import { FloorBanner } from "./floorBanner.js";
import { spawnFistbumpFlourish } from "./fistbumpFlourish.js";
import { GraceRing } from "./graceRing.js";
import { LevelUpFlourish } from "./levelUpFlourish.js";
import { TeleportFade } from "./teleportFade.js";
import { lowHpVignetteAlpha } from "./lowHpVignette.js";
import { LowHpOverlay } from "./lowHpOverlay.js";
import { MeleeSwingFx } from "./meleeSwingFx.js";
import { OutOfBreathFx } from "./outOfBreathFx.js";
import { PlayerMotionFx } from "./playerMotionFx.js";
import { spawnPickupGlint } from "./pickupGlint.js";
import { TorchFlamePool } from "./torchFlames.js";
import { WallBumpFx } from "./wallBumpFx.js";
import { XpNumberPool } from "./xpNumbers.js";

export type { AreaSpriteKind, AreaTileView } from "./areaEffectPool.js";

export class VfxSystem {
  private readonly areas: AreaEffectPool;
  private readonly torchFlames: TorchFlamePool;
  private readonly damageNumbers: DamageNumberPool;
  private readonly xpNumbers: XpNumberPool;
  /** Swing wedge telegraph + its whiff arc-fade counter-cue (panel round 3b item 5). */
  private readonly meleeSwingFx: MeleeSwingFx;
  /** Panel round 3b item 4 (WALL-BUMP FEEDBACK): sprite-nudge state + contact-point flash. */
  private readonly wallBumpFx: WallBumpFx;
  private readonly combat: CombatEffects;
  private readonly levelUpFlourish: LevelUpFlourish;
  private readonly lowHpOverlay: LowHpOverlay;
  /** Epic 7.14: floor-entry title card, boss-death celebration, teleport fade-to-black. */
  private readonly floorBanner: FloorBanner;
  private readonly bossDownFlourish: BossDownFlourish;
  private readonly teleportFade: TeleportFade;
  /** Panel round 4 (LANE B): self-only spawn-grace shield ring — public, unlike this
   * class's other pooled subsystems, since frameSync.ts drives it directly with the
   * self player's own render pose (no other subsystem needs a raw world position). */
  readonly graceRing: GraceRing;
  private readonly playerMotionFx: PlayerMotionFx;
  private readonly outOfBreathFx: OutOfBreathFx;
  private selfHpRatio = 1;

  constructor(private readonly scene: Phaser.Scene) {
    this.areas = new AreaEffectPool(scene);
    this.torchFlames = new TorchFlamePool(scene);
    this.damageNumbers = new DamageNumberPool(scene);
    this.xpNumbers = new XpNumberPool(scene);
    this.meleeSwingFx = new MeleeSwingFx(scene);
    this.wallBumpFx = new WallBumpFx(scene);
    this.combat = new CombatEffects(scene);
    this.levelUpFlourish = new LevelUpFlourish(scene);
    this.lowHpOverlay = new LowHpOverlay(scene);
    this.playerMotionFx = new PlayerMotionFx(scene);
    this.outOfBreathFx = new OutOfBreathFx(scene);
    this.floorBanner = new FloorBanner(scene);
    this.bossDownFlourish = new BossDownFlourish(scene);
    this.teleportFade = new TeleportFade(scene);
    this.graceRing = new GraceRing(scene);
  }

  /** Rebuilds the active area-hazard rigs; returns their accent lights for LightingSystem.setAccentLights. */
  syncAreas(tiles: readonly AreaTileView[]): LightSource[] {
    return this.areas.sync(tiles);
  }

  syncTorchFlames(torches: readonly LightSource[]): void {
    this.torchFlames.sync(torches);
  }

  /** Feeds one frame of the tracked player's motion: fires dust/footstep edge triggers. */
  trackPlayerMotion(
    x: number,
    y: number,
    air: boolean,
    faceX: number,
    nowMs: number,
  ): void {
    this.playerMotionFx.track(x, y, air, faceX, nowMs);
  }

  syncOutOfBreath(
    x: number,
    y: number,
    z: number,
    faceX: number,
    exhausted: boolean,
    nowMs: number,
  ): void {
    this.outOfBreathFx.sync(x, y, z, faceX, exhausted, nowMs);
  }

  spawnDamageNumber(worldX: number, worldY: number, feedback: import("../ui/healthFeedback.js").HealthFeedback, nowMs: number): void {
    const screen = worldToScreen(worldX, worldY);
    this.damageNumbers.spawn(screen.x, screen.y, feedback, nowMs);
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
    this.meleeSwingFx.spawnSwing(id, worldX, worldY, z, angleRad, depth, tilePx, nowMs);
  }

  /** The whiff arc-fade (panel round 3b item 5) — same geometry params as spawnMeleeSwing,
   * fired once a swing's WHIFF_TIMEOUT_MS elapses with no correlating hit (meleeConnect.ts). */
  spawnMeleeWhiff(id: string, worldX: number, worldY: number, z: number, angleRad: number, depth: number, tilePx: number, nowMs: number): void {
    this.meleeSwingFx.spawnWhiff(id, worldX, worldY, z, angleRad, depth, tilePx, nowMs);
  }

  /** Wall-bump deny cue: flashes the contact point without displacing the player. */
  triggerWallBump(worldX: number, worldY: number, dirX: number, dirY: number, nowMs: number): void {
    this.wallBumpFx.trigger(worldX, worldY, dirX, dirY, nowMs);
  }

  /** Splatter + one floor decal for a landed hit (Epic 7.11) — directional when `dirX`/`dirY`
   * (a knockback vector) is available, otherwise an even spray. `defId` (enemy content id,
   * undefined for players) picks the blood tint via bloodTint.ts. `groundHeight` is the hit
   * position's `groundAt` — the decal is GROUND-anchored, shifted by that height (section 5). */
  spawnBloodHit(worldX: number, worldY: number, groundHeight: number, defId: string | undefined, nowMs: number, dirX?: number, dirY?: number): void {
    this.combat.spawnBloodHit(worldX, worldY, groundHeight, defId, nowMs, dirX, dirY);
  }

  /** Heavier splatter + a scattered handful of floor decals for a death (Epic 7.11). */
  spawnBloodDeath(worldX: number, worldY: number, groundHeight: number, defId: string | undefined, nowMs: number): void {
    this.combat.spawnBloodDeath(worldX, worldY, groundHeight, defId, nowMs);
  }

  spawnDeathGore(
    worldX: number,
    worldY: number,
    groundHeight: number,
    defId: string | undefined,
    nowMs: number,
    appearance: CarnageAppearance = {},
    spritePrefix?: string,
    impactAngle?: number,
  ): void {
    this.combat.spawnDeathGore(
      worldX, worldY, groundHeight, defId, nowMs,
      appearance, spritePrefix, impactAngle,
    );
  }

  onOwnHit(nowMs: number): void {
    this.combat.onOwnHit(nowMs);
  }

  onOwnDeath(nowMs: number): void {
    this.combat.onOwnDeath(nowMs);
  }

  /** The full kill moment (wave-7 GRINDER demand): a chunkier gib burst than an
   * ordinary death, a brief corpse/bone decal, a kill-weight micro-shake, and a
   * ~60ms camera zoom-punch (hitStop.ts) so the kill reads with impact — a true
   * engine-wide time-scale pause would touch fixedStep.ts's simulation stepping
   * (another lane's file), so this fakes the same snap at the camera layer.
   * Enemy deaths only — call sites gate this to `kind === "enemy"`, ordinary
   * player deaths keep the plain blood-splatter treatment (spawnBloodDeath). */
  spawnKillMoment(
    worldX: number,
    worldY: number,
    groundHeight: number,
    defId: string | undefined,
    nowMs: number,
    appearance: CarnageAppearance = {},
    spritePrefix?: string,
    impactAngle?: number,
  ): void {
    this.combat.spawnKillMoment(
      worldX, worldY, groundHeight, defId, nowMs,
      appearance, spritePrefix, impactAngle,
    );
  }

  /** Floating "+N XP" above the self player — a kill's XP gain has no landed-hit
   * world position of its own (net/xpEvents.ts diffs the self snapshot only). */
  spawnXpNumber(amount: number, nowMs: number): void {
    const sample = this.playerMotionFx.latest;
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
    this.meleeSwingFx.update(nowMs);
    this.wallBumpFx.update(nowMs);
    this.combat.update(nowMs);
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
    this.meleeSwingFx.dispose();
    this.wallBumpFx.dispose();
    this.combat.dispose();
    this.levelUpFlourish.dispose();
    this.lowHpOverlay.dispose();
    this.floorBanner.dispose();
    this.bossDownFlourish.dispose();
    this.teleportFade.dispose();
    this.graceRing.dispose();
    this.outOfBreathFx.dispose();
  }
}
