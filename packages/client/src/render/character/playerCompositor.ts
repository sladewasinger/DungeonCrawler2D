/** Data-driven 3D Hero compositor building baked-arm & bow-only armless sheets + bold Borderlands outlines. */
import { ARMOR_VISUAL_STYLES, SKIN_PALETTES, getArmorVisualStyle, getItemDef, type ToneTriad } from "@dc2d/content";
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import { Rectangle, Texture, type TextureSource } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas } from "../textures/pixelCanvas.js";
import type { ArmSegmentTextures, CharacterSpriteSet, DirectionAnim, FacingDir } from "./characterTypes.js";
import { ensurePlayerLayersLoaded, getPlayerLayerImage, getPlayerRigMeta, type PlayerRigMeta } from "./playerAssets.js";
import { applyRecolorPass, applyUnifiedSelOut, computeSelOutRgb, resolveSentinelPalettes, toTriadRgb, type RgbTriad, type TriadRgbSet } from "./playerRecolor.js";

export type { ArmSegmentTextures } from "./characterTypes.js";
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
  return { idle: grab("idle"), walk: grab("walk"), run: grab("run"), jump: grab("jump"), fall: grab("fall"), dodge: grab("dodge"), downed: grab("downed"), swim: grab("swim") };
}

function sliceAllDirs(source: TextureSource, meta: PlayerRigMeta): Readonly<Record<FacingDir, DirectionAnim>> {
  const byDir = (d: FacingDir) => sliceDirAnim({ source, meta, dirIdx: Math.max(0, meta.directions.indexOf(d)) });
  return { south: byDir("south"), se: byDir("se"), side: byDir("side"), ne: byDir("ne"), north: byDir("north") };
}

function extractPortraitUrl(srcCanvas: HTMLCanvasElement, meta: PlayerRigMeta): string {
  const cw = 64; const ch = 82;
  const { canvas, ctx } = createPixelCanvas(cw, ch);
  const sx = meta.portraitCol * meta.frameWidth + Math.floor((meta.frameWidth - cw) * 0.5);
  const sy = meta.portraitRow * meta.frameHeight + meta.groundY - ch + 8;
  ctx.drawImage(srcCanvas, sx, sy, cw, ch, 0, 0, cw, ch);
  return canvas.toDataURL();
}

function capsuleDist(pts: { readonly px: number; readonly py: number; readonly cy: number; readonly x0: number; readonly x1: number }): number {
  const cx = Math.max(pts.x0, Math.min(pts.x1, pts.px));
  return Math.hypot(pts.px - cx, pts.py - pts.cy);
}

function pickCapsuleColor(opts: { readonly p: TriadRgbSet; readonly dy: number; readonly radius: number; readonly shaded: boolean }): RgbTriad {
  if (opts.shaded || opts.dy > opts.radius * 0.35) return opts.p.shade;
  return opts.dy < -opts.radius * 0.25 ? opts.p.highlight : opts.p.base;
}

function writeRgbaPixel(buf: Uint8ClampedArray, p: number, rgb: RgbTriad | null): void {
  if (!rgb) return;
  buf[p] = rgb[0]; buf[p + 1] = rgb[1]; buf[p + 2] = rgb[2]; buf[p + 3] = 255;
}

function rasterizeTexture(w: number, h: number, sample: (px: number, py: number) => RgbTriad | null): Texture {
  const { canvas, ctx } = createPixelCanvas(w, h);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) writeRgbaPixel(img.data, (y * w + x) * 4, sample(x + 0.5, y + 0.5));
  }
  ctx.putImageData(img, 0, 0);
  return canvasToNearestTexture(canvas);
}

function renderCapsuleFill(opts: {
  readonly w?: number | undefined; readonly x1: number; readonly radius: number; readonly triad: TriadRgbSet;
  readonly capSkin?: TriadRgbSet | undefined; readonly capX?: number | undefined; readonly shaded: boolean;
}): Texture {
  const capX = opts.capX ?? 11.5;
  return rasterizeTexture(opts.w ?? 20, 18, (px, py) => {
    if (capsuleDist({ px, py, cy: 9, x0: 5, x1: opts.x1 }) > opts.radius) return null;
    const pal = opts.capSkin && px >= capX ? opts.capSkin : opts.triad;
    return pickCapsuleColor({ p: pal, dy: py - 9, radius: opts.radius, shaded: opts.shaded });
  });
}

function renderCapsuleOutline(opts: {
  readonly w?: number | undefined; readonly x0: number; readonly x1: number; readonly radius: number;
  readonly shadeRgb: RgbTriad; readonly capShadeRgb?: RgbTriad | undefined; readonly capX?: number | undefined;
}): Texture {
  const capX = opts.capX ?? 11.5;
  return rasterizeTexture(opts.w ?? 20, 18, (px, py) => {
    if (capsuleDist({ px, py, cy: 9, x0: opts.x0, x1: opts.x1 }) > opts.radius + 3.6) return null;
    const base = opts.capShadeRgb && px >= capX ? opts.capShadeRgb : opts.shadeRgb;
    return computeSelOutRgb(base[0], base[1], base[2]);
  });
}

function renderHandCircle(opts: { readonly skin: TriadRgbSet; readonly shaded: boolean; readonly mode: "full" | "fill" | "outline" }): Texture {
  const { skin, shaded, mode } = opts;
  const outlineRgb = computeSelOutRgb(skin.shade[0], skin.shade[1], skin.shade[2]);
  return rasterizeTexture(15, 15, (px, py) => {
    const dist = Math.hypot(px - 7.5, py - 7.5);
    if (dist > (mode === "fill" ? 3.1 : 6.4)) return null;
    if (mode === "outline") return outlineRgb;
    return dist <= 3.1 ? pickCapsuleColor({ p: skin, dy: py - 7.5, radius: 3.1, shaded }) : outlineRgb;
  });
}

function buildArmSegmentTextures(appearance: CharacterAppearance, armor: ArmorEquipment): ArmSegmentTextures {
  const r = appearance.body === BODY_FEMALE ? 2.6 : 3.5;
  const skin = toTriadRgb(SKIN_PALETTES[appearance.skin] ?? SKIN_PALETTES.warm!);
  const tunic = getArmorVisualStyle(armor.chest);
  const bracer = armor.chest ? getArmorVisualStyle("leather-boots") : undefined;
  const upperPal: TriadRgbSet = tunic ? toTriadRgb(tunic) : skin;
  const forePal: TriadRgbSet = bracer ? toTriadRgb(bracer) : skin;
  const capSkin = armor.chest ? skin : undefined;
  return {
    upperFront: renderCapsuleFill({ x1: 13.5, radius: r, triad: upperPal, shaded: false }),
    upperBack: renderCapsuleFill({ x1: 13.5, radius: r, triad: upperPal, shaded: true }),
    upperOutline: renderCapsuleOutline({ x0: 6.5, x1: 13.5, radius: r, shadeRgb: upperPal.shade }),
    forearmFront: renderCapsuleFill({ w: 22, x1: 15.2, radius: r - 0.3, triad: forePal, capSkin, capX: 13.0, shaded: false }),
    forearmBack: renderCapsuleFill({ w: 22, x1: 15.2, radius: r - 0.3, triad: forePal, capSkin, capX: 13.0, shaded: true }),
    forearmOutline: renderCapsuleOutline({ w: 22, x0: 5, x1: 15.2, radius: r - 0.3, shadeRgb: forePal.shade, capShadeRgb: capSkin?.shade, capX: 13.0 }),
    handFront: renderHandCircle({ skin, shaded: false, mode: "full" }),
    handBack: renderHandCircle({ skin, shaded: true, mode: "full" }),
    handOutline: renderHandCircle({ skin, shaded: false, mode: "outline" }),
    handFillFront: renderHandCircle({ skin, shaded: false, mode: "fill" }),
    handFillBack: renderHandCircle({ skin, shaded: true, mode: "fill" }),
  };
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
  applyUnifiedSelOut(imgData.data, w, h);
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
  const armlessIds = resolveLayerStack(appearance, armor, false);
  if (onLazyReady) ensurePlayerLayersLoaded([...new Set([...fullIds, ...armlessIds])], onLazyReady);
  const full = compositeSheetCanvas({ layerIds: fullIds, meta, appearance });
  const armless = compositeSheetCanvas({ layerIds: armlessIds, meta, appearance });
  const armSegments = buildArmSegmentTextures(appearance, armor);
  return {
    ...sliceAllDirs(full.source, meta),
    armless: sliceAllDirs(armless.source, meta),
    frontArm: armSegments.upperFront, backArm: armSegments.upperBack, armSegments,
    worldScale: meta.scale, anchorY: meta.anchorY, is3d: true, previewUrl: extractPortraitUrl(full.canvas, meta),
  };
}

export function defaultArmPaletteFallback(): ToneTriad {
  return ARMOR_VISUAL_STYLES["leather-tunic"]!;
}
