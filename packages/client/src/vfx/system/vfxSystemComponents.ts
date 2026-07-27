import type Phaser from "phaser";
import { AreaEffectPool } from "../areas/areaEffectPool.js";
import { BossDownFlourish } from "../flourishes/bossDownFlourish.js";
import { CombatEffects } from "../combat/combatEffects.js";
import { DamageNumberPool } from "../motion/damageNumbers.js";
import { FloorBanner } from "../flourishes/floorBanner.js";
import { LevelUpFlourish } from "../flourishes/levelUpFlourish.js";
import { LowHpOverlay } from "../overlays/status/lowHpOverlay.js";
import { MeleeSwingFx } from "../combat/meleeSwingFx.js";
import { OutOfBreathFx } from "../overlays/status/outOfBreathFx.js";
import { PlayerMotionFx } from "../motion/playerMotionFx.js";
import { TeleportFade } from "../overlays/teleport/teleportFade.js";
import { TorchFlamePool } from "../particles/torchFlames.js";
import { WallBumpFx } from "../overlays/impact/wallBumpFx.js";
import { XpNumberPool } from "../motion/xpNumbers.js";

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
