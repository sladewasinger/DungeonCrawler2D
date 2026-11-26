/** Builds the static 48x32 sunlit grass arena + labeled showcase rows for terrain, nature, POIs, and gear. */
import { GroundKind, PropKind, TILE_PX, type PointLightSpec } from "@dc2d/engine";
import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { getHeldWeaponVisual, getShieldTexture } from "../render/character/heldWeapons.js";
import { getPoiPropSpriteSpec } from "../render/textures/poiPropTextures.js";
import { createPropTextureSet, HD_PROP_SCALE, type PropTextureSet } from "../render/textures/propTextures.js";
import { TERRAIN_TEX_PX, createTerrainTileAtlas } from "../render/textures/terrainTextures.js";
import { LINEUP_SPECS, SANDBOX_LINEUP_DX, SANDBOX_LINEUP_X0, SANDBOX_LINEUP_Y } from "./sandboxAi.js";

const SANDBOX_W = 48;
const SANDBOX_H = 32;

const SWATCH_LIST: readonly { readonly kind: GroundKind; readonly label: string }[] = [
  { kind: GroundKind.Grass, label: "Grass" },
  { kind: GroundKind.MeadowGrass, label: "Meadow" },
  { kind: GroundKind.ForestFloor, label: "Forest" },
  { kind: GroundKind.DirtPath, label: "Dirt" },
  { kind: GroundKind.Sand, label: "Sand" },
  { kind: GroundKind.ShallowWater, label: "Shallows" },
  { kind: GroundKind.DeepWater, label: "Deep" },
  { kind: GroundKind.CliffStone, label: "Cliff" },
  { kind: GroundKind.MossStone, label: "Moss" },
];

const CHEST_LABELS = ["Wood Closed", "Wood Open", "Stone Closed", "Stone Open"] as const;
const GEAR_IDS = ["sword", "axe", "bow", "torch", "pickaxe", "shield", "map"] as const;
const NATURE_LABELS = ["Oak", "Pine", "Bush", "Grass", "Flower", "Boulder", "Stump", "Campfire", "Torch"] as const;
const NATURE_XS = [5.5, 10.2, 14.5, 18.2, 21.8, 25.5, 29.2, 33.2, 37.0] as const;

export interface SandboxGallery {
  readonly lights: readonly PointLightSpec[];
  readonly propsAtlas: PropTextureSet;
  animate(timeSec: number): void;
}

function addTinyLabel(parent: Container, opts: { readonly xTiles: number; readonly yTiles: number; readonly text: string }): void {
  const lbl = new Text({
    text: opts.text, resolution: 2, roundPixels: false, textureStyle: { scaleMode: "linear" },
    style: {
      fontSize: 22, fontWeight: "700", fill: 0xf8fafc,
      fontFamily: "system-ui, -apple-system, sans-serif",
      stroke: { color: 0x090d14, width: 5, join: "round" },
    },
  });
  lbl.anchor.set(0.5, 0);
  lbl.scale.set(0.22);
  lbl.position.set(opts.xTiles * TILE_PX, opts.yTiles * TILE_PX);
  parent.addChild(lbl);
}

function addGalleryPad(parent: Container, opts: { readonly x: number; readonly y: number; readonly w?: number; readonly h?: number }): void {
  const w = (opts.w ?? 2.2) * TILE_PX;
  const h = (opts.h ?? 1.5) * TILE_PX;
  const g = new Graphics();
  g.roundRect(-w * 0.5, -h * 0.65, w, h, 3)
    .fill({ color: 0x0f172a, alpha: 0.28 })
    .stroke({ color: 0x94a3b8, alpha: 0.35, width: 1 });
  g.position.set(opts.x * TILE_PX, opts.y * TILE_PX);
  parent.addChild(g);
}

function paintTerrainSwatches(ctx: CanvasRenderingContext2D, atlas: ReturnType<typeof createTerrainTileAtlas>): void {
  SWATCH_LIST.forEach((sw, i) => {
    const x0 = 4 + i * 3.8;
    const bank = atlas.variants.get(sw.kind)!;
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        ctx.drawImage(bank[(dx + dy) & 3]!, Math.round((x0 + dx) * TERRAIN_TEX_PX), 2 * TERRAIN_TEX_PX + dy * TERRAIN_TEX_PX);
      }
    }
  });
  ctx.drawImage(atlas.cliffFace, Math.round(39 * TERRAIN_TEX_PX), 2 * TERRAIN_TEX_PX);
  ctx.drawImage(atlas.stairFace, Math.round(42 * TERRAIN_TEX_PX), 2 * TERRAIN_TEX_PX);
}

function pickArenaTile(tx: number, ty: number, banks: {
  readonly dirt: readonly HTMLCanvasElement[]; readonly meadow: readonly HTMLCanvasElement[]; readonly grass: readonly HTMLCanvasElement[];
}): HTMLCanvasElement {
  const v = (tx * 7 + ty * 13) & 3;
  if (tx >= 46 && ty >= 14 && ty <= 16) return banks.dirt[v]!;
  return ((tx + ty) % 5 === 0 ? banks.meadow : banks.grass)[v]!;
}

function paintArenaGroundCanvas(): HTMLCanvasElement {
  const atlas = createTerrainTileAtlas();
  const canvas = document.createElement("canvas");
  canvas.width = SANDBOX_W * TERRAIN_TEX_PX;
  canvas.height = SANDBOX_H * TERRAIN_TEX_PX;
  const ctx = canvas.getContext("2d")!;
  const banks = {
    grass: atlas.variants.get(GroundKind.Grass)!,
    meadow: atlas.variants.get(GroundKind.MeadowGrass)!,
    dirt: atlas.variants.get(GroundKind.DirtPath)!,
  };
  for (let ty = 0; ty < SANDBOX_H; ty++) {
    for (let tx = 0; tx < SANDBOX_W; tx++) ctx.drawImage(pickArenaTile(tx, ty, banks), tx * TERRAIN_TEX_PX, ty * TERRAIN_TEX_PX);
  }
  paintTerrainSwatches(ctx, atlas);
  return canvas;
}

function mountSprite(parent: Container, tex: Texture, opts: {
  readonly x: number; readonly y: number; readonly scale?: number; readonly ax?: number; readonly ay?: number;
}): Sprite {
  const sp = new Sprite(tex);
  sp.anchor.set(opts.ax ?? 0.5, opts.ay ?? 0.9);
  if (opts.scale !== undefined) sp.scale.set(opts.scale);
  sp.position.set(opts.x * TILE_PX, opts.y * TILE_PX);
  sp.zIndex = Math.round(opts.y * TILE_PX);
  parent.addChild(sp);
  return sp;
}

function spritePlacement(kind: PropKind, x: number, y: number) {
  const spec = getPoiPropSpriteSpec(kind);
  return spec ? { x, y, scale: spec.scale, ax: spec.anchorX, ay: spec.anchorY } : { x, y };
}

function mountNatureShowcase(layers: { readonly ground: Container; readonly ysort: Container; readonly canopy: Container }, props: PropTextureSet) {
  const s = HD_PROP_SCALE;
  mountSprite(layers.ysort, props.oakTrunk, { x: 5.5, y: 8.2, scale: s });
  mountSprite(layers.canopy, props.oakCanopy, { x: 5.5, y: 7.8, scale: s });
  mountSprite(layers.ysort, props.pineTrunk, { x: 10.2, y: 8.2, scale: s });
  mountSprite(layers.canopy, props.pineCanopy, { x: 10.2, y: 7.8, scale: s });
  mountSprite(layers.ysort, props.bush[0]!, { x: 14.5, y: 8.2, scale: s });
  mountSprite(layers.ysort, props.tallGrass[0]!, { x: 18.2, y: 8.2, scale: s, ax: 0.5, ay: 0.94 });
  mountSprite(layers.ysort, props.wildflower[0]!, { x: 21.8, y: 8.2, scale: s, ax: 0.5, ay: 0.94 });
  mountSprite(layers.ysort, props.boulder[0]!, { x: 25.5, y: 8.2, scale: s });
  mountSprite(layers.ysort, props.stump, { x: 29.2, y: 8.2, scale: s });
  const campfire = mountSprite(layers.ysort, props.campfireFrames[0]!, { x: 33.2, y: 8.2, scale: s });
  const torch = mountSprite(layers.ysort, props.torchFrames[0]!, { x: 37.0, y: 8.2, scale: s });
  NATURE_LABELS.forEach((lbl, i) => addTinyLabel(layers.ground, { xTiles: NATURE_XS[i]!, yTiles: 8.5, text: lbl }));
  return { campfire, torch };
}

function mountPoiShowcase(ysortLayer: Container, groundLayer: Container, props: PropTextureSet): void {
  for (let i = 0; i < 3; i++) mountSprite(ysortLayer, props.palisade, spritePlacement(PropKind.Palisade, 4.8 + i * 1.1, 13.4));
  addTinyLabel(groundLayer, { xTiles: 5.9, yTiles: 13.7, text: "Palisade Wall" });
  mountSprite(ysortLayer, props.tent, spritePlacement(PropKind.Tent, 11.2, 13.4));
  addTinyLabel(groundLayer, { xTiles: 11.2, yTiles: 13.7, text: "Bandit Tent" });
  mountSprite(ysortLayer, props.ruinPillar, spritePlacement(PropKind.RuinPillar, 16.5, 13.4));
  addTinyLabel(groundLayer, { xTiles: 16.5, yTiles: 13.7, text: "Ruin Pillar" });
  CHEST_LABELS.forEach((lbl, i) => {
    const cx = 24 + i * 3;
    addGalleryPad(groundLayer, { x: cx, y: 13.4, w: 2.0, h: 1.3 });
    addTinyLabel(groundLayer, { xTiles: cx, yTiles: 13.7, text: lbl });
  });
}

function mountGearAndEnemies(groundLayer: Container, ysortLayer: Container): void {
  GEAR_IDS.forEach((id, i) => {
    const gx = 5.5 + i * 3.8;
    addGalleryPad(groundLayer, { x: gx, y: 17.5, w: 2.2, h: 1.3 });
    const tex = id === "shield" ? getShieldTexture() : getHeldWeaponVisual(id, 0)?.texture;
    if (tex) mountSprite(ysortLayer, tex, { x: gx, y: 17.4, ax: 0.5, ay: 0.6, scale: id === "map" ? 0.65 : 0.85 });
    addTinyLabel(groundLayer, { xTiles: gx, yTiles: 17.85, text: id });
  });
  LINEUP_SPECS.forEach((spec, idx) => {
    const ex = SANDBOX_LINEUP_X0 + idx * SANDBOX_LINEUP_DX;
    addGalleryPad(groundLayer, { x: ex, y: SANDBOX_LINEUP_Y, w: 2.4, h: 1.7 });
    addTinyLabel(groundLayer, { xTiles: ex, yTiles: SANDBOX_LINEUP_Y + 0.55, text: spec.label });
  });
}

function addGalleryLabels(groundLayer: Container): void {
  SWATCH_LIST.forEach((sw, i) => addTinyLabel(groundLayer, { xTiles: 5.5 + i * 3.8, yTiles: 4.15, text: sw.label }));
  addTinyLabel(groundLayer, { xTiles: 39.5, yTiles: 3.15, text: "Cliff" });
  addTinyLabel(groundLayer, { xTiles: 42.5, yTiles: 3.15, text: "Stairs" });
  addTinyLabel(groundLayer, { xTiles: 44.5, yTiles: 14.3, text: "Terrain Diorama ->" });
  addTinyLabel(groundLayer, { xTiles: 58.5, yTiles: 3.4, text: "River & Sand" });
  addTinyLabel(groundLayer, { xTiles: 71.5, yTiles: 2.5, text: "Forest Grove" });
  addTinyLabel(groundLayer, { xTiles: 72.0, yTiles: 18.6, text: "Wildflower Meadow" });
  addTinyLabel(groundLayer, { xTiles: 86.0, yTiles: 25.4, text: "Cliff & Stairs" });
}

export function buildSandboxGallery(layers: {
  readonly ground: Container;
  readonly ysort: Container;
  readonly canopy: Container;
  readonly propsAtlas?: PropTextureSet;
}): SandboxGallery {
  const groundTex = Texture.from(paintArenaGroundCanvas());
  groundTex.source.scaleMode = "nearest";
  const groundSp = new Sprite(groundTex);
  groundSp.scale.set(TILE_PX / TERRAIN_TEX_PX);
  layers.ground.addChild(groundSp);
  const props = layers.propsAtlas ?? createPropTextureSet();
  const { campfire, torch } = mountNatureShowcase(layers, props);
  mountPoiShowcase(layers.ysort, layers.ground, props);
  mountGearAndEnemies(layers.ground, layers.ysort);
  addGalleryLabels(layers.ground);

  const lights: PointLightSpec[] = [
    { id: "sbx-fire", kind: "campfire", x: 33.2, y: 8.0, color: 0xffa040, radiusPx: 145, intensity: 1.25 },
    { id: "sbx-torch", kind: "torch", x: 37.0, y: 7.9, color: 0xffb84d, radiusPx: 95, intensity: 1.0 },
  ];
  return {
    lights,
    propsAtlas: props,
    animate(timeSec: number): void {
      campfire.texture = props.campfireFrames[Math.floor(timeSec * 10) % props.campfireFrames.length]!;
      torch.texture = props.torchFrames[Math.floor(timeSec * 10) % props.torchFrames.length]!;
    },
  };
}
