import {
  CHUNK_SIZE,
  STEP_UP,
  TICK_RATE,
  TILE,
  ZONE,
  hash2D,
  type MoveInput,
  type World,
} from "@dc2d/engine";
import Phaser from "phaser";
import type { Connection } from "../net/connection";
import atlas from "../render/atlas.json";

/**
 * Renders the shared world from the baked 64×64 pixel-art atlas
 * (assets regenerate via `npm run art`). Each chunk becomes a pair of
 * tilemap layers over the single shared tileset texture — base terrain
 * plus an overlay for cliff faces and ledge rims — with per-tile tint
 * carrying the height shading. Players are atlas sprites whose shadow
 * blob stays at the ground position; the sprite lifts off the shadow
 * only by its height ABOVE THE LOCAL TERRAIN (z − heightAt), so a
 * grounded crawler on a plateau stands on its shadow and only jumps
 * and falls separate them.
 */

const TILE_PX = atlas.tileSize;
const CHUNK_PX = CHUNK_SIZE * TILE_PX;
const Z_PX = 48; // vertical pixels per height unit (0.75 tiles)
const RENDER_DELAY_MS = 120; // interpolation delay for peers
const CHUNK_VIEW_RADIUS = 1; // 3×3 chunks around the player stay built

interface PeerVisual {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
}

export class DungeonScene extends Phaser.Scene {
  private chunkMaps = new Map<string, Phaser.Tilemaps.Tilemap>();
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

  preload(): void {
    this.load.spritesheet("tiles", "assets/tiles.png", {
      frameWidth: TILE_PX,
      frameHeight: TILE_PX,
    });
    this.load.spritesheet("players", "assets/players.png", {
      frameWidth: TILE_PX,
      frameHeight: TILE_PX,
    });
  }

  create(): void {
    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys("W,A,S,D,SPACE,G") as DungeonScene["keys"];
    this.keys.G.on("down", () => {
      this.showBorders = !this.showBorders;
      this.borderGraphics.setVisible(this.showBorders);
    });

    this.selfShadow = this.add.ellipse(0, 0, 34, 16, 0x000000, 0.4).setDepth(1);
    this.selfSprite = this.add
      .image(0, 0, "players", atlas.players.self)
      .setOrigin(0.5, 0.85)
      .setDepth(2);
    this.selfLabel = this.add
      .text(0, 0, "", { fontSize: "12px", color: "#ffe9b0" })
      .setOrigin(0.5, 1)
      .setDepth(3);

    this.borderGraphics = this.add.graphics().setDepth(5).setVisible(false);

    this.debugText = this.add
      .text(8, 8, "connecting…", {
        fontSize: "13px",
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
    const world = conn.world;

    // Fixed-step input sampling at the shared tick rate.
    this.accumulatorMs += deltaMs;
    const stepMs = 1000 / TICK_RATE;
    while (this.accumulatorMs >= stepMs) {
      this.accumulatorMs -= stepMs;
      conn.sampleInput(this.readInput());
    }

    const body = conn.body;
    this.ensureChunksAround(body.x, body.y);

    // Self: shadow on the ground, sprite lifted only by height above terrain.
    const sx = body.x * TILE_PX;
    const sy = body.y * TILE_PX;
    const lift = this.liftFor(world, body.x, body.y, body.z);
    this.selfShadow.setPosition(sx, sy);
    this.selfShadow.setScale(1 - Math.min(0.35, lift / 400));
    this.selfSprite.setPosition(sx, sy - lift);
    this.selfLabel.setPosition(sx, sy - lift - 44);
    this.selfLabel.setText(conn.welcome.playerId);

    // Peers (interpolated slightly in the past).
    const peers = conn.interpolatedPeers(RENDER_DELAY_MS);
    const seen = new Set<string>();
    for (const peer of peers) {
      seen.add(peer.id);
      let visual = this.peerVisuals.get(peer.id);
      if (!visual) {
        visual = {
          shadow: this.add.ellipse(0, 0, 34, 16, 0x000000, 0.4).setDepth(1),
          sprite: this.add
            .image(0, 0, "players", atlas.players.peer)
            .setOrigin(0.5, 0.85)
            .setDepth(2),
          label: this.add
            .text(0, 0, peer.name, { fontSize: "12px", color: "#c8ecf7" })
            .setOrigin(0.5, 1)
            .setDepth(3),
        };
        this.peerVisuals.set(peer.id, visual);
      }
      const px = peer.x * TILE_PX;
      const py = peer.y * TILE_PX;
      const peerLift = this.liftFor(world, peer.x, peer.y, peer.z);
      visual.shadow.setPosition(px, py);
      visual.shadow.setScale(1 - Math.min(0.35, peerLift / 400));
      visual.sprite.setPosition(px, py - peerLift);
      visual.label.setPosition(px, py - peerLift - 44);
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

  /** Pixels the sprite floats above its shadow: height above local terrain. */
  private liftFor(world: World, x: number, y: number, z: number): number {
    const terrain = world.heightAt(Math.floor(x), Math.floor(y));
    return Math.max(0, z - terrain) * Z_PX;
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
    const ccx = Math.floor(x / CHUNK_SIZE);
    const ccy = Math.floor(y / CHUNK_SIZE);
    for (let cy = ccy - CHUNK_VIEW_RADIUS; cy <= ccy + CHUNK_VIEW_RADIUS; cy++) {
      for (let cx = ccx - CHUNK_VIEW_RADIUS; cx <= ccx + CHUNK_VIEW_RADIUS; cx++) {
        const key = `${cx},${cy}`;
        if (this.chunkMaps.has(key)) continue;
        this.chunkMaps.set(key, this.buildChunkMap(cx, cy));
      }
    }
    // Cull far chunks so memory stays flat while roaming.
    for (const [key, map] of this.chunkMaps) {
      const [cx, cy] = key.split(",").map(Number) as [number, number];
      if (Math.max(Math.abs(cx - ccx), Math.abs(cy - ccy)) > CHUNK_VIEW_RADIUS + 1) {
        map.destroy();
        this.chunkMaps.delete(key);
      }
    }
  }

  /**
   * One chunk → a base tilemap layer (terrain) + an overlay layer
   * (cliff faces where the north neighbor is a big step up, rim
   * highlights where this tile is the top of a drop). All layers share
   * the single atlas texture; height shading is per-tile tint.
   */
  private buildChunkMap(cx: number, cy: number): Phaser.Tilemaps.Tilemap {
    const world = this.conn.world!;
    const chunk = world.getChunk(cx, cy);
    const map = this.make.tilemap({
      tileWidth: TILE_PX,
      tileHeight: TILE_PX,
      width: CHUNK_SIZE,
      height: CHUNK_SIZE,
    });
    const tileset = map.addTilesetImage("tiles", "tiles", TILE_PX, TILE_PX, 0, 0)!;
    const ox = cx * CHUNK_PX;
    const oy = cy * CHUNK_PX;
    const base = map.createBlankLayer("base", tileset, ox, oy)!.setDepth(-10);
    const overlay = map.createBlankLayer("overlay", tileset, ox, oy)!.setDepth(-9);

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const i = ly * CHUNK_SIZE + lx;
        const wx = cx * CHUNK_SIZE + lx;
        const wy = cy * CHUNK_SIZE + ly;
        const tile = chunk.tiles[i];
        const h = chunk.height[i] ?? 0;

        if (tile === TILE.Wall) {
          // Blob autotile per the pack's sample: rounded cobble edges
          // around dark interiors; the bottom edge doubles as the
          // south-facing wall courses. Mask bits set where the
          // neighbor is OPEN (N=1, E=2, S=4, W=8).
          let mask = 0;
          if (world.tileAt(wx, wy - 1) !== TILE.Wall) mask |= 1;
          if (world.tileAt(wx + 1, wy) !== TILE.Wall) mask |= 2;
          if (world.tileAt(wx, wy + 1) !== TILE.Wall) mask |= 4;
          if (world.tileAt(wx - 1, wy) !== TILE.Wall) mask |= 8;
          base.putTileAt(atlas.frames.wallAuto[mask]!, lx, ly);
          continue;
        }
        if (tile === TILE.Stairs) {
          base.putTileAt(atlas.frames.stairs, lx, ly);
          continue;
        }

        const variants =
          chunk.zones[i] === ZONE.Sanctuary ? atlas.frames.sanctuary : atlas.frames.floor;
        const baseTile = base.putTileAt(variants[hash2D(11, wx, wy) % variants.length]!, lx, ly);
        if (baseTile) baseTile.tint = heightTint(h);

        // Overlay: cliff face rising behind this tile, or ledge rims.
        // heightAt reads across chunk borders (lazily generated), so
        // faces are seamless at chunk edges.
        const n = world.heightAt(wx, wy - 1);
        const rise = n - h;
        let overlayFrame = -1;
        let overlayTintHeight = h;
        if (rise > 2.5) {
          overlayFrame = atlas.frames.faceTall[hash2D(13, wx, wy) % 2]!;
          overlayTintHeight = n;
        } else if (rise > STEP_UP) {
          overlayFrame = atlas.frames.faceShort[hash2D(13, wx, wy) % 2]!;
          overlayTintHeight = n;
        } else {
          let mask = 0;
          if (h - world.heightAt(wx, wy + 1) > STEP_UP) mask |= 1;
          if (h - world.heightAt(wx + 1, wy) > STEP_UP) mask |= 2;
          if (h - world.heightAt(wx - 1, wy) > STEP_UP) mask |= 4;
          if (mask > 0) overlayFrame = atlas.frames.rimBase + mask;
        }
        if (overlayFrame >= 0) {
          const overlayTile = overlay.putTileAt(overlayFrame, lx, ly);
          if (overlayTile) overlayTile.tint = heightTint(overlayTintHeight);
        }
      }
    }
    return map;
  }

  private drawChunkBorders(x: number, y: number): void {
    const g = this.borderGraphics;
    g.clear();
    g.lineStyle(2, 0x9fe8c9, 0.5);
    const ccx = Math.floor(x / CHUNK_SIZE);
    const ccy = Math.floor(y / CHUNK_SIZE);
    for (let cy = ccy - CHUNK_VIEW_RADIUS; cy <= ccy + CHUNK_VIEW_RADIUS; cy++) {
      for (let cx = ccx - CHUNK_VIEW_RADIUS; cx <= ccx + CHUNK_VIEW_RADIUS; cx++) {
        g.strokeRect(cx * CHUNK_PX, cy * CHUNK_PX, CHUNK_PX, CHUNK_PX);
      }
    }
  }
}

/** Height → brightness tint (multiplicative, so assets are baked mid-bright). */
function heightTint(h: number): number {
  const brightness = Math.max(0.45, Math.min(1, 0.62 + h * 0.055));
  const gray = Math.round(brightness * 255);
  return (gray << 16) | (gray << 8) | gray;
}
