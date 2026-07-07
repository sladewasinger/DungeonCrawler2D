import {
  CHUNK_SIZE,
  TICK_RATE,
  TILE,
  ZONE,
  type Chunk,
  type MoveInput,
} from "@dc2d/engine";
import Phaser from "phaser";
import type { Connection } from "../net/connection";

/**
 * Renders the shared world and everyone in it. Terrain chunks are
 * drawn once to canvas textures (height → shade, so elevation reads at
 * a glance); entities are simple shapes with a shadow blob anchoring
 * their ground position — the sprite lifts off the shadow with z.
 * Placeholder "pixel art +" until the real tileset lands.
 */

const TILE_PX = 16;
const CHUNK_PX = CHUNK_SIZE * TILE_PX;
const Z_PX = 12; // vertical pixels per height unit
const RENDER_DELAY_MS = 120; // interpolation delay for peers
const CHUNK_VIEW_RADIUS = 2; // chunks kept rendered around the player

interface PeerVisual {
  sprite: Phaser.GameObjects.Arc;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
}

export class DungeonScene extends Phaser.Scene {
  private chunkImages = new Map<string, Phaser.GameObjects.Image>();
  private peerVisuals = new Map<string, PeerVisual>();
  private selfSprite!: Phaser.GameObjects.Arc;
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

    this.selfShadow = this.add.ellipse(0, 0, 12, 7, 0x000000, 0.45).setDepth(1);
    this.selfSprite = this.add.circle(0, 0, 6, 0xffd166).setDepth(2);
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
    this.selfLabel.setPosition(sx, sy - body.z * Z_PX - 8);
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
          sprite: this.add.circle(0, 0, 6, 0x7ad7f0).setDepth(2),
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
      visual.label.setPosition(px, py - peer.z * Z_PX - 8);
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
        this.chunkImages.set(key, this.renderChunk(world.getChunk(cx, cy)));
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

  private renderChunk(chunk: Chunk): Phaser.GameObjects.Image {
    const texKey = `chunk-${chunk.cx},${chunk.cy}`;
    const canvas = this.textures.createCanvas(texKey, CHUNK_PX, CHUNK_PX)!;
    const ctx = canvas.getContext();
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const i = ly * CHUNK_SIZE + lx;
        const tile = chunk.tiles[i];
        const zone = chunk.zones[i];
        const h = chunk.height[i] ?? 0;
        if (tile === TILE.Wall) {
          ctx.fillStyle = "#241f2e";
        } else if (tile === TILE.Stairs) {
          ctx.fillStyle = "#8858c8";
        } else if (zone === ZONE.Sanctuary) {
          const light = Math.max(18, Math.min(55, 30 + h * 4));
          ctx.fillStyle = `hsl(165, 38%, ${light}%)`;
        } else {
          // Height → lightness: cliffs and terraces read at a glance.
          const light = Math.max(10, Math.min(60, 20 + h * 5));
          ctx.fillStyle = `hsl(262, 14%, ${light}%)`;
        }
        ctx.fillRect(lx * TILE_PX, ly * TILE_PX, TILE_PX, TILE_PX);
      }
    }
    canvas.refresh();
    return this.add
      .image(chunk.cx * CHUNK_PX, chunk.cy * CHUNK_PX, texKey)
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
