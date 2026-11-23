/** Data-driven 3D Hero compositor building baked-arm layer sheets + bold Borderlands outlines. */
import { ACTIVE_OUTLINE_STYLE, getItemDef } from "@dc2d/content";
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import { Rectangle, Texture, type TextureSource } from "pixi.js";
import { createPixelCanvas } from "../textures/pixelCanvas.js";
import type { CharacterSpriteSet, DirectionAnim, FacingDir } from "./characterTypes.js";
import { ensurePlayerLayersLoaded, getPlayerLayerImage, getPlayerRigMeta, type PlayerRigMeta } from "./playerAssets.js";
import { applyRecolorPass, applyUnifiedSelOut, resolveSentinelPalettes } from "./playerRecolor.js";

export { remapSentinelPixel, remapSentinelPixelAt, resolveSentinelPalettes, type RgbTriad, type SentinelPalettes, type TriadRgbSet } from "./playerRecolor.js";

const BODY_FEMALE = "female";

interface OrderedLayer { readonly id: string; readonly zOrder: number; }

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

function sliceDirAnim(opts: { readonly source: TextureSource; readonly meta: PlayerRigMeta; readonly dirIdx: number }): DirectionAnim {
  const { source, meta, dirIdx } = opts;
  const fw = meta.frameWidth; const fh = meta.frameHeight;
  const grab = (state: string): Texture[] => {
    const clip = meta.clips[state];
    if (!clip) return [];
    const row = clip.startRow + dirIdx;
    return Array.from({ length: clip.frames }, (_, c) => new Texture({ source, frame: new Rectangle(c * fw, row * fh, fw, fh) }));
  };
  return {
    idle: grab("idle"), walk: grab("walk"), run: grab("run"), jump: grab("jump"), fall: grab("fall"),
    dodge: grab("dodge"), downed: grab("downed"), swim: grab("swim"), bow: grab("bow"),
    crouchIdle: grab("crouch_idle"), crouchWalk: grab("crouch_walk"), attack: grab("attack"),
  };
}

function sliceAllDirs(source: TextureSource, meta: PlayerRigMeta): Readonly<Record<FacingDir, DirectionAnim>> {
  const byDir = (d: FacingDir) => sliceDirAnim({ source, meta, dirIdx: Math.max(0, meta.directions.indexOf(d)) });
  return { south: byDir("south"), se: byDir("se"), side: byDir("side"), ne: byDir("ne"), north: byDir("north") };
}

function extractPortraitUrl(srcCanvas: HTMLCanvasElement, meta: PlayerRigMeta): string {
  const resMul = (1 / 3) / meta.scale;
  const cw = Math.round(64 * resMul);
  const ch = Math.round(82 * resMul);
  const { canvas, ctx } = createPixelCanvas(cw, ch);
  const sx = meta.portraitCol * meta.frameWidth + Math.floor((meta.frameWidth - cw) * 0.5);
  const sy = meta.portraitRow * meta.frameHeight + meta.groundY - ch + Math.round(8 * resMul);
  ctx.drawImage(srcCanvas, sx, sy, cw, ch, 0, 0, cw, ch);
  return canvas.toDataURL();
}

function compositeSheetCanvas(opts: {
  readonly layerIds: readonly string[]; readonly meta: PlayerRigMeta; readonly appearance: CharacterAppearance;
}): { readonly canvas: HTMLCanvasElement; readonly source: TextureSource } {
  const { layerIds, meta, appearance } = opts;
  const w = meta.cols * meta.frameWidth; const h = meta.rows * meta.frameHeight;
  const { canvas, ctx } = createPixelCanvas(w, h);
  for (const id of layerIds) {
    const img = getPlayerLayerImage(id);
    if (img) ctx.drawImage(img, 0, 0);
  }
  const imgData = ctx.getImageData(0, 0, w, h);
  applyRecolorPass({
    data: imgData.data, width: w, height: h, palettes: resolveSentinelPalettes(appearance),
    cellW: meta.frameWidth, cellH: meta.frameHeight,
  });
  const resMul = (1 / 3) / meta.scale;
  const solidRadiusPx = ACTIVE_OUTLINE_STYLE.actorSolidPx * Math.min(1.65, resMul);
  applyUnifiedSelOut({ data: imgData.data, width: w, height: h, solidRadiusPx });
  ctx.putImageData(imgData, 0, 0);
  return { canvas, source: Texture.from({ resource: canvas, scaleMode: "nearest" }).source };
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
    ...sliceAllDirs(full.source, meta),
    frontArm: Texture.EMPTY, backArm: Texture.EMPTY,
    worldScale: meta.scale, anchorY: meta.anchorY, is3d: true, previewUrl: extractPortraitUrl(full.canvas, meta),
  };
}
