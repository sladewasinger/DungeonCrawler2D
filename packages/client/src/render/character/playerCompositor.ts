/** Data-driven 3D Hero compositor building baked-arm layer sheets + bold Borderlands outlines. */
import { ACTIVE_OUTLINE_STYLE, getItemDef } from "@dc2d/content";
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import { Rectangle, Texture, type TextureSource } from "pixi.js";
import { createPixelCanvas } from "../textures/pixelCanvas.js";
import type { CharacterSpriteSet, DirectionAnim, FacingDir } from "./characterTypes.js";
import {
  ensurePlayerLayersLoaded, getPlayerLayerImage, getPlayerPortraitLayer, getPlayerRigMeta, resolvePortraitCell,
  type PlayerRigMeta,
} from "./playerAssets.js";
import { applyRecolorPass, applyUnifiedSelOut, resolveSentinelPalettes } from "./playerRecolor.js";

export { remapSentinelPixel, remapSentinelPixelAt, resolveSentinelPalettes, type RgbTriad, type SentinelPalettes, type TriadRgbSet } from "./playerRecolor.js";

const BODY_FEMALE = "female";
export const MAX_PLAYER_ATLAS_DIM = 4096;

interface OrderedLayer { readonly id: string; readonly zOrder: number; }

export interface PackedAtlasLayout {
  readonly rowsPerStrip: number;
  readonly stripCount: number;
  readonly stripW: number;
  readonly width: number;
  readonly height: number;
}

export function computePackedAtlasLayout(
  meta: Pick<PlayerRigMeta, "cols" | "rows" | "frameWidth" | "frameHeight">,
  maxDim = MAX_PLAYER_ATLAS_DIM,
): PackedAtlasLayout {
  const stripW = meta.cols * meta.frameWidth;
  const rowsPerStrip = Math.max(1, Math.min(meta.rows, Math.floor(maxDim / meta.frameHeight)));
  const stripCount = Math.ceil(meta.rows / rowsPerStrip);
  return {
    rowsPerStrip,
    stripCount,
    stripW,
    width: stripCount * stripW,
    height: rowsPerStrip * meta.frameHeight,
  };
}

export function mapSheetCellToAtlas(opts: {
  readonly layout: PackedAtlasLayout;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly row: number;
  readonly col: number;
}): { readonly x: number; readonly y: number } {
  const strip = Math.floor(opts.row / opts.layout.rowsPerStrip);
  const localRow = opts.row % opts.layout.rowsPerStrip;
  return {
    x: strip * opts.layout.stripW + opts.col * opts.frameWidth,
    y: localRow * opts.frameHeight,
  };
}

function pushSingleItemLayer(opts: {
  readonly itemId: string | null; readonly gTag: string; readonly includeArms: boolean; readonly list: OrderedLayer[];
}): boolean {
  const spec = opts.itemId ? getItemDef(opts.itemId)?.visualLayer : undefined;
  if (!spec) return false;
  opts.list.push({ id: spec.gendered ? `${spec.assetId}-${opts.gTag}` : spec.assetId, zOrder: spec.zOrder });
  if (opts.includeArms && spec.sleeveAssetId) {
    opts.list.push({ id: `${spec.sleeveAssetId}-${opts.gTag}`, zOrder: spec.zOrder + 5 });
  }
  return Boolean(spec.hidesHair);
}

function pushEquipmentLayers(opts: {
  readonly armor: ArmorEquipment; readonly gTag: string; readonly includeArms: boolean; readonly list: OrderedLayer[];
}): boolean {
  let hidesHair = false;
  for (const itemId of Object.values(opts.armor)) {
    if (pushSingleItemLayer({ itemId, gTag: opts.gTag, includeArms: opts.includeArms, list: opts.list })) hidesHair = true;
  }
  return hidesHair;
}

export function resolveLayerStack(appearance: CharacterAppearance, armor: ArmorEquipment, includeArms = true): string[] {
  const gTag = appearance.body === BODY_FEMALE ? BODY_FEMALE : "male";
  const list: OrderedLayer[] = [{ id: `body-${gTag}`, zOrder: 0 }];
  if (includeArms) list.push({ id: `body-${gTag}-arms`, zOrder: 5 });
  const hidesHair = pushEquipmentLayers({ armor, gTag, includeArms, list });
  if (!hidesHair && appearance.hairStyle !== "bald") list.push({ id: `hair-${appearance.hairStyle}`, zOrder: 45 });
  list.sort((a, b) => a.zOrder - b.zOrder);
  return list.map((e) => e.id);
}

function sliceDirAnim(opts: {
  readonly source: TextureSource; readonly meta: PlayerRigMeta; readonly layout: PackedAtlasLayout; readonly dirIdx: number;
}): DirectionAnim {
  const { source, meta, layout, dirIdx } = opts;
  const fw = meta.frameWidth; const fh = meta.frameHeight;
  const grab = (state: string): Texture[] => {
    const clip = meta.clips[state];
    if (!clip) return [];
    const row = clip.startRow + dirIdx;
    return Array.from({ length: clip.frames }, (_, col) => {
      const pos = mapSheetCellToAtlas({ layout, frameWidth: fw, frameHeight: fh, row, col });
      return new Texture({ source, frame: new Rectangle(pos.x, pos.y, fw, fh) });
    });
  };
  return {
    idle: grab("idle"), walk: grab("walk"), run: grab("run"), jump: grab("jump"), fall: grab("fall"),
    dodge: grab("dodge"), downed: grab("downed"), swim: grab("swim"), bow: grab("bow"),
    crouchIdle: grab("crouch_idle"), crouchWalk: grab("crouch_walk"), attack: grab("attack"),
  };
}

function sliceAllDirs(source: TextureSource, meta: PlayerRigMeta, layout: PackedAtlasLayout): Readonly<Record<FacingDir, DirectionAnim>> {
  const byDir = (d: FacingDir) => sliceDirAnim({ source, meta, layout, dirIdx: Math.max(0, meta.directions.indexOf(d)) });
  return { south: byDir("south"), se: byDir("se"), side: byDir("side"), ne: byDir("ne"), north: byDir("north") };
}

export interface PortraitCropRect {
  readonly cw: number;
  readonly ch: number;
  readonly localX: number;
  readonly localY: number;
}

interface ScratchSurface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
}

let portraitCellScratch: ScratchSurface | null = null;
let portraitCropScratch: ScratchSurface | null = null;

function acquireScratch(
  current: ScratchSurface | null,
  w: number,
  h: number,
): ScratchSurface {
  if (current && current.canvas.width === w && current.canvas.height === h) {
    current.ctx.clearRect(0, 0, w, h);
    return current;
  }
  return createPixelCanvas(w, h);
}

export function computePortraitCropRect(
  meta: Pick<PlayerRigMeta, "frameWidth" | "frameHeight" | "groundY" | "scale">,
): PortraitCropRect {
  const resMul = (1 / 3) / meta.scale;
  const cw = Math.round(64 * resMul);
  const ch = Math.round(82 * resMul);
  return {
    cw,
    ch,
    localX: Math.floor((meta.frameWidth - cw) * 0.5),
    localY: meta.groundY - ch + Math.round(8 * resMul),
  };
}

function extractPortraitUrl(srcCanvas: HTMLCanvasElement, meta: PlayerRigMeta, layout: PackedAtlasLayout): string {
  const crop = computePortraitCropRect(meta);
  const cell = resolvePortraitCell(meta);
  const pos = mapSheetCellToAtlas({ layout, frameWidth: meta.frameWidth, frameHeight: meta.frameHeight, row: cell.row, col: cell.col });
  const { canvas, ctx } = createPixelCanvas(crop.cw, crop.ch);
  ctx.drawImage(srcCanvas, pos.x + crop.localX, pos.y + crop.localY, crop.cw, crop.ch, 0, 0, crop.cw, crop.ch);
  return canvas.toDataURL();
}

function drawPortraitLayers(opts: {
  readonly ctx: CanvasRenderingContext2D; readonly layerIds: readonly string[]; readonly meta: PlayerRigMeta;
}): void {
  const { ctx, layerIds, meta } = opts;
  const fw = meta.frameWidth;
  const fh = meta.frameHeight;
  const cell = resolvePortraitCell(meta);
  const sx = cell.col * fw;
  const sy = cell.row * fh;
  for (const id of layerIds) {
    const sliced = getPlayerPortraitLayer(id);
    if (sliced) { ctx.drawImage(sliced, 0, 0); continue; }
    const fullImg = getPlayerLayerImage(id);
    if (fullImg) ctx.drawImage(fullImg, sx, sy, fw, fh, 0, 0, fw, fh);
  }
}

export function build3dCharacterPortraitUrl(
  appearance: CharacterAppearance,
  armor: ArmorEquipment,
): string | null {
  if (typeof document === "undefined") return null;
  const meta = getPlayerRigMeta();
  if (!meta) return null;
  const fw = meta.frameWidth;
  const fh = meta.frameHeight;
  portraitCellScratch = acquireScratch(portraitCellScratch, fw, fh);
  drawPortraitLayers({ ctx: portraitCellScratch.ctx, layerIds: resolveLayerStack(appearance, armor, true), meta });
  const imgData = portraitCellScratch.ctx.getImageData(0, 0, fw, fh);
  applyRecolorPass({
    data: imgData.data, width: fw, height: fh, palettes: resolveSentinelPalettes(appearance), cellW: fw, cellH: fh,
  });
  const solidRadiusPx = ACTIVE_OUTLINE_STYLE.actorSolidPx * Math.min(1.65, (1 / 3) / meta.scale);
  applyUnifiedSelOut({ data: imgData.data, width: fw, height: fh, solidRadiusPx });
  portraitCellScratch.ctx.putImageData(imgData, 0, 0);
  const crop = computePortraitCropRect(meta);
  portraitCropScratch = acquireScratch(portraitCropScratch, crop.cw, crop.ch);
  portraitCropScratch.ctx.drawImage(portraitCellScratch.canvas, crop.localX, crop.localY, crop.cw, crop.ch, 0, 0, crop.cw, crop.ch);
  return portraitCropScratch.canvas.toDataURL();
}

function drawPackedLayer(opts: {
  readonly ctx: CanvasRenderingContext2D; readonly img: HTMLImageElement;
  readonly meta: PlayerRigMeta; readonly layout: PackedAtlasLayout;
}): void {
  const { ctx, img, meta, layout } = opts;
  const fh = meta.frameHeight;
  for (let s = 0; s < layout.stripCount; s++) {
    const startRow = s * layout.rowsPerStrip;
    const rowCount = Math.min(layout.rowsPerStrip, meta.rows - startRow);
    if (rowCount <= 0) break;
    const sh = rowCount * fh;
    ctx.drawImage(img, 0, startRow * fh, layout.stripW, sh, s * layout.stripW, 0, layout.stripW, sh);
  }
}

function compositeSheetCanvas(opts: {
  readonly layerIds: readonly string[]; readonly meta: PlayerRigMeta; readonly appearance: CharacterAppearance;
}): { readonly canvas: HTMLCanvasElement; readonly source: TextureSource; readonly layout: PackedAtlasLayout } {
  const { layerIds, meta, appearance } = opts;
  const layout = computePackedAtlasLayout(meta);
  const { canvas, ctx } = createPixelCanvas(layout.width, layout.height);
  for (const id of layerIds) {
    const img = getPlayerLayerImage(id);
    if (img) drawPackedLayer({ ctx, img, meta, layout });
  }
  const imgData = ctx.getImageData(0, 0, layout.width, layout.height);
  applyRecolorPass({
    data: imgData.data, width: layout.width, height: layout.height, palettes: resolveSentinelPalettes(appearance),
    cellW: meta.frameWidth, cellH: meta.frameHeight,
  });
  const resMul = (1 / 3) / meta.scale;
  const solidRadiusPx = ACTIVE_OUTLINE_STYLE.actorSolidPx * Math.min(1.65, resMul);
  applyUnifiedSelOut({ data: imgData.data, width: layout.width, height: layout.height, solidRadiusPx });
  ctx.putImageData(imgData, 0, 0);
  return { canvas, source: Texture.from({ resource: canvas, scaleMode: "nearest" }).source, layout };
}

export function build3dCharacterSpriteSet(
  appearance: CharacterAppearance,
  armor: ArmorEquipment,
  onLazyReady?: () => void,
): CharacterSpriteSet | null {
  const meta = getPlayerRigMeta();
  if (!meta) return null;
  const fullIds = resolveLayerStack(appearance, armor, true);
  if (onLazyReady) ensurePlayerLayersLoaded(fullIds, onLazyReady);
  const full = compositeSheetCanvas({ layerIds: fullIds, meta, appearance });
  return {
    ...sliceAllDirs(full.source, meta, full.layout),
    frontArm: Texture.EMPTY, backArm: Texture.EMPTY,
    worldScale: meta.scale, anchorY: meta.anchorY, is3d: true, previewUrl: extractPortraitUrl(full.canvas, meta, full.layout),
  };
}
