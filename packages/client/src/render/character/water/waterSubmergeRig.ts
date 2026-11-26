/** Waterline clipping masks, submerged tint rig, and splash rings for actors in deep water. */
import { Graphics, Sprite, type Container } from "pixi.js";

export const SUBMERGED_BODY_ALPHA = 0.22;
export const SUBMERGED_BODY_TINT = 0x4ea8de;

export interface WaterlineMetrics {
  readonly cutY: number;
  readonly halfW: number;
  readonly bowPx: number;
}

export const PLAYER_WATERLINE: WaterlineMetrics = { cutY: -6.5, halfW: 8.5, bowPx: 2.4 };

export interface WaterSubmergeRig {
  readonly waterRing: Graphics;
  readonly waterFrontLip: Graphics;
  readonly waterMask: Graphics;
  readonly submergedMask: Graphics;
  readonly submergedBody: Sprite | null;
}

function makeWaterRing(m: WaterlineMetrics = PLAYER_WATERLINE): Graphics {
  const g = new Graphics();
  const cy = m.cutY + m.bowPx * 0.55;
  g.ellipse(0, cy, m.halfW * 0.9, m.bowPx * 1.1).stroke({ color: 0xbae6fd, width: 1.1, alpha: 0.62 });
  g.ellipse(0, cy, m.halfW * 1.25, m.bowPx * 1.5).stroke({ color: 0x7dd3fc, width: 0.8, alpha: 0.35 });
  g.visible = false;
  return g;
}

function makeWaterFrontLip(m: WaterlineMetrics = PLAYER_WATERLINE): Graphics {
  const g = new Graphics();
  const edgeX = m.halfW * 0.78;
  g.moveTo(-edgeX, m.cutY).quadraticCurveTo(0, m.cutY + m.bowPx * 2, edgeX, m.cutY)
    .stroke({ color: 0xe0f2fe, width: 1.25, alpha: 0.72 });
  g.visible = false;
  return g;
}

function makeWaterMask(m: WaterlineMetrics = PLAYER_WATERLINE): Graphics {
  const g = new Graphics();
  g.moveTo(-48, -96).lineTo(48, -96).lineTo(48, m.cutY).lineTo(m.halfW, m.cutY)
    .quadraticCurveTo(0, m.cutY + m.bowPx * 2, -m.halfW, m.cutY).lineTo(-48, m.cutY).closePath().fill(0xffffff);
  g.visible = false;
  return g;
}

function makeUnderwaterMask(m: WaterlineMetrics = PLAYER_WATERLINE): Graphics {
  const g = new Graphics();
  g.moveTo(-48, m.cutY).lineTo(-m.halfW, m.cutY).quadraticCurveTo(0, m.cutY + m.bowPx * 2, m.halfW, m.cutY)
    .lineTo(48, m.cutY).lineTo(48, 36).lineTo(-48, 36).closePath().fill(0xffffff);
  g.visible = false;
  return g;
}

export function createWaterSubmergeRig(m: WaterlineMetrics = PLAYER_WATERLINE, withSubmergedSprite = true): WaterSubmergeRig {
  const submergedMask = makeUnderwaterMask(m);
  const submergedBody = withSubmergedSprite ? new Sprite() : null;
  if (submergedBody) {
    submergedBody.visible = false;
    submergedBody.tint = SUBMERGED_BODY_TINT;
    submergedBody.mask = submergedMask;
  }
  return {
    waterRing: makeWaterRing(m),
    waterFrontLip: makeWaterFrontLip(m),
    waterMask: makeWaterMask(m),
    submergedMask,
    submergedBody,
  };
}

export function syncWaterSubmergeState(opts: {
  readonly rig: WaterSubmergeRig; readonly target: Container; readonly shadow: Graphics;
  readonly swimming: boolean; readonly showShadow: boolean;
}): void {
  const { rig, target, shadow, swimming, showShadow } = opts;
  rig.waterMask.visible = swimming;
  target.mask = swimming ? rig.waterMask : null;
  rig.submergedMask.visible = swimming;
  rig.waterRing.visible = swimming;
  rig.waterFrontLip.visible = swimming;
  shadow.visible = showShadow;
}

export function syncSubmergedSprite(opts: {
  readonly sub: Sprite | null; readonly src: Sprite; readonly swimming: boolean;
  readonly x: number; readonly y: number; readonly rot: number;
  readonly scaleX: number; readonly scaleY: number; readonly alpha: number;
}): void {
  const { sub, src, swimming } = opts;
  if (!sub) return;
  sub.visible = swimming;
  if (!swimming) return;
  sub.texture = src.texture;
  sub.position.set(opts.x, opts.y);
  sub.rotation = opts.rot;
  sub.scale.set(opts.scaleX, opts.scaleY);
  sub.alpha = opts.alpha * SUBMERGED_BODY_ALPHA;
  sub.tint = SUBMERGED_BODY_TINT;
}
