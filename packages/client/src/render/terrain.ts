import { CHUNK_SIZE, customArtAt, getCustomMap, type World } from "@dc2d/engine";
import Phaser from "phaser";
import atlas from "./atlas.json";
import { CHUNK_PX, TILE_PX } from "./constants";
import { frameForTile } from "./tileframes";

/**
 * Chunked terrain as Phaser tilemap layers (base + borders + cliff
 * overlay + optional Tile Studio custom art) sharing the atlas texture
 * on the GPU, with per-tile tint for height shading. Chunks build as
 * the player approaches and are destroyed when left behind.
 */

const CHUNK_VIEW_RADIUS = 1;

export class TerrainRenderer {
  private readonly chunkMaps = new Map<string, Phaser.Tilemaps.Tilemap>();
  private readonly borderGraphics: Phaser.GameObjects.Graphics;
  private showBorders = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.borderGraphics = scene.add.graphics().setDepth(5).setVisible(false);
  }

  /** Destroy all chunk maps (teleport — the world view restarts). */
  reset(): void {
    for (const [key, map] of this.chunkMaps) {
      map.destroy();
      this.chunkMaps.delete(key);
    }
  }

  toggleBorders(): void {
    this.showBorders = !this.showBorders;
    this.borderGraphics.setVisible(this.showBorders);
  }

  ensureChunksAround(world: World, x: number, y: number): void {
    const ccx = Math.floor(x / CHUNK_SIZE);
    const ccy = Math.floor(y / CHUNK_SIZE);
    for (let cy = ccy - CHUNK_VIEW_RADIUS; cy <= ccy + CHUNK_VIEW_RADIUS; cy++) {
      for (let cx = ccx - CHUNK_VIEW_RADIUS; cx <= ccx + CHUNK_VIEW_RADIUS; cx++) {
        const key = `${cx},${cy}`;
        if (this.chunkMaps.has(key)) continue;
        this.chunkMaps.set(key, this.buildChunkMap(world, cx, cy));
      }
    }
    for (const [key, map] of this.chunkMaps) {
      const [cx, cy] = key.split(",").map(Number) as [number, number];
      if (Math.max(Math.abs(cx - ccx), Math.abs(cy - ccy)) > CHUNK_VIEW_RADIUS + 1) {
        map.destroy();
        this.chunkMaps.delete(key);
      }
    }
  }

  drawBordersIfVisible(x: number, y: number): void {
    if (!this.showBorders) return;
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

  private buildChunkMap(world: World, cx: number, cy: number): Phaser.Tilemaps.Tilemap {
    world.getChunk(cx, cy); // warm the chunk cache before per-tile lookups
    const map = this.scene.make.tilemap({
      tileWidth: TILE_PX,
      tileHeight: TILE_PX,
      width: CHUNK_SIZE,
      height: CHUNK_SIZE,
    });
    const tileset = map.addTilesetImage("tiles", "tiles", TILE_PX, TILE_PX, 0, 0)!;
    const ox = cx * CHUNK_PX;
    const oy = cy * CHUNK_PX;
    const base = map.createBlankLayer("base", tileset, ox, oy)!.setDepth(-10);
    const borders = map.createBlankLayer("borders", tileset, ox, oy)!.setDepth(-9.5);
    const overlay = map.createBlankLayer("overlay", tileset, ox, oy)!.setDepth(-9);
    // Tile Studio art overrides render verbatim above the autotiles.
    let custom: Phaser.Tilemaps.TilemapLayer | null = null;
    if (getCustomMap()?.art) {
      const packTileset = map.addTilesetImage("packsheet", "packsheet", TILE_PX, TILE_PX, 0, 0)!;
      custom = map.createBlankLayer("custom", packTileset, ox, oy)!.setDepth(-8.8);
    }

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wy = cy * CHUNK_SIZE + ly;
        const frames = frameForTile(world, wx, wy);

        const baseTile = base.putTileAt(frames.base, lx, ly);
        if (baseTile && frames.baseTintHeight !== null) {
          baseTile.tint = heightTint(frames.baseTintHeight);
        }
        if (frames.border >= 0) borders.putTileAt(frames.border, lx, ly);
        if (frames.overlay >= 0) {
          const overlayTile = overlay.putTileAt(frames.overlay, lx, ly);
          if (overlayTile && frames.overlayTintHeight !== null) {
            overlayTile.tint = heightTint(frames.overlayTintHeight);
          }
        }
        if (custom) {
          const art = customArtAt(wx, wy);
          if (art !== null) custom.putTileAt(art, lx, ly);
        }
      }
    }
    return map;
  }
}

function heightTint(h: number): number {
  // Ground level renders at (near) full brightness so the white-brick
  // floor reads white; only depth darkens noticeably.
  const brightness = Math.max(0.5, Math.min(1, 0.95 + h * 0.035));
  const gray = Math.round(brightness * 255);
  return (gray << 16) | (gray << 8) | gray;
}
