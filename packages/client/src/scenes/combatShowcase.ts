// Combat-presentation showcase for the gallery harness (?combat=1): static demo players
// whose held weapon orbits the live mouse pointer (desktop) or a fixed facing direction
// (?touch=1) and swing the melee-wedge telegraph on click/space — the harness this repo's
// docs/client-proofs/combat-*.png verification screenshots are taken against. Mirrors the
// real self-only orbit/wedge wiring in scenes/dungeon/index.ts, but self-contained (no
// live Connection) so it can run headless in Playwright without a game-server.
import type { World } from "@dc2d/engine";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../boot/assetManifest.js";
import { EntityRenderer, type PlayerEntityView, type RenderContext } from "../render/entities/index.js";
import { resolveAimAngle, type AimSource } from "../render/entities/weaponOrbit.js";
import { depthForEntityNow, worldToScreen } from "../render/entities/worldToScreen.js";
import { VfxSystem } from "../vfx/index.js";

/** Mirrors render/entities/playerVisual.ts's STRIKE_DURATION_MS — how long a demo swing holds the strike telegraph. */
const SWING_HOLD_MS = 160;
/** South — a readable "walking toward camera" pose for the ?touch=1 facing-locked demo. */
const TOUCH_DEMO_FACING = { x: 0, y: 1 } as const;
const WEDGE_DEPTH_BIAS = 0.05;

export interface CombatDemoPlayer {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly weaponId: string | null;
}

export class CombatShowcase {
  private readonly renderer: EntityRenderer;
  private readonly vfx: VfxSystem;
  private swingUntilMs = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
    private readonly players: readonly CombatDemoPlayer[],
    private readonly touchActive: boolean,
  ) {
    this.renderer = new EntityRenderer(scene);
    this.vfx = new VfxSystem(scene);
    scene.input.on("pointerdown", () => this.triggerSwing(performance.now()));
    scene.input.keyboard?.on("keydown-SPACE", () => this.triggerSwing(performance.now()));
  }

  /** Starts every demo player's strike telegraph + spawns their wedge, aimed at their current orbit angle — mirrors selfCosmetics.ts's triggerSelfAttack capturing the exact swing direction at trigger time. */
  private triggerSwing(nowMs: number): void {
    this.swingUntilMs = nowMs + SWING_HOLD_MS;
    for (const demo of this.players) {
      const angle = this.aimAngle(demo);
      this.vfx.spawnMeleeSwing(demo.id, demo.x, demo.y, 0, angle, depthForEntityNow(demo.x, demo.y) - WEDGE_DEPTH_BIAS, SCREEN_TILE_PX, nowMs);
    }
  }

  /** Transforms the pointer through this scene's own camera explicitly rather than trusting
   * `pointer.worldX/worldY`, which the parallel "hud" scene's un-zoomed camera can clobber
   * on every move (see scenes/dungeon/selfAim.ts's doc comment for the full explanation). */
  private aimAngle(demo: CombatDemoPlayer): number {
    if (this.touchActive) return resolveAimAngle({ kind: "facing", faceX: TOUCH_DEMO_FACING.x, faceY: TOUCH_DEMO_FACING.y });
    const screen = worldToScreen(demo.x, demo.y);
    const pointer = this.scene.input.activePointer;
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const source: AimSource = { kind: "mouse", playerScreenX: screen.x, playerScreenY: screen.y, pointerScreenX: world.x, pointerScreenY: world.y };
    return resolveAimAngle(source);
  }

  private playerView(demo: CombatDemoPlayer, attacking: boolean): PlayerEntityView {
    const angle = this.aimAngle(demo);
    const faceX = this.touchActive ? TOUCH_DEMO_FACING.x : Math.cos(angle) >= 0 ? 1 : -1;
    const faceY = this.touchActive ? TOUCH_DEMO_FACING.y : 0;
    return {
      id: demo.id,
      playerId: demo.id,
      name: demo.id,
      x: demo.x,
      y: demo.y,
      z: this.world.groundAt(demo.x, demo.y),
      hp: 24,
      maxHp: 30,
      fx: [],
      faceX,
      faceY,
      air: false,
      downed: false,
      attacking,
      weaponId: demo.weaponId,
      weaponAimAngle: angle,
      attackAngleRad: angle,
    };
  }

  update(nowMs: number, dtSeconds: number): void {
    const attacking = nowMs < this.swingUntilMs;
    const views = this.players.map((demo) => this.playerView(demo, attacking));
    const first = views[0];
    const ctx: RenderContext = { world: this.world, nowMs, dtSeconds, selfX: first?.x ?? 0, selfY: first?.y ?? 0, partyIds: new Set() };
    this.renderer.syncPlayers(views, ctx);
    this.vfx.update(nowMs);
  }

  dispose(): void {
    this.renderer.dispose();
    this.vfx.dispose();
  }
}
