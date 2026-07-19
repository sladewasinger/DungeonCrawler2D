// Animation showcase for the gallery harness: every monster cycling states, a player
// running/jumping with a shadow, and a wall-occlusion duo — proves the entity renderer
// end-to-end without a live server.
import type { EnemyAnimationState, World } from "@dc2d/engine";
import type Phaser from "phaser";
import { EntityRenderer, type MonsterEntityView, type PlayerEntityView, type RenderContext } from "../render/entities/index.js";
import { demoSkeletonHp, OCCLUSION_DUO, SHOWCASE_ROW, showcaseMonsterSlot } from "./entityShowcaseLayout.js";
import { showcasePlayerPose } from "./showcasePlayerMotion.js";

const MONSTER_DEF_IDS = ["skeleton", "spitter", "slime", "plant-creeper"] as const;
const MONSTER_CYCLE: readonly EnemyAnimationState[] = ["idle", "walk", "windup", "attack", "recover"];
const CYCLE_STEP_MS = 700;

export class EntityShowcase {
  private readonly renderer: EntityRenderer;

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
  ) {
    this.renderer = new EntityRenderer(scene);
  }

  update(nowMs: number, dtSeconds: number): void {
    const ctx: RenderContext = {
      world: this.world,
      nowMs,
      dtSeconds,
      selfX: SHOWCASE_ROW.baseX,
      selfY: SHOWCASE_ROW.baseY,
      partyIds: new Set(),
    };
    this.renderer.syncMonsters([...this.monsterRow(nowMs), ...this.occlusionDuo()], ctx);
    this.renderer.syncPlayers([this.playerView(nowMs)], ctx);
  }

  private monsterRow(nowMs: number): MonsterEntityView[] {
    const stepIndex = Math.floor(nowMs / CYCLE_STEP_MS) % MONSTER_CYCLE.length;
    const anim = MONSTER_CYCLE[stepIndex] ?? "idle";
    return MONSTER_DEF_IDS.map((defId, index) => this.monsterView(defId, anim, index, nowMs));
  }

  /** Monster 0 (skeleton) takes a real periodic demo hit — drives hit-flash + hp bar, not just a static value. */
  private monsterView(defId: string, anim: EnemyAnimationState, index: number, nowMs: number): MonsterEntityView {
    const { x, y } = showcaseMonsterSlot(index);
    const fx = defId === "spitter" ? ["poisoned"] : defId === "plant-creeper" ? ["on-fire"] : [];
    const hp = index === 0 ? demoSkeletonHp(nowMs) : 8;
    return { id: `showcase-${defId}`, defId, name: defId, x, y, z: this.world.groundAt(x, y), hp, maxHp: 10, fx, anim, faceX: 1, air: false };
  }

  private occlusionDuo(): MonsterEntityView[] {
    return [
      this.staticMonster("occlusion-north", OCCLUSION_DUO.northX, OCCLUSION_DUO.northY),
      this.staticMonster("occlusion-south", OCCLUSION_DUO.southX, OCCLUSION_DUO.southY),
    ];
  }

  private staticMonster(id: string, x: number, y: number): MonsterEntityView {
    return { id, defId: "skeleton", name: "skeleton", x, y, z: this.world.groundAt(x, y), hp: 10, maxHp: 10, fx: [], anim: "idle", faceX: 1, air: false };
  }

  private playerView(nowMs: number): PlayerEntityView {
    const pose = showcasePlayerPose(this.world, nowMs, SHOWCASE_ROW.baseX, SHOWCASE_ROW.baseY - 3);
    return {
      id: "showcase-player",
      playerId: "showcase-player",
      name: "Hero",
      x: pose.x,
      y: pose.y,
      z: pose.z,
      hp: 24,
      maxHp: 30,
      fx: [],
      faceX: pose.faceX,
      faceY: 0,
      air: pose.air,
      downed: false,
      attacking: false,
      weaponId: "sword",
    };
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
