import { CHUNK_SIZE, TICK_RATE, TILE, ZONE, type MoveInput } from "@dc2d/engine";
import Phaser from "phaser";
import type { Connection } from "../net/connection";
import {
  PLAYER_TEXTURE_PEER,
  PLAYER_TEXTURE_SELF,
  TILE_PX,
  drawFloorTile,
  drawSanctuaryTile,
  drawStairsTile,
  drawWallTile,
  ensurePlayerTextures,
} from "../render/placeholderArt";

/**
 * Renders the shared world and everyone in it. Terrain chunks are
 * drawn once to canvas textures using the procedural placeholder art
 * (brick floors, wall faces, cliff strata — height reads at a glance);
 * players are pixel sprites with a shadow blob anchoring their ground
 * position — the sprite lifts off the shadow with z.
 */

const CHUNK_PX = CHUNK_SIZE * TILE_PX;
const Z_PX = 12; // vertical pixels per height unit
const RENDER_DELAY_MS = 120; // interpolation delay for peers
const CHUNK_VIEW_RADIUS = 2; // chunks kept rendered around the player

interface PeerVisual {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
}

export class DungeonScene extends Phaser.Scene {
  private chunkImages = new Map<string, Phaser.GameObjects.Image>();
  private peerVisuals = new Map<string, PeerVisual>();
  private selfSprite!: Phaser.GameObjects.Image;
  private selfShadow!: Phaser.GameObjects.Ellipse;
  private selfLabel!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;
  private borderGraphics!: Phaser.GameObjects.Graphics;
  private showBorders = false;
  private accumulatorMs = 0;
  private keys!: Record<"W" | "A" | "S" | "D" | "SPACE" | "G", Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(private readonly conn: Connection) {
    super("dungeon");
  }

  create(): void {
    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys("W,A,S,D,SPACE,G") as DungeonScene["keys"];
    this.keys.G.on("down", () => {
      this.showBorders = !this.showBorders;
      this.borderGraphics.setVisible(this.showBorders);
    });

    ensurePlayerTextures(this);
    this.selfShadow = this.add.ellipse(0, 0, 12, 7, 0x000000, 0.45).setDepth(1);
    this.selfSprite = this.add
      .image(0, 0, PLAYER_TEXTURE_SELF)
      .setOrigin(0.5, 0.85)
      .setDepth(2);
    this.selfLabel = this.add
      .text(0, 0, "", { fontSize: "10px", color: "#ffe9b0" })
      .setOrigin(0.5, 1)
      .setDepth(3);

    this.borderGraphics = this.add.graphics().setDepth(5).setVisible(false);

    this.debugText = this.add
      .text(8, 8, "connecting…", {
        fontSize: "12px",
        color: "#9fe8c9",
        backgroundColor: "#0d0a12c0",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.cameras.main.setBackgroundColor("#0d0a12");
  }

  override update(_time: number, deltaMs: number): void {
    const { conn } = this;
    if (!conn.world || !conn.body || !conn.welcome) {
      this.debugText.setText(
        conn.status === "closed" ? "disconnected — retrying…" : "connecting…",
      );
      return;
    }

    // Fixed-step input sampling at the shared tick rate.
    this.accumulatorMs += deltaMs;
    const stepMs = 1000 / TICK_RATE;
    while (this.accumulatorMs >= stepMs) {
      this.accumulatorMs -= stepMs;
      conn.sampleInput(this.readInput());
    }

    const body = conn.body;
    this.ensureChunksAround(body.x, body.y);

    // Self.
    const sx = body.x * TILE_PX;
    const sy = body.y * TILE_PX;
    this.selfShadow.setPosition(sx, sy);
    this.selfSprite.setPosition(sx, sy - body.z * Z_PX);
    this.selfLabel.setPosition(sx, sy - body.z * Z_PX - 18);
    this.selfLabel.setText(conn.welcome.playerId);

    // Peers (interpolated slightly in the past).
    const peers = conn.interpolatedPeers(RENDER_DELAY_MS);
    const seen = new Set<string>();
    for (const peer of peers) {
      seen.add(peer.id);
      let visual = this.peerVisuals.get(peer.id);
      if (!visual) {
        visual = {
          shadow: this.add.ellipse(0, 0, 12, 7, 0x000000, 0.45).setDepth(1),
          sprite: this.add
            .image(0, 0, PLAYER_TEXTURE_PEER)
            .setOrigin(0.5, 0.85)
            .setDepth(2),
          label: this.add
            .text(0, 0, peer.name, { fontSize: "10px", color: "#c8ecf7" })
            .setOrigin(0.5, 1)
            .setDepth(3),
        };
        this.peerVisuals.set(peer.id, visual);
      }
      const px = peer.x * TILE_PX;
      const py = peer.y * TILE_PX;
      visual.shadow.setPosition(px, py);
      visual.sprite.setPosition(px, py - peer.z * Z_PX);
      visual.label.setPosition(px, py - peer.z * Z_PX - 18);
    }
    for (const [id, visual] of this.peerVisuals) {
      if (!seen.has(id)) {
        visual.sprite.destroy();
        visual.shadow.destroy();
        visual.label.destroy();
        this.peerVisuals.delete(id);
      }
    }

    this.cameras.main.centerOn(sx, sy);

    if (this.showBorders) this.drawChunkBorders(body.x, body.y);

    const tileX = Math.floor(body.x);
    const tileY = Math.floor(body.y);
    this.debugText.setText(
      [
        `world ${conn.welcome.worldSeed} floor ${conn.welcome.floor}  [G] chunk borders`,
        `pos ${body.x.toFixed(1)}, ${body.y.toFixed(1)}  z ${body.z.toFixed(2)}  chunk ${Math.floor(tileX / CHUNK_SIZE)},${Math.floor(tileY / CHUNK_SIZE)}`,
        `ping ${conn.rttMs.toFixed(0)}ms  peers in view ${conn.peerCount}  fps ${this.game.loop.actualFps.toFixed(0)}`,
      ].join("\n"),
    );
  }

  private readInput(): MoveInput {
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;
    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      jump: this.keys.SPACE.isDown || this.cursors.space.isDown,
    };
  }

  private ensureChunksAround(x: number, y: number): void {
    const world = this.conn.world!;
    const ccx = Math.floor(x / CHUNK_SIZE);
    const ccy = Math.floor(y / CHUNK_SIZE);
    for (let cy = ccy - CHUNK_VIEW_RADIUS; cy <= ccy + CHUNK_VIEW_RADIUS; cy++) {
      for (let cx = ccx - CHUNK_VIEW_RADIUS; cx <= ccx + CHUNK_VIEW_RADIUS; cx++) {
        const key = `${cx},${cy}`;
        if (this.chunkImages.has(key)) continue;
        this.chunkImages.set(key, this.renderChunk(cx, cy));
      }
    }
    // Cull far chunks so memory stays flat while roaming.
    for (const [key, image] of this.chunkImages) {
      const [cx, cy] = key.split(",").map(Number) as [number, number];
      if (Math.max(Math.abs(cx - ccx), Math.abs(cy - ccy)) > CHUNK_VIEW_RADIUS + 1) {
        image.destroy();
        this.textures.remove(`chunk-${key}`);
        this.chunkImages.delete(key);
      }
    }
  }

  private renderChunk(cx: number, cy: number): Phaser.GameObjects.Image {
    const world = this.conn.world!;
    const chunk = world.getChunk(cx, cy);
    const texKey = `chunk-${cx},${cy}`;
    const canvas = this.textures.createCanvas(texKey, CHUNK_PX, CHUNK_PX)!;
    const ctx = canvas.getContext();
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const i = ly * CHUNK_SIZE + lx;
        const wx = cx * CHUNK_SIZE + lx;
        const wy = cy * CHUNK_SIZE + ly;
        const tile = chunk.tiles[i];
        const zone = chunk.zones[i];
        const h = chunk.height[i] ?? 0;
        const px = lx * TILE_PX;
        const py = ly * TILE_PX;
        if (tile === TILE.Wall) {
          drawWallTile(ctx, px, py, wx, wy, world.isWalkable(wx, wy + 1));
          continue;
        }
        if (tile === TILE.Stairs) {
          drawStairsTile(ctx, px, py);
          continue;
        }
        // heightAt reads across chunk borders (neighbor chunks are
        // generated lazily and cached), so cliff faces and rims are
        // seamless.
        const neighbors = {
          n: world.heightAt(wx, wy - 1),
          e: world.heightAt(wx + 1, wy),
          s: world.heightAt(wx, wy + 1),
          w: world.heightAt(wx - 1, wy),
        };
        if (zone === ZONE.Sanctuary) {
          drawSanctuaryTile(ctx, px, py, wx, wy, h, neighbors);
        } else {
          drawFloorTile(ctx, px, py, wx, wy, h, neighbors);
        }
      }
    }
    canvas.refresh();
    return this.add
      .image(cx * CHUNK_PX, cy * CHUNK_PX, texKey)
      .setOrigin(0, 0)
      .setDepth(-10);
  }

  private drawChunkBorders(x: number, y: number): void {
    const g = this.borderGraphics;
    g.clear();
    g.lineStyle(1, 0x9fe8c9, 0.5);
    const ccx = Math.floor(x / CHUNK_SIZE);
    const ccy = Math.floor(y / CHUNK_SIZE);
    for (let cy = ccy - CHUNK_VIEW_RADIUS; cy <= ccy + CHUNK_VIEW_RADIUS; cy++) {
      for (let cx = ccx - CHUNK_VIEW_RADIUS; cx <= ccx + CHUNK_VIEW_RADIUS; cx++) {
        g.strokeRect(cx * CHUNK_PX, cy * CHUNK_PX, CHUNK_PX, CHUNK_PX);
      }
    }
  }
}
