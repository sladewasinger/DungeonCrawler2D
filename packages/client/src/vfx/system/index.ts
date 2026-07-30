// VFX facade: owns every particle/juice subsystem and exposes the small trigger surface
// scenes call into — area hazards, torch flames, player motion feel, and combat juice.
import type Phaser from "phaser";
import {
  DESKTOP_DEVICE_PRESENTATION_PROFILE,
  type DevicePresentationProfile,
} from "../../presentation/devicePresentationProfile.js";
import { worldToScreen } from "../../render/entities/geometry/worldToScreen.js";
import type { LightSource } from "../../render/lighting/core/lightSource.js";
import type { AreaTileView } from "../areas/areaEffectPool.js";
import {
  type BloodHitInput,
  type CombatEffectTarget,
  type DeathGoreInput,
} from "../combat/combatEffects.js";
import { spawnFistbumpFlourish } from "../flourishes/fistbumpFlourish.js";
import { GraceRing } from "../overlays/status/graceRing.js";
import { lowHpVignetteAlpha } from "../overlays/status/lowHpVignette.js";
import { spawnPickupGlint } from "../particles/pickupGlint.js";
import { createVfxSystemComponents, type VfxSystemComponents } from "./vfxSystemComponents.js";
import type {
  DamageNumberVfxInput,
  MeleeVfxInput,
  MotionVfxInput,
  OutOfBreathVfxInput,
  WallBumpVfxInput,
} from "./vfxSystemTypes.js";

export type { AreaSpriteKind, AreaTileView } from "../areas/areaEffectPool.js";
export type {
  DamageNumberVfxInput,
  MeleeVfxInput,
  MotionVfxInput,
  OutOfBreathVfxInput,
  WallBumpVfxInput,
} from "./vfxSystemTypes.js";

export class VfxSystem {
  private readonly components: VfxSystemComponents;
  /** Panel round 4 (LANE B): self-only spawn-grace shield ring — public, unlike this
   * class's other pooled subsystems, since frameSync.ts drives it directly with the
   * self player's own render pose (no other subsystem needs a raw world position). */
  readonly graceRing: GraceRing;
  private selfHpRatio = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    deviceProfile: DevicePresentationProfile = DESKTOP_DEVICE_PRESENTATION_PROFILE,
  ) {
    this.components = createVfxSystemComponents(scene, deviceProfile);
    this.graceRing = new GraceRing(scene);
  }

  /** Rebuilds the active area-hazard rigs; returns their accent lights for LightingSystem.setAccentLights. */
  syncAreas(tiles: readonly AreaTileView[]): LightSource[] {
    return this.components.areas.sync(tiles);
  }

  syncTorchFlames(torches: readonly LightSource[]): void {
    this.components.torchFlames.sync(torches);
  }

  /** Feeds one frame of the tracked player's motion: fires dust/footstep edge triggers. */
  trackPlayerMotion({ x, y, groundHeight, air, faceX, nowMs }: MotionVfxInput): void {
    this.components.playerMotionFx.track({ x, y, groundHeight, air, faceX }, nowMs);
  }

  syncOutOfBreath(input: OutOfBreathVfxInput): void {
    this.components.outOfBreathFx.sync(input);
  }

  spawnDamageNumber({ x, y, feedback, nowMs }: DamageNumberVfxInput): void {
    this.components.damageNumbers.spawn({ ...worldToScreen(x, y), feedback, nowMs });
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
  spawnMeleeSwing(input: MeleeVfxInput): void {
    this.components.meleeSwingFx.spawnSwing(input);
  }

  /** The whiff arc-fade (panel round 3b item 5) — same geometry params as spawnMeleeSwing,
   * fired once a swing's WHIFF_TIMEOUT_MS elapses with no correlating hit (meleeConnect.ts). */
  spawnMeleeWhiff(input: MeleeVfxInput): void {
    this.components.meleeSwingFx.spawnWhiff(input);
  }

  /** Wall-bump deny cue: flashes the contact point without displacing the player. */
  triggerWallBump(input: WallBumpVfxInput): void {
    this.components.wallBumpFx.trigger(input);
  }

  /** Splatter + one floor decal for a landed hit (Epic 7.11) — directional when `dirX`/`dirY`
   * (a knockback vector) is available, otherwise an even spray. `defId` (enemy content id,
   * undefined for players) picks the blood tint via bloodTint.ts. `groundHeight` is the hit
   * position's `groundAt` — the decal is GROUND-anchored, shifted by that height (section 5). */
  spawnBloodHit(input: BloodHitInput): void {
    this.components.combat.spawnBloodHit(input);
  }

  /** Heavier splatter + a scattered handful of floor decals for a death (Epic 7.11). */
  spawnBloodDeath(input: CombatEffectTarget): void {
    this.components.combat.spawnBloodDeath(input);
  }

  spawnDeathGore(input: DeathGoreInput): void {
    this.components.combat.spawnDeathGore(input);
  }

  onOwnHit(nowMs: number): void {
    this.components.combat.onOwnHit(nowMs);
  }

  onOwnDeath(nowMs: number): void {
    this.components.combat.onOwnDeath(nowMs);
  }

  /** The full kill moment (wave-7 GRINDER demand): a chunkier gib burst than an
   * ordinary death, a brief corpse/bone decal, a kill-weight micro-shake, and a
   * ~60ms camera zoom-punch (hitStop.ts) so the kill reads with impact — a true
   * engine-wide time-scale pause would touch fixedStep.ts's simulation stepping
   * (another lane's file), so this fakes the same snap at the camera layer.
   * Enemy deaths only — call sites gate this to `kind === "enemy"`, ordinary
   * player deaths keep the plain blood-splatter treatment (spawnBloodDeath). */
  spawnKillMoment(input: DeathGoreInput): void {
    this.components.combat.spawnKillMoment(input);
  }

  /** Floating "+N XP" above the self player — a kill's XP gain has no landed-hit
   * world position of its own (net/xpEvents.ts diffs the self snapshot only). */
  spawnXpNumber(amount: number, nowMs: number): void {
    const sample = this.components.playerMotionFx.latest;
    if (!sample) return;
    const screen = worldToScreen(sample.x, sample.y - 1);
    this.components.xpNumbers.spawn({ ...screen, amount, nowMs });
  }

  spawnLevelUpFlourish(level: number, nowMs: number): void {
    this.components.levelUpFlourish.trigger(level, nowMs);
  }

  /** Floor-entry title card (Epic 7.14) — "FLOOR N" + the announcer's line. */
  spawnFloorBanner(floor: number, line: string, nowMs: number): void {
    this.components.floorBanner.trigger(floor, line, nowMs);
  }

  /** Boss-death celebration (Epic 7.14) — red flash + "<NAME> FALLS". */
  spawnBossDownFlourish(bossName: string, nowMs: number): void {
    this.components.bossDownFlourish.trigger(bossName, nowMs);
  }

  /** Fade-through-black on any server teleport (Epic 7.14) — doors today, stairways once wired. */
  spawnTeleportFade(nowMs: number): void {
    this.components.teleportFade.trigger(nowMs);
  }

  /** Feeds the low-hp vignette its current ratio — call once per frame regardless
   * of whether hp changed, since the heartbeat throb animates continuously. */
  setSelfHp(hp: number, maxHp: number): void {
    this.selfHpRatio = maxHp > 0 ? Math.max(0, hp) / maxHp : 0;
  }

  /** Advances every per-frame subsystem (damage numbers rise/fade, wedge telegraphs fade). */
  update(nowMs: number): void {
    this.components.damageNumbers.update(nowMs);
    this.components.xpNumbers.update(nowMs);
    this.components.meleeSwingFx.update(nowMs);
    this.components.wallBumpFx.update(nowMs);
    this.components.combat.update(nowMs);
    this.components.levelUpFlourish.update(nowMs);
    this.components.lowHpOverlay.update(lowHpVignetteAlpha(this.selfHpRatio, nowMs));
    this.components.floorBanner.update(nowMs);
    this.components.bossDownFlourish.update(nowMs);
    this.components.teleportFade.update(nowMs);
  }

  dispose(): void {
    this.components.areas.dispose();
    this.components.torchFlames.dispose();
    this.components.damageNumbers.dispose();
    this.components.xpNumbers.dispose();
    this.components.meleeSwingFx.dispose();
    this.components.wallBumpFx.dispose();
    this.components.combat.dispose();
    this.components.levelUpFlourish.dispose();
    this.components.lowHpOverlay.dispose();
    this.components.floorBanner.dispose();
    this.components.bossDownFlourish.dispose();
    this.components.teleportFade.dispose();
    this.graceRing.dispose();
    this.components.outOfBreathFx.dispose();
  }
}
