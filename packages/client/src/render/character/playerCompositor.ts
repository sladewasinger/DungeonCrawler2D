/** Runtime Sentinel-palette recoloring, multi-layer compositing, sel-out outlining, and 3D arm-segment baking. */
import { EYE_PALETTES, HAIR_PALETTES, SKIN_PALETTES, getArmorVisualStyle, type ToneTriad } from "@dc2d/content";
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import { Rectangle, Texture, type TextureSource } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas } from "../textures/pixelCanvas.js";
import type { ArmSegmentTextures, CharacterSpriteSet, DirectionAnim, FacingDir } from "./characterTypes.js";
import { getPlayerLayerImage, getPlayerRigMeta, type PlayerRigMeta } from "./playerAssets.js";

export type { ArmSegmentTextures } from "./characterTypes.js";

const BODY_FEMALE = "female";

export type RgbTriad = readonly [number, number, number];
export interface TriadRgbSet { readonly base: RgbTriad; readonly shade: RgbTriad; readonly highlight: RgbTriad; }
export interface SentinelPalettes { readonly skin: TriadRgbSet; readonly iris: TriadRgbSet; readonly hair: TriadRgbSet; }

function hexToRgb(hex: string): RgbTriad {
  const c = hex.startsWith("#") ? hex.slice(1) : hex;
  return [Number.parseInt(c.slice(0, 2), 16), Number.parseInt(c.slice(2, 4), 16), Number.parseInt(c.slice(4, 6), 16)];
}

function toTriadRgb(triad: ToneTriad): TriadRgbSet {
  return { base: hexToRgb(triad.base), shade: hexToRgb(triad.shade), highlight: hexToRgb(triad.highlight) };
}

export function resolveSentinelPalettes(appearance: CharacterAppearance): SentinelPalettes {
  const skin = SKIN_PALETTES[appearance.skin] ?? SKIN_PALETTES.warm!;
  const iris = EYE_PALETTES[appearance.eyeColor] ?? EYE_PALETTES.brown!;
  const hair = HAIR_PALETTES[appearance.hairColor] ?? HAIR_PALETTES.brown!;
  return { skin: toTriadRgb(skin), iris: toTriadRgb(iris), hair: toTriadRgb(hair) };
}

function pickBandRgb(triad: TriadRgbSet, dom: number): RgbTriad {
  if (dom >= 230) return triad.highlight;
  if (dom >= 185) return triad.base;
  if (dom >= 135) return triad.shade;
  const k = Math.max(0.55, dom / 160);
  return [Math.round(triad.shade[0] * k), Math.round(triad.shade[1] * k), Math.round(triad.shade[2] * k)];
}

function isSkinSentinel(r: number, g: number, b: number): boolean {
  return r >= 45 && b >= 20 && r - g >= 35 && b - g >= 20;
}

function isIrisSentinel(r: number, g: number, b: number): boolean {
  return b >= 65 && g >= 45 && b - r >= 40 && g - r >= 35;
}

function isHairSentinel(r: number, g: number, b: number): boolean {
  return g >= 55 && g - b >= 45 && g - r >= 25;
}

export function remapSentinelPixel(rgb: RgbTriad, palettes: SentinelPalettes): RgbTriad | null {
  const [r, g, b] = rgb;
  if (isSkinSentinel(r, g, b)) return pickBandRgb(palettes.skin, r);
  if (isIrisSentinel(r, g, b)) return pickBandRgb(palettes.iris, b);
  if (isHairSentinel(r, g, b)) return pickBandRgb(palettes.hair, g);
  return null;
}

function computeSelOutRgb(r: number, g: number, b: number): RgbTriad {
  return [Math.max(12, Math.round(r * 0.3 + 7)), Math.max(10, Math.round(g * 0.28 + 4)), Math.max(18, Math.round(b * 0.34 + 12))];
}

function applyRecolorPass(data: Uint8ClampedArray, palettes: SentinelPalettes): void {
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) === 0) continue;
    const mapped = remapSentinelPixel([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0], palettes);
    if (!mapped) continue;
    data[i] = mapped[0]; data[i + 1] = mapped[1]; data[i + 2] = mapped[2];
  }
}

function readOpaqueRgb(src: Uint8ClampedArray, idx: number): RgbTriad | null {
  const p = idx * 4;
  return (src[p + 3] ?? 0) === 0 ? null : [src[p] ?? 0, src[p + 1] ?? 0, src[p + 2] ?? 0];
}

function pixelLuma(c: RgbTriad): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
}

const DISK_2PX_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
  [-2, 0], [2, 0], [0, -2], [0, 2],
];

function neighborIndices2px(idx: number, w: number, h: number): number[] {
  const x = idx % w;
  const y = (idx - x) / w;
  const out: number[] = [];
  for (const [dx, dy] of DISK_2PX_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < w && ny >= 0 && ny < h) out.push(ny * w + nx);
  }
  return out;
}

function darkestNeighbor(src: Uint8ClampedArray, idx: number, ctx: { readonly w: number; readonly h: number }): RgbTriad | null {
  let best: RgbTriad | null = null;
  let bestLuma = Infinity;
  for (const ni of neighborIndices2px(idx, ctx.w, ctx.h)) {
    const c = readOpaqueRgb(src, ni);
    if (!c) continue;
    const luma = pixelLuma(c);
    if (luma < bestLuma) { bestLuma = luma; best = c; }
  }
  return best;
}

function applyUnifiedSelOut(data: Uint8ClampedArray, w: number, h: number): void {
  const src = new Uint8ClampedArray(data);
  const total = w * h;
  for (let i = 0; i < total; i++) {
    if ((src[i * 4 + 3] ?? 0) > 0) continue;
    const n = darkestNeighbor(src, i, { w, h });
    if (!n) continue;
    const edge = computeSelOutRgb(n[0], n[1], n[2]);
    const p = i * 4;
    data[p] = edge[0]; data[p + 1] = edge[1]; data[p + 2] = edge[2]; data[p + 3] = 255;
  }
}

function pushHeadLayer(out: string[], appearance: CharacterAppearance, armor: ArmorEquipment): void {
  if (armor.head === "leather-hood") {
    out.push("armor-head-leather-hood");
    return;
  }
  if (appearance.hairStyle !== "bald") out.push(`hair-${appearance.hairStyle}`);
}

function resolveLayerStack(appearance: CharacterAppearance, armor: ArmorEquipment): string[] {
  const gTag = appearance.body === BODY_FEMALE ? BODY_FEMALE : "male";
  const out = [`body-${gTag}`];
  if (armor.feet === "leather-boots") out.push("armor-feet-leather-boots");
  if (armor.legs === "leather-leggings") out.push(`armor-legs-leather-leggings-${gTag}`);
  if (armor.chest === "leather-tunic") out.push(`armor-chest-leather-tunic-${gTag}`);
  pushHeadLayer(out, appearance, armor);
  return out;
}

function sliceDirAnim(opts: { source: TextureSource; meta: PlayerRigMeta; dirIdx: number }): DirectionAnim {
  const { source, meta, dirIdx } = opts;
  const fw = meta.frameWidth; const fh = meta.frameHeight;
  const grab = (state: string): Texture[] => {
    const clip = meta.clips[state];
    if (!clip) return [];
    const row = clip.startRow + dirIdx;
    return Array.from({ length: clip.frames }, (_, c) => new Texture({ source, frame: new Rectangle(c * fw, row * fh, fw, fh) }));
  };
  return { idle: grab("idle"), walk: grab("walk"), run: grab("run"), jump: grab("jump"), fall: grab("fall"), dodge: grab("dodge"), downed: grab("downed") };
}

function extractPortraitUrl(srcCanvas: HTMLCanvasElement, meta: PlayerRigMeta): string {
  const cw = 64; const ch = 82;
  const { canvas, ctx } = createPixelCanvas(cw, ch);
  const sx = meta.portraitCol * meta.frameWidth + Math.floor((meta.frameWidth - cw) * 0.5);
  const sy = meta.portraitRow * meta.frameHeight + meta.groundY - ch + 8;
  ctx.drawImage(srcCanvas, sx, sy, cw, ch, 0, 0, cw, ch);
  return canvas.toDataURL();
}

function capsuleDist(pts: { readonly px: number; readonly py: number; readonly x0: number; readonly x1: number }): number {
  const cx = Math.max(pts.x0, Math.min(pts.x1, pts.px));
  return Math.hypot(pts.px - cx, pts.py - 7);
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
  return rasterizeTexture(opts.w ?? 20, 14, (px, py) => {
    if (capsuleDist({ px, py, x0: 5, x1: opts.x1 }) > opts.radius) return null;
    const pal = opts.capSkin && px >= capX ? opts.capSkin : opts.triad;
    return pickCapsuleColor({ p: pal, dy: py - 7, radius: opts.radius, shaded: opts.shaded });
  });
}

function renderCapsuleOutline(opts: {
  readonly w?: number | undefined; readonly x0: number; readonly x1: number; readonly radius: number;
  readonly shadeRgb: RgbTriad; readonly capShadeRgb?: RgbTriad | undefined; readonly capX?: number | undefined;
}): Texture {
  const capX = opts.capX ?? 11.5;
  return rasterizeTexture(opts.w ?? 20, 14, (px, py) => {
    if (capsuleDist({ px, py, x0: opts.x0, x1: opts.x1 }) > opts.radius + 2.0) return null;
    const base = opts.capShadeRgb && px >= capX ? opts.capShadeRgb : opts.shadeRgb;
    return computeSelOutRgb(base[0], base[1], base[2]);
  });
}

function renderHandCircle(opts: { readonly skin: TriadRgbSet; readonly shaded: boolean; readonly mode: "full" | "fill" | "outline" }): Texture {
  const { skin, shaded, mode } = opts;
  const outlineRgb = computeSelOutRgb(skin.shade[0], skin.shade[1], skin.shade[2]);
  return rasterizeTexture(11, 11, (px, py) => {
    const dist = Math.hypot(px - 5.5, py - 5.5);
    if (dist > (mode === "fill" ? 2.9 : 4.9)) return null;
    if (mode === "outline") return outlineRgb;
    return dist <= 2.9 ? pickCapsuleColor({ p: skin, dy: py - 5.5, radius: 2.9, shaded }) : outlineRgb;
  });
}

function buildArmSegmentTextures(appearance: CharacterAppearance, armor: ArmorEquipment): ArmSegmentTextures {
  const r = appearance.body === BODY_FEMALE ? 2.6 : 3.5;
  const skin = toTriadRgb(SKIN_PALETTES[appearance.skin] ?? SKIN_PALETTES.warm!);
  const tunic = getArmorVisualStyle(armor.chest);
  const bracer = armor.chest ? getArmorVisualStyle("leather-boots") : undefined;
  const upperPal = tunic ? toTriadRgb(tunic) : skin;
  const forePal = bracer ? toTriadRgb(bracer) : skin;
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

export function build3dCharacterSpriteSet(appearance: CharacterAppearance, armor: ArmorEquipment): CharacterSpriteSet | null {
  const meta = getPlayerRigMeta();
  if (!meta) return null;
  const w = meta.cols * meta.frameWidth; const h = meta.rows * meta.frameHeight;
  const { canvas, ctx } = createPixelCanvas(w, h);
  for (const id of resolveLayerStack(appearance, armor)) {
    const img = getPlayerLayerImage(id);
    if (img) ctx.drawImage(img, 0, 0);
  }
  const imgData = ctx.getImageData(0, 0, w, h);
  applyRecolorPass(imgData.data, resolveSentinelPalettes(appearance));
  applyUnifiedSelOut(imgData.data, w, h);
  ctx.putImageData(imgData, 0, 0);
  const source = Texture.from({ resource: canvas, scaleMode: "nearest" }).source;
  const byDir = (d: FacingDir) => sliceDirAnim({ source, meta, dirIdx: Math.max(0, meta.directions.indexOf(d)) });
  const armSegments = buildArmSegmentTextures(appearance, armor);
  return {
    south: byDir("south"), se: byDir("se"), side: byDir("side"), ne: byDir("ne"), north: byDir("north"),
    frontArm: armSegments.upperFront, backArm: armSegments.upperBack, armSegments,
    worldScale: meta.scale, anchorY: meta.anchorY, is3d: true, previewUrl: extractPortraitUrl(canvas, meta),
  };
}
