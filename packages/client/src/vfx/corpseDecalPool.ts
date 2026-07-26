// Pooled fallen-body decals: one per enemy kill, hard-capped, 60s fade
// (corpseDecalMotion.ts) — reuses bloodDecalPool.ts's exact grow/recycle shape and
// bloodDecalSlots.ts's pure cap arithmetic, per the wave-7 "blood-decal pool
// pattern" brief. A bone-pale cross Shape (not a sprite — no bone art in the atlas),
// alpha-blended so it reads on any floor tone without glowing.
//
// GROUND-anchored (docs/ELEVATION-PROJECTION.md section 5): shifted by the kill
// position's `groundAt` height, same `height*TILE` shape the shadow/halo use.
import Phaser from "phaser";
import {
  ASSET_KEYS,
  SCREEN_TILE_PX,
  WORLD_PIXEL_SCALE,
} from "../boot/assetManifest.js";
import { monsterSpriteFor } from "../render/entities/spriteMap.js";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import { recycleSlotIndex, shouldGrowPool } from "./bloodDecalSlots.js";
import { corpseDecalAlpha, isCorpseDecalExpired } from "./corpseDecalMotion.js";
import { groundPlaneDepth } from "./groundPlaneDepth.js";

export const CORPSE_DECAL_CAP = 24;
const BASE_ALPHA = 0.92;
const BONE_COLOR = 0xd8cdb8;
const CROSS_LENGTH_PX = 17;
const CROSS_THICKNESS_PX = 3;

interface CorpseDecal {
  readonly container: Phaser.GameObjects.Container;
  readonly gore: Phaser.GameObjects.Ellipse[];
  readonly body: Phaser.GameObjects.Sprite;
  spawnMs: number;
}

export class CorpseDecalPool {
  private readonly decals: CorpseDecal[] = [];
  private cursor = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Places one bone-cross decal near (worldX, worldY) — grows the pool until
   * CORPSE_DECAL_CAP, then recycles the oldest-cycled slot round-robin. `groundHeight`
   * is the kill position's `groundAt`, GROUND-anchoring the decal (section 5). */
  spawn(
    worldX: number,
    worldY: number,
    groundHeight: number,
    tint: number,
    defId: string | undefined,
    nowMs: number,
    spritePrefix?: string,
    bloodEnabled = true,
  ): void {
    const decal = shouldGrowPool(this.decals.length, CORPSE_DECAL_CAP) ? this.grow() : this.recycle();
    this.place(
      decal,
      worldX,
      worldY,
      groundHeight,
      tint,
      defId,
      nowMs,
      spritePrefix,
      bloodEnabled,
    );
  }

  private grow(): CorpseDecal {
    const decal = this.buildDecal();
    this.decals.push(decal);
    return decal;
  }

  private recycle(): CorpseDecal {
    const index = recycleSlotIndex(this.cursor, CORPSE_DECAL_CAP);
    this.cursor++;
    // Index is always in range: recycle() only runs once the pool has grown to CORPSE_DECAL_CAP.
    return this.decals[index]!;
  }

  private buildDecal(): CorpseDecal {
    const gore = [
      this.scene.add.ellipse(-5, 2, 15, 9),
      this.scene.add.ellipse(5, 1, 13, 10),
      this.scene.add.ellipse(0, -4, 10, 8),
    ];
    const body = this.scene.add
      .sprite(0, -4, ASSET_KEYS.atlas)
      .setName("enemy-corpse-body")
      .setOrigin(0.5, 0.75)
      .setScale(WORLD_PIXEL_SCALE);
    const bones = [
      this.scene.add.rectangle(-4, -1, CROSS_THICKNESS_PX, CROSS_LENGTH_PX, BONE_COLOR),
      this.scene.add.rectangle(4, 1, CROSS_LENGTH_PX, CROSS_THICKNESS_PX, BONE_COLOR),
    ];
    const container = this.scene.add
      .container(0, 0, [...gore, ...bones, body])
      .setName("enemy-corpse")
      .setBlendMode(Phaser.BlendModes.NORMAL);
    return { container, gore, body, spawnMs: -Infinity };
  }

  private place(
    decal: CorpseDecal,
    worldX: number,
    worldY: number,
    groundHeight: number,
    tint: number,
    defId: string | undefined,
    nowMs: number,
    spritePrefix?: string,
    bloodEnabled = true,
  ): void {
    const screen = worldToScreen(worldX, worldY);
    const shiftedY = screen.y - groundHeight * SCREEN_TILE_PX;
    const scatterPx = 6;
    const scatterX = (Math.random() - 0.5) * scatterPx;
    const scatterY = (Math.random() - 0.5) * scatterPx;
    for (const blob of decal.gore) {
      blob
        .setFillStyle(tint, 0.9)
        .setStrokeStyle(0, tint, 0)
        .setVisible(bloodEnabled);
    }
    this.placeBody(decal.body, spritePrefix ?? (defId ? monsterSpriteFor(defId) : undefined));
    decal.container
      .setPosition(screen.x + scatterX, shiftedY + scatterY)
      .setRotation(0)
      .setScale(1)
      .setAlpha(BASE_ALPHA)
      .setVisible(true)
      .setDepth(groundPlaneDepth(screen.y, groundHeight) - 0.3);
    decal.spawnMs = nowMs;
  }

  private placeBody(
    body: Phaser.GameObjects.Sprite,
    animationPrefix: string | undefined,
  ): void {
    const animation = animationPrefix
      ? this.scene.anims.get(`${animationPrefix}_idle`)
      : undefined;
    const frame = animation?.frames[0]?.textureFrame;
    body
      .setVisible(frame !== undefined)
      .setAngle(Math.random() < 0.5 ? -90 : 90)
      .clearTint();
    if (frame !== undefined) body.setFrame(frame);
  }

  /** Fades every live decal, hiding it once past its brief lifetime (the Shape is kept for reuse). */
  update(nowMs: number): void {
    for (const decal of this.decals) {
      const elapsed = nowMs - decal.spawnMs;
      const expired = isCorpseDecalExpired(elapsed);
      decal.container.setAlpha(corpseDecalAlpha(elapsed, BASE_ALPHA)).setVisible(!expired);
    }
  }

  dispose(): void {
    for (const decal of this.decals) decal.container.destroy();
    this.decals.length = 0;
    this.cursor = 0;
  }
}
