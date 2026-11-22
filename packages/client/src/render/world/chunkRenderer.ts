/** Streams visible chunk bitmaps, props, animated lights, and Y-sorted actors. */
import { FOREST_LIGHT_STYLE } from "@dc2d/content";
import {
  CHUNK_SIZE,
  TILE_PX,
  WorldChunkCache,
  chunkKey,
  worldToChunkCoord,
  type PlayerSnapshot,
  type PointLightSpec,
  type PropKind,
} from "@dc2d/engine";
import { Sprite } from "pixi.js";
import type { ShadowCaster } from "../shaders/castShadows.js";
import type { PropTextureSet } from "../textures/propTextures.js";
import type { TerrainTileAtlas } from "../textures/terrainTextures.js";
import {
  animateChunkPropsAndFoliage,
  mountChunkProp,
  type MountedChunk,
  type WorldLayers,
} from "./chunkProps.js";
import { PlayerView, type KnightFrames } from "./playerSprite.js";
import { bakeChunkTextures } from "./tileBuilder.js";

export class ChunkRenderer {
  private readonly mounted = new Map<string, MountedChunk>();
  private readonly playerViews = new Map<string, PlayerView>();

  constructor(
    private readonly layers: WorldLayers,
    private readonly atlases: { readonly terrain: TerrainTileAtlas; readonly props: PropTextureSet },
    private knightFrames: KnightFrames,
  ) {}

  setKnightFrames(frames: KnightFrames): void {
    this.knightFrames = frames;
  }

  syncVisibleChunks(cache: WorldChunkCache, focus: { readonly x: number; readonly y: number; readonly radius: number }): void {
    const centerCx = worldToChunkCoord(Math.floor(focus.x));
    const centerCy = worldToChunkCoord(Math.floor(focus.y));
    const needed = new Set<string>();
    for (let dy = -focus.radius; dy <= focus.radius; dy++) {
      this.syncChunkRow({ cache, centerCx, cy: centerCy + dy, radius: focus.radius, needed });
    }
    for (const entry of this.mounted.values()) {
      if (!needed.has(entry.key)) this.unmountChunk(entry);
    }
  }

  private syncChunkRow(input: {
    readonly cache: WorldChunkCache;
    readonly centerCx: number;
    readonly cy: number;
    readonly radius: number;
    readonly needed: Set<string>;
  }): void {
    for (let dx = -input.radius; dx <= input.radius; dx++) {
      const cx = input.centerCx + dx;
      const key = chunkKey(cx, input.cy);
      input.needed.add(key);
      if (!this.mounted.has(key)) this.mountChunk(input.cache, { key, cx, cy: input.cy });
    }
  }

  syncPlayersAndAtmosphere(input: {
    readonly players: readonly PlayerSnapshot[];
    readonly timeSec: number;
  }): { lights: PointLightSpec[]; campfires: PointLightSpec[]; casters: ShadowCaster[] } {
    this.reconcilePlayerViews(input.players, input.timeSec);
    const out = { lights: [] as PointLightSpec[], campfires: [] as PointLightSpec[], casters: [] as ShadowCaster[] };
    for (const player of input.players) this.appendPlayerVisuals(player, out);
    for (const chunk of this.mounted.values()) {
      this.appendChunkVisuals(chunk, input, out);
    }
    return out;
  }

  private appendPlayerVisuals(
    player: PlayerSnapshot,
    out: { readonly lights: PointLightSpec[]; readonly casters: ShadowCaster[] },
  ): void {
    out.casters.push({ x: player.x, y: player.y, widthPx: 10, lengthPx: 16 });
    if (!player.torchLit) return;
    out.lights.push({
      id: `player:${player.id}`, kind: "torch", x: player.x, y: player.y - 0.35,
      color: FOREST_LIGHT_STYLE.playerTorchColor, radiusPx: FOREST_LIGHT_STYLE.playerTorchRadiusPx, intensity: 1.05,
    });
  }

  private appendChunkVisuals(
    chunk: MountedChunk,
    input: { readonly players: readonly PlayerSnapshot[]; readonly timeSec: number },
    out: { readonly lights: PointLightSpec[]; readonly campfires: PointLightSpec[]; readonly casters: ShadowCaster[] },
  ): void {
    out.casters.push(...chunk.casters);
    for (const light of chunk.lights) {
      out.lights.push(light);
      if (light.kind === "campfire") out.campfires.push(light);
    }
    animateChunkPropsAndFoliage({ chunk, players: input.players, propsAtlas: this.atlases.props, timeSec: input.timeSec });
  }

  private reconcilePlayerViews(players: readonly PlayerSnapshot[], timeSec: number): void {
    const activeIds = new Set(players.map((p) => p.id));
    for (const [id, view] of this.playerViews) {
      if (activeIds.has(id)) continue;
      view.root.destroy({ children: true });
      this.playerViews.delete(id);
    }
    for (const snap of players) {
      let view = this.playerViews.get(snap.id);
      if (!view) {
        view = new PlayerView(this.knightFrames, this.atlases.props.torchFrames[0]!, snap.name);
        this.playerViews.set(snap.id, view);
        this.layers.ysort.addChild(view.root);
      }
      view.sync({ snap, frames: this.knightFrames, torchFrames: this.atlases.props.torchFrames, timeSec });
    }
  }

  private mountChunk(cache: WorldChunkCache, loc: { readonly key: string; readonly cx: number; readonly cy: number }): void {
    const chunk = cache.getChunk(loc.cx, loc.cy);
    const baked = bakeChunkTextures(cache, this.atlases.terrain, loc);
    const ground = new Sprite(baked.ground);
    const water = new Sprite(baked.water);
    ground.position.set(loc.cx * CHUNK_SIZE * TILE_PX, loc.cy * CHUNK_SIZE * TILE_PX);
    water.position.copyFrom(ground.position);
    this.layers.ground.addChild(ground);
    this.layers.water.addChild(water);

    const target = {
      grassSprites: [] as { sprite: Sprite; wx: number; wy: number }[],
      ysortSprites: [] as Sprite[],
      canopySprites: [] as { sprite: Sprite; wx: number; wy: number }[],
      animatedProps: [] as { sprite: Sprite; kind: PropKind; phase: number }[],
      casters: [] as ShadowCaster[],
    };
    for (const prop of chunk.props) {
      mountChunkProp({ prop, layers: this.layers, propsAtlas: this.atlases.props, target });
    }
    this.mounted.set(loc.key, { key: loc.key, cx: loc.cx, cy: loc.cy, ground, water, ...target, lights: chunk.lights });
  }

  private unmountChunk(entry: MountedChunk): void {
    entry.ground.destroy({ texture: true });
    entry.water.destroy({ texture: true });
    for (const s of entry.grassSprites) s.sprite.destroy();
    for (const s of entry.ysortSprites) s.destroy();
    for (const s of entry.canopySprites) s.sprite.destroy();
    this.mounted.delete(entry.key);
  }
}
