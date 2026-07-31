import { worldToScreen } from "../../render/entities/geometry/worldToScreen.js";
import type {
  BloodHitInput,
  CombatEffectTarget,
  DeathGoreInput,
} from "../combat/effects/combatEffects.js";
import { VfxSystemCore } from "./vfxSystemCore.js";
import type {
  MeleeVfxInput,
  MeleeVfxPositionInput,
  WallBumpVfxInput,
} from "./vfxSystemTypes.js";

export type { AreaSpriteKind, AreaTileView } from "../areas/areaEffectPool.js";
export type {
  DamageNumberVfxInput,
  MeleeVfxInput,
  MeleeVfxPositionInput,
  MotionVfxInput,
  OutOfBreathVfxInput,
  WallBumpVfxInput,
} from "./vfxSystemTypes.js";

export class VfxSystem extends VfxSystemCore {
  spawnMeleeSwing(input: MeleeVfxInput): void {
    this.components.meleeSwingFx.spawnSwing(input);
  }

  updateMeleeSwingPosition(input: MeleeVfxPositionInput): void {
    this.components.meleeSwingFx.updateSwingPosition(input);
  }

  spawnMeleeWhiff(input: MeleeVfxInput): void {
    this.components.meleeSwingFx.spawnWhiff(input);
  }

  triggerWallBump(input: WallBumpVfxInput): void {
    this.components.wallBumpFx.trigger(input);
  }

  spawnBloodHit(input: BloodHitInput): void {
    this.components.combat.spawnBloodHit(input);
  }

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

  spawnKillMoment(input: DeathGoreInput): void {
    this.components.combat.spawnKillMoment(input);
  }

  spawnXpNumber(amount: number, nowMs: number): void {
    const sample = this.components.playerMotionFx.latest;
    if (!sample) return;
    const screen = worldToScreen(sample.x, sample.y - 1);
    this.components.xpNumbers.spawn({ ...screen, amount, nowMs });
  }

  spawnLevelUpFlourish(level: number, nowMs: number): void {
    this.components.levelUpFlourish.trigger(level, nowMs);
  }

  spawnFloorBanner(floor: number, line: string, nowMs: number): void {
    this.components.floorBanner.trigger(floor, line, nowMs);
  }

  spawnBossDownFlourish(bossName: string, nowMs: number): void {
    this.components.bossDownFlourish.trigger(bossName, nowMs);
  }

  spawnTeleportFade(nowMs: number): void {
    this.components.teleportFade.trigger(nowMs);
  }
}
