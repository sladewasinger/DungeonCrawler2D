/** 2-tier tight-packed, per-clip trimmed 3D Hero compositor with Sentinel recoloring & Borderlands outlines. */
import { ACTIVE_OUTLINE_STYLE } from "@dc2d/content";
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import { Rectangle, Texture, type TextureSource } from "pixi.js";
import { createPixelCanvas } from "../textures/pixelCanvas.js";
import { drawRecoloredSlots, type StyledLayerEntry } from "./atlas/armorLayerRecolor.js";
import {
  CORE_CLIP_NAMES, SECONDARY_CLIP_NAMES, buildTierAtlasPlan,
  type PackedTierAtlas,
} from "./atlas/playerAtlasPacker.js";
import { resolveStyledLayerStack } from "./atlas/playerPortraitBake.js";
import type { CharacterSpriteSet, DirectionAnim, FacingDir } from "./characterTypes.js";
import { ensurePlayerLayersLoaded, getPlayerLayerImage, getPlayerRigMeta, type PlayerRigMeta } from "./playerAssets.js";
import { applyRecolorPass, applyUnifiedSelOut, resolveSentinelPalettes } from "./playerRecolor.js";

export { remapSentinelPixel, remapSentinelPixelAt, resolveSentinelPalettes, type SentinelPalettes } from "./playerRecolor.js";
export {
  CORE_CLIP_NAMES, MAX_PLAYER_ATLAS_DIM, SECONDARY_CLIP_NAMES,
  buildTierAtlasPlan, resolveClipTrim,
  type AtlasFrameSlot,
} from "./atlas/playerAtlasPacker.js";
export { build3dCharacterPortraitUrl, computePortraitCropRect, resolveLayerStack } from "./atlas/playerPortraitBake.js";

interface MutableDirAnim {
  idle: Texture[];
  walk?: Texture[];
  run: Texture[];
  jump: Texture[];
  fall: Texture[];
  dodge?: Texture[];
  downed?: Texture[];
  swim?: Texture[];
  bow?: Texture[];
  crouchIdle?: Texture[];
  crouchWalk?: Texture[];
  attack?: Texture[];
}

const CLIP_TO_PROP: Readonly<Record<string, keyof MutableDirAnim>> = {
  idle: "idle",
  walk: "walk",
  run: "run",
  jump: "jump",
  fall: "fall",
  dodge: "dodge",
  downed: "downed",
  swim: "swim",
  bow: "bow",
  crouch_idle: "crouchIdle",
  crouch_walk: "crouchWalk",
  attack: "attack",
};

function createEmptyDirAnim(): MutableDirAnim {
  return { idle: [], run: [], jump: [], fall: [] };
}

function createDirAnimMap(): Record<FacingDir, MutableDirAnim> {
  return {
    south: createEmptyDirAnim(),
    se: createEmptyDirAnim(),
    side: createEmptyDirAnim(),
    ne: createEmptyDirAnim(),
    north: createEmptyDirAnim(),
  };
}

function sliceTierIntoDirs(opts: {
  readonly source: TextureSource;
  readonly plan: PackedTierAtlas;
  readonly dirAnims: Readonly<Record<FacingDir, MutableDirAnim>>;
  readonly directions: readonly FacingDir[];
}): void {
  const { source, plan, dirAnims, directions } = opts;
  const orig = new Rectangle(0, 0, plan.frameWidth, plan.frameHeight);
  for (const slot of plan.slots) {
    const dirName = directions[slot.dirIdx];
    const prop = dirName ? CLIP_TO_PROP[slot.clip] : undefined;
    if (!dirName || !prop) continue;
    const list = (dirAnims[dirName][prop] ??= []);
    list[slot.col] = new Texture({
      source,
      frame: new Rectangle(slot.dstX, slot.dstY, slot.w, slot.h),
      orig,
      trim: new Rectangle(slot.trimX, slot.trimY, slot.w, slot.h),
    });
  }
}

function compositeTierCanvas(opts: {
  readonly layers: readonly StyledLayerEntry[]; readonly plan: PackedTierAtlas;
  readonly scale: number; readonly appearance: CharacterAppearance;
}): { readonly canvas: HTMLCanvasElement; readonly source: TextureSource } {
  const { layers, plan, scale, appearance } = opts;
  const { canvas, ctx } = createPixelCanvas(plan.width, plan.height);
  for (const layer of layers) {
    const img = getPlayerLayerImage(layer.id);
    if (img) drawRecoloredSlots({ ctx, source: img, slots: plan.slots, recolorPrimary: layer.recolorPrimary, recolorTrim: layer.recolorTrim });
  }
  const imgData = ctx.getImageData(0, 0, plan.width, plan.height);
  applyRecolorPass({
    data: imgData.data, width: plan.width, height: plan.height,
    palettes: resolveSentinelPalettes(appearance),
    cells: plan.slots.map((s) => ({ x: s.dstX, y: s.dstY, w: s.w, h: s.h })),
  });
  const solidRadiusPx = ACTIVE_OUTLINE_STYLE.actorSolidPx * Math.min(1.65, (1 / 3) / scale);
  applyUnifiedSelOut({ data: imgData.data, width: plan.width, height: plan.height, solidRadiusPx });
  ctx.putImageData(imgData, 0, 0);
  return { canvas, source: Texture.from({ resource: canvas, scaleMode: "nearest" }).source };
}

function createSecondaryLoader(opts: {
  readonly layers: readonly StyledLayerEntry[]; readonly meta: PlayerRigMeta;
  readonly appearance: CharacterAppearance; readonly secondaryPlan: PackedTierAtlas;
  readonly dirAnims: Readonly<Record<FacingDir, MutableDirAnim>>;
}): () => void {
  let built = false;
  return (): void => {
    if (built || opts.secondaryPlan.slots.length === 0) return;
    built = true;
    const secondary = compositeTierCanvas({
      layers: opts.layers, plan: opts.secondaryPlan, scale: opts.meta.scale, appearance: opts.appearance,
    });
    sliceTierIntoDirs({ source: secondary.source, plan: opts.secondaryPlan, dirAnims: opts.dirAnims, directions: opts.meta.directions });
  };
}

export function build3dCharacterSpriteSet(
  appearance: CharacterAppearance,
  armor: ArmorEquipment,
  onLazyReady?: () => void,
): CharacterSpriteSet | null {
  const meta = getPlayerRigMeta();
  if (!meta) return null;
  const styledLayers = resolveStyledLayerStack(appearance, armor, true);
  if (onLazyReady) ensurePlayerLayersLoaded(styledLayers.map((l) => l.id), onLazyReady);
  const corePlan = buildTierAtlasPlan(meta, CORE_CLIP_NAMES);
  if (corePlan.slots.length === 0) return null;
  const secondaryPlan = buildTierAtlasPlan(meta, SECONDARY_CLIP_NAMES);
  const dirAnims = createDirAnimMap();
  const core = compositeTierCanvas({ layers: styledLayers, plan: corePlan, scale: meta.scale, appearance });
  sliceTierIntoDirs({ source: core.source, plan: corePlan, dirAnims, directions: meta.directions });
  const ensureSecondary = createSecondaryLoader({ layers: styledLayers, meta, appearance, secondaryPlan, dirAnims });
  const dirs = dirAnims as unknown as Readonly<Record<FacingDir, DirectionAnim>>;
  return {
    ...dirs,
    frontArm: Texture.EMPTY, backArm: Texture.EMPTY,
    worldScale: meta.scale, anchorY: meta.anchorY, is3d: true,
    hasSecondaryTracks: secondaryPlan.slots.length > 0, ensureSecondary,
  };
}
