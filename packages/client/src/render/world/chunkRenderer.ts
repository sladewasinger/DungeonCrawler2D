/** Streams visible chunk bitmaps, elevated 3/4 strips, animated lights, and Y-sorted actors. */
import { FOREST_LIGHT_STYLE } from "@dc2d/content";
import {
  CHUNK_SIZE, TILE_PX, WorldChunkCache, chunkKey, worldToChunkCoord,
  type PlayerSnapshot, type PointLightSpec, type PropKind, type WorldEntitySnapshot,
} from "@dc2d/engine";
import { Sprite } from "pixi.js";
import { EntityRenderer } from "../combat/entitySprites.js";
import type { ShadowCaster } from "../shaders/castShadows.js";
import type { PropTextureSet } from "../textures/propTextures.js";
import type { TerrainTileAtlas } from "../textures/terrainTextures.js";
import { animateChunkPropsAndFoliage, mountChunkProp, type MountedChunk, type WorldLayers } from "./chunkProps.js";
import { ELEVATION_LIFT_PX, bakeElevatedChunkRows, playerVisualElevation } from "./cliffStrips.js";
import { PlayerView } from "./playerSprite.js";
import { buildChunkTilemapMeshes } from "./tileBuilder.js";

export class ChunkRenderer {
  private readonly mounted = new Map<string, MountedChunk>();
  private readonly playerViews = new Map<string, PlayerView>();
  private readonly cliffSprites = new Set<Sprite>();
  private readonly entities = new EntityRenderer();

  constructor(
    private readonly layers: WorldLayers,
    private readonly atlases: { readonly terrain: TerrainTileAtlas; readonly props: PropTextureSet },
  ) {}

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
    readonly cache: WorldChunkCache; readonly centerCx: number; readonly cy: number; readonly radius: number; readonly needed: Set<string>;
  }): void {
    for (let dx = -input.radius; dx <= input.radius; dx++) {
      const cx = input.centerCx + dx;
      const key = chunkKey(cx, input.cy);
      input.needed.add(key);
      const prev = this.mounted.get(key);
      if (prev && (prev.revision ?? 0) !== input.cache.chunkRevision(cx, input.cy)) this.unmountChunk(prev);
      if (!this.mounted.has(key)) this.mountChunk(input.cache, { key, cx, cy: input.cy });
    }
  }

  syncPlayersAndAtmosphere(input: {
    readonly cache: WorldChunkCache;
    readonly players: readonly PlayerSnapshot[];
    readonly entities?: readonly WorldEntitySnapshot[];
    readonly localPlayerId?: string | undefined;
    readonly timeSec: number;
  }): { lights: PointLightSpec[]; campfires: PointLightSpec[]; casters: ShadowCaster[] } {
    this.reconcilePlayerViews(input.cache, input.players, input.timeSec);
    const localPlayer = input.localPlayerId ? input.players.find((p) => p.id === input.localPlayerId) : input.players[0];
    this.entities.setLocalPlayer(localPlayer);
    this.entities.sync(this.layers.ysort, input.entities ?? [], input.timeSec);
    const out = { lights: [] as PointLightSpec[], campfires: [] as PointLightSpec[], casters: [] as ShadowCaster[] };
    for (const player of input.players) this.appendPlayerVisuals(player, out);
    for (const entity of input.entities ?? []) this.appendEntityShadow(entity, out.casters);
    for (const chunk of this.mounted.values()) this.appendChunkVisuals(chunk, input, out);
    return out;
  }

  private appendEntityShadow(entity: WorldEntitySnapshot, casters: ShadowCaster[]): void {
    if (entity.hp <= 0) return;
    const liftTiles = entity.elevation * (ELEVATION_LIFT_PX / TILE_PX);
    casters.push({ x: entity.x, y: entity.y - liftTiles, widthPx: 9, lengthPx: 14 });
  }

  private appendPlayerVisuals(player: PlayerSnapshot, out: { readonly lights: PointLightSpec[]; readonly casters: ShadowCaster[] }): void {
    const liftTiles = player.elevation * (ELEVATION_LIFT_PX / TILE_PX);
    out.casters.push({ x: player.x, y: player.y - liftTiles, widthPx: 10, lengthPx: 16 });
    if (!player.torchLit) return;
    out.lights.push({
      id: `player:${player.id}`, kind: "torch", x: player.x, y: player.y - 0.35 - liftTiles,
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

  private reconcilePlayerViews(cache: WorldChunkCache, players: readonly PlayerSnapshot[], timeSec: number): void {
    const activeIds = new Set(players.map((p) => p.id));
    for (const [id, view] of this.playerViews) {
      if (activeIds.has(id)) continue;
      view.root.removeFromParent();
      view.root.destroy({ children: true });
      this.playerViews.delete(id);
    }
    for (const snap of players) {
      let view = this.playerViews.get(snap.id);
      if (!view) {
        view = new PlayerView(this.atlases.props.torchFrames[0]!, snap);
        this.playerViews.set(snap.id, view);
        this.layers.ysort.addChild(view.root);
      }
      const { visualElev, sortBoost } = playerVisualElevation({ cache, x: snap.x, y: snap.y, baseElev: snap.elevation });
      view.sync({ snap, torchFrames: this.atlases.props.torchFrames, timeSec, visualElev, sortBoost });
    }
  }

  private mountChunk(cache: WorldChunkCache, loc: { readonly key: string; readonly cx: number; readonly cy: number }): void {
    const chunk = cache.getChunk(loc.cx, loc.cy);
    const baked = buildChunkTilemapMeshes(cache, this.atlases.terrain, loc);
    const px = loc.cx * CHUNK_SIZE * TILE_PX;
    const py = loc.cy * CHUNK_SIZE * TILE_PX;
    baked.ground.mesh.position.set(px, py);
    baked.water.mesh.position.set(px, py);
    this.layers.ground.addChild(baked.ground.mesh);
    this.layers.water.addChild(baked.water.mesh);

    const target = {
      grassSprites: [] as { sprite: Sprite; wx: number; wy: number }[],
      ysortSprites: [] as Sprite[],
      canopySprites: [] as { sprite: Sprite; wx: number; wy: number }[],
      animatedProps: [] as { sprite: Sprite; kind: PropKind; phase: number }[],
      casters: [] as ShadowCaster[],
    };
    for (const strip of bakeElevatedChunkRows(cache, this.atlases.terrain, loc)) {
      const sp = new Sprite(strip.texture);
      sp.scale.set(strip.scale);
      sp.position.set(strip.x, strip.y);
      sp.zIndex = strip.zIndex;
      this.layers.ysort.addChild(sp);
      this.cliffSprites.add(sp);
      target.ysortSprites.push(sp);
    }
    for (const prop of chunk.props) mountChunkProp({ prop, layers: this.layers, propsAtlas: this.atlases.props, target });
    this.mounted.set(loc.key, {
      key: loc.key, cx: loc.cx, cy: loc.cy, revision: cache.chunkRevision(loc.cx, loc.cy),
      ground: baked.ground, water: baked.water, ...target, lights: chunk.lights,
    });
  }

  private unmountChunk(entry: MountedChunk): void {
    entry.ground.dispose();
    entry.water.dispose();
    for (const s of entry.grassSprites) s.sprite.destroy();
    for (const s of entry.ysortSprites) {
      const isCliff = this.cliffSprites.delete(s);
      s.destroy(isCliff ? { texture: true } : undefined);
    }
    for (const s of entry.canopySprites) s.sprite.destroy();
    this.mounted.delete(entry.key);
  }
}
