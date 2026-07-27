import type Phaser from "phaser";
import { AreaEffectPool } from "./areaEffectPool.js";
import { BossDownFlourish } from "./bossDownFlourish.js";
import { CombatEffects } from "./combatEffects.js";
import { DamageNumberPool } from "./damageNumbers.js";
import { FloorBanner } from "./floorBanner.js";
import { LevelUpFlourish } from "./levelUpFlourish.js";
import { LowHpOverlay } from "./lowHpOverlay.js";
import { MeleeSwingFx } from "./meleeSwingFx.js";
import { OutOfBreathFx } from "./outOfBreathFx.js";
import { PlayerMotionFx } from "./playerMotionFx.js";
import { TeleportFade } from "./teleportFade.js";
import { TorchFlamePool } from "./torchFlames.js";
import { WallBumpFx } from "./wallBumpFx.js";
import { XpNumberPool } from "./xpNumbers.js";

export interface VfxSystemComponents {
  readonly areas: AreaEffectPool;
  readonly torchFlames: TorchFlamePool;
  readonly damageNumbers: DamageNumberPool;
  readonly xpNumbers: XpNumberPool;
  readonly meleeSwingFx: MeleeSwingFx;
  readonly wallBumpFx: WallBumpFx;
  readonly combat: CombatEffects;
  readonly levelUpFlourish: LevelUpFlourish;
  readonly lowHpOverlay: LowHpOverlay;
  readonly playerMotionFx: PlayerMotionFx;
  readonly outOfBreathFx: OutOfBreathFx;
  readonly floorBanner: FloorBanner;
  readonly bossDownFlourish: BossDownFlourish;
  readonly teleportFade: TeleportFade;
}

export function createVfxSystemComponents(scene: Phaser.Scene): VfxSystemComponents {
  return {
    areas: new AreaEffectPool(scene),
    torchFlames: new TorchFlamePool(scene),
    damageNumbers: new DamageNumberPool(scene),
    xpNumbers: new XpNumberPool(scene),
    meleeSwingFx: new MeleeSwingFx(scene),
    wallBumpFx: new WallBumpFx(scene),
    combat: new CombatEffects(scene),
    levelUpFlourish: new LevelUpFlourish(scene),
    lowHpOverlay: new LowHpOverlay(scene),
    playerMotionFx: new PlayerMotionFx(scene),
    outOfBreathFx: new OutOfBreathFx(scene),
    floorBanner: new FloorBanner(scene),
    bossDownFlourish: new BossDownFlourish(scene),
    teleportFade: new TeleportFade(scene),
  };
}
