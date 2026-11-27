/** Tight-packed per-clip trimmed texture-atlas planner split across Core & Secondary hero tiers. */

export const MAX_PLAYER_ATLAS_DIM = 4096;
const TARGET_PLAYER_ATLAS_WIDTH = 1536;
const ATLAS_SLOT_GUTTER = 4;

export const CORE_CLIP_NAMES = ["idle", "walk", "run", "dodge", "attack"] as const;
export const SECONDARY_CLIP_NAMES = [
  "jump", "fall", "downed", "swim", "bow", "crouch_idle", "crouch_walk",
] as const;

export interface FrameTrimRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface AtlasFrameSlot {
  readonly clip: string;
  readonly dirIdx: number;
  readonly col: number;
  readonly srcX: number;
  readonly srcY: number;
  readonly trimX: number;
  readonly trimY: number;
  readonly w: number;
  readonly h: number;
  readonly dstX: number;
  readonly dstY: number;
}

export interface PackedTierAtlas {
  readonly width: number;
  readonly height: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly slots: readonly AtlasFrameSlot[];
}

export interface AtlasClipInput {
  readonly startRow: number;
  readonly frames: number;
  readonly trim?: FrameTrimRect | undefined;
}

export interface AtlasRigMetaInput {
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly directions: readonly string[];
  readonly clips: Readonly<Record<string, AtlasClipInput>>;
}

interface UnplacedSlot {
  readonly clip: string;
  readonly dirIdx: number;
  readonly col: number;
  readonly srcX: number;
  readonly srcY: number;
  readonly trimX: number;
  readonly trimY: number;
  readonly w: number;
  readonly h: number;
}

export function resolveClipTrim(
  clip: { readonly trim?: FrameTrimRect | undefined },
  fw: number,
  fh: number,
): FrameTrimRect {
  const t = clip.trim;
  if (!t || t.w <= 0 || t.h <= 0 || t.x >= fw || t.y >= fh) {
    return { x: 0, y: 0, w: fw, h: fh };
  }
  const x = Math.max(0, Math.min(fw - 1, Math.floor(t.x)));
  const y = Math.max(0, Math.min(fh - 1, Math.floor(t.y)));
  return {
    x,
    y,
    w: Math.max(1, Math.min(fw - x, Math.ceil(t.w))),
    h: Math.max(1, Math.min(fh - y, Math.ceil(t.h))),
  };
}

function pushDirSlots(opts: {
  readonly out: UnplacedSlot[];
  readonly clipName: string;
  readonly clip: AtlasClipInput;
  readonly trim: FrameTrimRect;
  readonly dirIdx: number;
  readonly fw: number;
  readonly fh: number;
}): void {
  const row = opts.clip.startRow + opts.dirIdx;
  const srcY = row * opts.fh + opts.trim.y;
  for (let col = 0; col < opts.clip.frames; col++) {
    opts.out.push({
      clip: opts.clipName,
      dirIdx: opts.dirIdx,
      col,
      srcX: col * opts.fw + opts.trim.x,
      srcY,
      trimX: opts.trim.x,
      trimY: opts.trim.y,
      w: opts.trim.w,
      h: opts.trim.h,
    });
  }
}

function collectTierItems(meta: AtlasRigMetaInput, clipNames: readonly string[]): UnplacedSlot[] {
  const out: UnplacedSlot[] = [];
  for (const clipName of clipNames) {
    const clip = meta.clips[clipName];
    if (!clip || clip.frames <= 0) continue;
    const trim = resolveClipTrim(clip, meta.frameWidth, meta.frameHeight);
    for (let dirIdx = 0; dirIdx < meta.directions.length; dirIdx++) {
      pushDirSlots({ out, clipName, clip, trim, dirIdx, fw: meta.frameWidth, fh: meta.frameHeight });
    }
  }
  return out.sort((a, b) => b.h - a.h || b.w - a.w || a.srcY - b.srcY || a.srcX - b.srcX);
}

function packShelfSlots(
  items: readonly UnplacedSlot[],
  maxW: number,
): { readonly width: number; readonly height: number; readonly slots: readonly AtlasFrameSlot[] } {
  let x = 0;
  let y = 0;
  let rowH = 0;
  let width = 0;
  const slots: AtlasFrameSlot[] = [];
  for (const item of items) {
    if (x > 0 && x + item.w > maxW) {
      y += rowH + ATLAS_SLOT_GUTTER;
      x = 0;
      rowH = 0;
    }
    slots.push({ ...item, dstX: x, dstY: y });
    width = Math.max(width, x + item.w);
    rowH = Math.max(rowH, item.h);
    x += item.w + ATLAS_SLOT_GUTTER;
  }
  return { width, height: items.length > 0 ? y + rowH : 0, slots };
}

export function buildTierAtlasPlan(
  meta: AtlasRigMetaInput,
  clipNames: readonly string[],
  targetWidth = TARGET_PLAYER_ATLAS_WIDTH,
): PackedTierAtlas {
  const items = collectTierItems(meta, clipNames);
  const effectiveMax = Math.max(meta.frameWidth, Math.min(MAX_PLAYER_ATLAS_DIM, targetWidth));
  let packed = packShelfSlots(items, effectiveMax);
  if (packed.height > MAX_PLAYER_ATLAS_DIM && effectiveMax < MAX_PLAYER_ATLAS_DIM) {
    packed = packShelfSlots(items, MAX_PLAYER_ATLAS_DIM);
  }
  return {
    width: packed.width,
    height: packed.height,
    frameWidth: meta.frameWidth,
    frameHeight: meta.frameHeight,
    slots: packed.slots,
  };
}
