import { TICK_RATE } from "@dc2d/engine";
import Phaser from "phaser";
import { InputController } from "../input/controller";
import type { Connection } from "../net/connection";
import { AreaRenderer } from "../render/areas";
import atlas from "../render/atlas.json";
import { TILE_PX } from "../render/constants";
import {
  ENEMY_FRAME_COUNT,
  ENEMY_SPRITE_IDS,
  SPITTER_FRAME_COUNTS,
  enemyTextureKey,
} from "../render/enemySprites";
import { EntityRenderer } from "../render/entities";
import { ITEM_SPRITE_IDS } from "../render/itemSprites";
import { TerrainRenderer } from "../render/terrain";
import { contextPrompt, debugContent, panelContent } from "../ui/context";
import { Hud } from "../ui/hud";
import { Panels } from "../ui/panels";

/**
 * Orchestrates one frame: fixed-step input sampling with prediction
 * (net/), terrain + entity + area rendering (render/), contextual UI
 * (ui/), and the eased camera. Input maps to intents (input/) — the
 * server decides what actually happens.
 */
export class DungeonScene extends Phaser.Scene {
  private hud!: Hud;
  private terrain!: TerrainRenderer;
  private entityRenderer!: EntityRenderer;
  private areaRenderer!: AreaRenderer;
  private inputController!: InputController;
  private readonly panels = new Panels();

  private accumulatorMs = 0;
  /** Body position before the latest fixed step — render interpolation. */
  private prevStep: { x: number; y: number; z: number } | null = null;
  private camX = 0;
  private camY = 0;
  private camSnap = true;

  constructor(private readonly conn: Connection) {
    super("dungeon");
  }

  preload(): void {
    this.load.spritesheet("tiles", "assets/tiles.png", { frameWidth: TILE_PX, frameHeight: TILE_PX });
    this.load.spritesheet("players", "assets/players.png", { frameWidth: TILE_PX, frameHeight: TILE_PX });
    this.load.image("packsheet", `assets/${atlas.packSheet.image}`);
    for (const enemyId of ENEMY_SPRITE_IDS) {
      if (enemyId === "spitter") continue;
      for (let frame = 0; frame < ENEMY_FRAME_COUNT; frame++) {
        this.load.image(enemyTextureKey(enemyId, "idle", frame), `assets/enemies/${enemyId}-${frame}.png`);
      }
    }
    for (const [state, frameCount] of Object.entries(SPITTER_FRAME_COUNTS)) {
      for (let frame = 0; frame < frameCount; frame++) {
        this.load.image(enemyTextureKey("spitter", state as keyof typeof SPITTER_FRAME_COUNTS, frame), `assets/enemies/spitter-v3/${state}-${frame}.png`);
      }
    }
    for (const itemId of ITEM_SPRITE_IDS) {
      this.load.image(`item-${itemId}`, `assets/items/${itemId}.png`);
    }
    for (const [key, sprite] of Object.entries(atlas.stairSprites)) {
      this.load.image(`stair-${key}`, `assets/${sprite.image}`);
    }
  }

  create(): void {
    this.terrain = new TerrainRenderer(this);
    this.entityRenderer = new EntityRenderer(this);
    this.areaRenderer = new AreaRenderer(this);
    this.hud = new Hud(this);
    this.inputController = new InputController(this, this.conn, this.panels, this.hud, {
      onSwing: (dx, dy) => this.entityRenderer.showSwing(this.conn, dx, dy),
      onToggleBorders: () => this.terrain.toggleBorders(),
    });
    this.cameras.main.setBackgroundColor("#0d0a12");
    this.cameras.main.setRoundPixels(true);
  }

  override update(_time: number, deltaMs: number): void {
    const { conn } = this;
    if (!conn.world || !conn.body || !conn.welcome) return;

    if (conn.teleported) {
      conn.teleported = false;
      this.terrain.reset();
      this.prevStep = null;
      this.camSnap = true;
    }

    // Fixed-step input sampling; the pre-step position feeds render
    // interpolation so 20Hz prediction looks like 60fps motion.
    this.accumulatorMs += deltaMs;
    const stepMs = 1000 / TICK_RATE;
    while (this.accumulatorMs >= stepMs) {
      this.accumulatorMs -= stepMs;
      this.prevStep = { x: conn.body.x, y: conn.body.y, z: conn.body.z };
      conn.sampleInput(this.inputController.readInput());
    }

    this.panels.sync(conn);

    const body = conn.body;
    const alpha = Math.min(1, this.accumulatorMs / stepMs);
    const prev = this.prevStep ?? body;
    const rx = prev.x + (body.x - prev.x) * alpha;
    const ry = prev.y + (body.y - prev.y) * alpha;
    const rz = prev.z + (body.z - prev.z) * alpha;

    this.terrain.ensureChunksAround(conn.world, body.x, body.y);
    this.areaRenderer.render(conn);
    this.entityRenderer.renderSelf(conn, rx, ry, rz);
    this.entityRenderer.renderRemotes(conn);
    this.entityRenderer.renderThrowPreview(conn, this.inputController.throwPreview());
    this.entityRenderer.spawnFloatingText(conn);
    this.terrain.drawBordersIfVisible(body.x, body.y);

    // Eased camera: snaps on teleport, otherwise glides after the player.
    const targetX = rx * TILE_PX;
    const targetY = ry * TILE_PX;
    if (this.camSnap) {
      this.camX = targetX;
      this.camY = targetY;
      this.camSnap = false;
    } else {
      const k = 1 - Math.exp((-deltaMs / 1000) * 10);
      this.camX += (targetX - this.camX) * k;
      this.camY += (targetY - this.camY) * k;
    }
    this.cameras.main.centerOn(this.camX, this.camY);

    this.hud.update(
      conn,
      contextPrompt(conn),
      panelContent(conn, this.panels),
      debugContent(conn, this.game.loop.actualFps),
      this.inputController.throwPreview()?.slot ?? null,
    );
  }
}
