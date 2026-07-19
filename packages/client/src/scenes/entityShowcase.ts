// Animation showcase for the gallery harness: every monster cycling states, a player
// running/jumping with a shadow, and a wall-occlusion duo — proves the entity renderer
// end-to-end without a live server.
import type { EnemyAnimationState, World } from "@dc2d/engine";
import type Phaser from "phaser";
import { EntityRenderer, type MonsterEntityView, type PlayerEntityView, type RenderContext } from "../render/entities/index.js";
import { OCCLUSION_DUO, SHOWCASE_ROW } from "./entityShowcaseLayout.js";

const MONSTER_DEF_IDS = ["skeleton", "spitter", "slime", "plant-creeper"] as const;
const MONSTER_CYCLE: readonly EnemyAnimationState[] = ["idle", "walk", "windup", "attack", "recover"];
const CYCLE_STEP_MS = 700;
const MONSTER_ROW_SPACING_TILES = 2;

const JUMP_PERIOD_MS = 1200;
const JUMP_AIR_MS = 1000;
const JUMP_HEIGHT = 2.5;
const RUN_SPAN_TILES = 3;
const RUN_PERIOD_MS = 2000;

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
    return MONSTER_DEF_IDS.map((defId, index) => this.monsterView(defId, anim, index));
  }

  private monsterView(defId: string, anim: EnemyAnimationState, index: number): MonsterEntityView {
    const x = SHOWCASE_ROW.baseX + index * MONSTER_ROW_SPACING_TILES;
    const y = SHOWCASE_ROW.baseY;
    const fx = defId === "spitter" ? ["poisoned"] : defId === "plant-creeper" ? ["on-fire"] : [];
    return { id: `showcase-${defId}`, defId, name: defId, x, y, z: this.world.groundAt(x, y), hp: 8, maxHp: 10, fx, anim, faceX: 1, air: false };
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
    const x = SHOWCASE_ROW.baseX - RUN_SPAN_TILES + this.runOffset(nowMs);
    const y = SHOWCASE_ROW.baseY - 3;
    const groundHeight = this.world.groundAt(x, y);
    const jumpPhase = nowMs % JUMP_PERIOD_MS;
    const airborne = jumpPhase < JUMP_AIR_MS;
    const z = airborne ? groundHeight + Math.sin((jumpPhase / JUMP_AIR_MS) * Math.PI) * JUMP_HEIGHT : groundHeight;
    const faceX = Math.cos((nowMs / RUN_PERIOD_MS) * Math.PI * 2) >= 0 ? 1 : -1;
    return {
      id: "showcase-player",
      playerId: "showcase-player",
      name: "Hero",
      x,
      y,
      z,
      hp: 24,
      maxHp: 30,
      fx: [],
      faceX,
      faceY: 0,
      air: airborne,
      downed: false,
      attacking: false,
      weaponId: "sword",
    };
  }

  private runOffset(nowMs: number): number {
    return (Math.sin((nowMs / RUN_PERIOD_MS) * Math.PI * 2) + 1) * RUN_SPAN_TILES;
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
