/** Equipment layer stack resolver & 3D character portrait extractor/baker. */
import { ACTIVE_OUTLINE_STYLE, getItemDef } from "@dc2d/content";
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import { createPixelCanvas } from "../../textures/pixelCanvas.js";
import { getPlayerLayerImage, getPlayerPortraitLayer, getPlayerRigMeta, resolvePortraitCell, type PlayerRigMeta } from "../playerAssets.js";
import { applyRecolorPass, applyUnifiedSelOut, resolveSentinelPalettes } from "../playerRecolor.js";
import { drawRecoloredCell, type StyledLayerEntry } from "./armorLayerRecolor.js";
import { CORE_CLIP_NAMES, findSlotInPlan, type PackedTierAtlas } from "./playerAtlasPacker.js";

const BODY_FEMALE = "female";

interface OrderedLayer extends StyledLayerEntry { readonly zOrder: number; }

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

function acquireScratch(current: ScratchSurface | null, w: number, h: number): ScratchSurface {
  if (current && current.canvas.width === w && current.canvas.height === h) {
    current.ctx.clearRect(0, 0, w, h);
    return current;
  }
  return createPixelCanvas(w, h);
}

const layerRecolorProps = (spec: { readonly recolorPrimary?: string; readonly recolorTrim?: string }) => ({
  ...(spec.recolorPrimary ? { recolorPrimary: spec.recolorPrimary } : {}),
  ...(spec.recolorTrim ? { recolorTrim: spec.recolorTrim } : {}),
});

function pushSingleItemLayer(opts: {
  readonly itemId: string | null; readonly gTag: string; readonly includeArms: boolean; readonly list: OrderedLayer[];
}): boolean {
  const spec = opts.itemId ? getItemDef(opts.itemId)?.visualLayer : undefined;
  if (!spec) return false;
  const recolor = layerRecolorProps(spec);
  opts.list.push({ id: spec.gendered ? `${spec.assetId}-${opts.gTag}` : spec.assetId, zOrder: spec.zOrder, ...recolor });
  if (opts.includeArms && spec.sleeveAssetId) {
    opts.list.push({ id: `${spec.sleeveAssetId}-${opts.gTag}`, zOrder: spec.zOrder + 5, ...recolor });
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

export function resolveStyledLayerStack(appearance: CharacterAppearance, armor: ArmorEquipment, includeArms = true): StyledLayerEntry[] {
  const gTag = appearance.body === BODY_FEMALE ? BODY_FEMALE : "male";
  const list: OrderedLayer[] = [{ id: `body-${gTag}`, zOrder: 0 }];
  if (includeArms) list.push({ id: `body-${gTag}-arms`, zOrder: 5 });
  const hidesHair = pushEquipmentLayers({ armor, gTag, includeArms, list });
  if (!hidesHair && appearance.hairStyle !== "bald") list.push({ id: `hair-${appearance.hairStyle}`, zOrder: 45 });
  list.sort((a, b) => a.zOrder - b.zOrder);
  return list.map(({ id, recolorPrimary, recolorTrim }) => ({
    id,
    ...(recolorPrimary ? { recolorPrimary } : {}),
    ...(recolorTrim ? { recolorTrim } : {}),
  }));
}

export function resolveLayerStack(appearance: CharacterAppearance, armor: ArmorEquipment, includeArms = true): string[] {
  return resolveStyledLayerStack(appearance, armor, includeArms).map((e) => e.id);
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

function drawPortraitLayers(opts: {
  readonly ctx: CanvasRenderingContext2D; readonly layers: readonly StyledLayerEntry[]; readonly meta: PlayerRigMeta;
}): void {
  const { ctx, layers, meta } = opts;
  const fw = meta.frameWidth; const fh = meta.frameHeight;
  const cell = resolvePortraitCell(meta);
  const sx = cell.col * fw; const sy = cell.row * fh;
  for (const layer of layers) {
    const sliced = getPlayerPortraitLayer(layer.id);
    if (sliced) {
      drawRecoloredCell({ ctx, source: sliced, sx: 0, sy: 0, w: fw, h: fh, recolorPrimary: layer.recolorPrimary, recolorTrim: layer.recolorTrim });
      continue;
    }
    const fullImg = getPlayerLayerImage(layer.id);
    if (fullImg) drawRecoloredCell({ ctx, source: fullImg, sx, sy, w: fw, h: fh, recolorPrimary: layer.recolorPrimary, recolorTrim: layer.recolorTrim });
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
  drawPortraitLayers({ ctx: portraitCellScratch.ctx, layers: resolveStyledLayerStack(appearance, armor, true), meta });
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

export function extractPortraitUrlFromCore(opts: {
  readonly coreCanvas: HTMLCanvasElement; readonly meta: PlayerRigMeta;
  readonly corePlan: PackedTierAtlas; readonly appearance: CharacterAppearance; readonly armor: ArmorEquipment;
}): string {
  const seIdx = opts.meta.directions.indexOf("se");
  const slot = seIdx >= 0 ? findSlotInPlan(opts.corePlan, { clip: CORE_CLIP_NAMES[0], dirIdx: seIdx, col: 0 }) : null;
  if (!slot) return build3dCharacterPortraitUrl(opts.appearance, opts.armor) ?? "";
  const crop = computePortraitCropRect(opts.meta);
  const { canvas, ctx } = createPixelCanvas(crop.cw, crop.ch);
  ctx.drawImage(
    opts.coreCanvas, slot.dstX, slot.dstY, slot.w, slot.h,
    slot.trimX - crop.localX, slot.trimY - crop.localY, slot.w, slot.h,
  );
  return canvas.toDataURL();
}
