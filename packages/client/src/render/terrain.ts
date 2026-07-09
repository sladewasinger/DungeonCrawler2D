import { CHUNK_SIZE, customArt2At, customArtAt, getCustomMap, type World } from "@dc2d/engine";
import Phaser from "phaser";
import { CHUNK_PX, TILE_PX } from "./constants";
import { stairSpritesInRect } from "./stairsprites";
import { frameForTile, heightTint } from "./tileframes";

/**
 * Chunked terrain as Phaser tilemap layers (base + borders + cliff
 * overlay + optional Tile Studio custom art) sharing the atlas texture
 * on the GPU, with per-tile tint for height shading. Chunks build as
 * the player approaches and are destroyed when left behind.
 */

const CHUNK_VIEW_RADIUS = 1;

export class TerrainRenderer {
  private readonly chunkMaps = new Map<string, Phaser.Tilemaps.Tilemap>();
  /** Staircase-object images per chunk (they live outside the tilemap). */
  private readonly chunkStairs = new Map<string, Phaser.GameObjects.Image[]>();
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
    for (const [key, images] of this.chunkStairs) {
      for (const img of images) img.destroy();
      this.chunkStairs.delete(key);
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
        this.chunkStairs.set(key, this.buildStairSprites(world, cx, cy));
      }
    }
    for (const [key, map] of this.chunkMaps) {
      const [cx, cy] = key.split(",").map(Number) as [number, number];
      if (Math.max(Math.abs(cx - ccx), Math.abs(cy - ccy)) > CHUNK_VIEW_RADIUS + 1) {
        map.destroy();
        this.chunkMaps.delete(key);
        for (const img of this.chunkStairs.get(key) ?? []) img.destroy();
        this.chunkStairs.delete(key);
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

  /** Full staircase objects (stair-ns/e/w.png) over single-step
   * entries — placement math in stairsprites.ts, shared with the
   * sample renderer. Drawn above the tile art (which stays underneath
   * as the fill for long ramps), below entities. */
  private buildStairSprites(world: World, cx: number, cy: number): Phaser.GameObjects.Image[] {
    const specs = stairSpritesInRect(world, cx * CHUNK_SIZE, cy * CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE);
    return specs.map((s) =>
      this.scene.add
        .image(s.px, s.py, `stair-${s.key}`)
        .setOrigin(0, 0)
        .setDepth(-8.85)
        .setTint(heightTint(s.tintHeight)),
    );
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
    // Wall tops: shifted a FULL tile north and drawn ABOVE entities —
    // a wall reads two tiles tall (brick face in its own cell, top
    // surface leaning over the cell behind it), and anyone standing
    // back there is hidden behind its body (entities on wall tops bump
    // their depth past this).
    const caps = map
      .createBlankLayer("caps", tileset, ox, oy - TILE_PX)!
      .setDepth(3);
    // Tile Studio art overrides render verbatim above the autotiles:
    // two layers, so authored objects/walls sit on their own ground.
    let custom: Phaser.Tilemaps.TilemapLayer | null = null;
    let custom2: Phaser.Tilemaps.TilemapLayer | null = null;
    const customMap = getCustomMap();
    if (customMap?.art || customMap?.art2) {
      const packTileset = map.addTilesetImage("packsheet", "packsheet", TILE_PX, TILE_PX, 0, 0)!;
      custom = map.createBlankLayer("custom", packTileset, ox, oy)!.setDepth(-8.8);
      if (customMap.art2) {
        custom2 = map.createBlankLayer("custom2", packTileset, ox, oy)!.setDepth(-8.7);
      }
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
        if (frames.cap >= 0) {
          const capTile = caps.putTileAt(frames.cap, lx, ly);
          if (capTile && frames.capTintHeight !== null) {
            capTile.tint = heightTint(frames.capTintHeight);
          }
        }
        if (custom) {
          const art = customArtAt(wx, wy);
          if (art !== null) custom.putTileAt(art, lx, ly);
        }
        if (custom2) {
          const art2 = customArt2At(wx, wy);
          if (art2 !== null) custom2.putTileAt(art2, lx, ly);
        }
      }
    }
    return map;
  }
}
