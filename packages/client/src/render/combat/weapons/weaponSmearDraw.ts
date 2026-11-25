/** Progressive per-weapon swing trail, thrust lance, flame jet, and pickaxe slam impact VFX. */
import { getWeaponStepSpec, type AttackMotionKind, type WeaponArchetype } from "@dc2d/engine";
import type { Graphics } from "pixi.js";
import { MELEE_SWING_TUNING, type SmearSpec } from "../combatVisualTuning.js";

export interface WeaponSmearDrawOpts {
  readonly g: Graphics;
  readonly u: number;
  readonly baseAngle: number;
  readonly spec: SmearSpec | null;
  readonly motion: AttackMotionKind;
  readonly archetype: WeaponArchetype;
}

const MOTION_GEOMETRY: Partial<Record<AttackMotionKind, { readonly radius: number; readonly span: number }>> = {
  chop: { radius: 24, span: 2.45 },
  cleave: { radius: 26, span: 2.8 },
};

function buildSmearSpec(opts: {
  readonly base: SmearSpec; readonly fill: number; readonly edge: number;
  readonly radius: number; readonly span: number; readonly dir: 1 | -1; readonly heavy: boolean;
}): SmearSpec {
  const boost = opts.heavy ? 0.12 : 0;
  return {
    ...opts.base, radius: opts.radius + (opts.heavy ? 3 : 0), span: opts.span, dir: opts.dir,
    fill: opts.fill, edge: opts.heavy ? 0xfef08a : opts.edge,
    fillAlpha: Math.min(1, opts.base.fillAlpha + boost), edgeAlpha: Math.min(1, opts.base.edgeAlpha + boost),
  };
}

export function resolveWeaponSmearSpec(archetype: WeaponArchetype, comboStep: number, heavy?: boolean): {
  readonly smear: SmearSpec;
  readonly motion: AttackMotionKind;
  readonly ttl: number;
} {
  const stepSpec = getWeaponStepSpec(archetype, comboStep);
  const base = MELEE_SWING_TUNING.smears[comboStep] ?? MELEE_SWING_TUNING.smears[1]!;
  const isSwordFinisher = archetype === "sword" && comboStep === 3;
  const pal = isSwordFinisher ? base : MELEE_SWING_TUNING.palettes[archetype];
  const geom = MOTION_GEOMETRY[stepSpec.motion];
  return {
    motion: stepSpec.motion,
    ttl: Math.max(base.ttl, stepSpec.swingDurationSec * 1.12),
    smear: buildSmearSpec({
      base, fill: pal.fill, edge: pal.edge,
      radius: geom?.radius ?? base.radius, span: geom?.span ?? base.span, dir: stepSpec.sweepDir, heavy: Boolean(heavy),
    }),
  };
}

function smearAngle(baseAngle: number, s: SmearSpec, t: number): number {
  return baseAngle + s.dir * (-s.span * 0.5 + t * s.span);
}

function drawCrescentSmear(opts: WeaponSmearDrawOpts & { readonly spec: SmearSpec }): void {
  const { g, u, baseAngle, spec } = opts;
  const tailT = Math.pow(Math.max(0, (u - 0.14) / 0.86), 1.45);
  const headT = 1 - Math.pow(1 - Math.min(1, u / 0.72), 3);
  g.clear();
  if (headT - tailT <= 0.03) return;
  const pts: number[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const a = smearAngle(baseAngle, spec, tailT + (i / steps) * (headT - tailT));
    pts.push(Math.cos(a) * spec.radius, Math.sin(a) * spec.radius);
  }
  for (let i = steps; i >= 0; i--) {
    const frac = i / steps;
    const a = smearAngle(baseAngle, spec, tailT + frac * (headT - tailT));
    const r = spec.radius - (spec.radius - spec.inner) * Math.pow(frac, 0.75);
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  const fade = Math.max(0, 1 - Math.max(0, (u - 0.45) / 0.55));
  g.poly(pts, true).fill({ color: spec.fill, alpha: spec.fillAlpha * fade });
  const a0 = smearAngle(baseAngle, spec, Math.max(tailT, headT - 0.38));
  const a1 = smearAngle(baseAngle, spec, headT);
  const lo = spec.dir > 0 ? a0 : a1;
  const hi = spec.dir > 0 ? a1 : a0;
  g.moveTo(Math.cos(lo) * spec.radius, Math.sin(lo) * spec.radius)
    .arc(0, 0, spec.radius, lo, hi)
    .stroke({ color: spec.edge, width: 2.2, alpha: spec.edgeAlpha * fade });
}

function drawThrustLance(opts: WeaponSmearDrawOpts & { readonly spec: SmearSpec }): void {
  const { g, u, baseAngle, spec, motion, archetype } = opts;
  g.clear();
  const ext = Math.sin(Math.min(1, u / 0.75) * Math.PI);
  if (ext <= 0.04) return;
  const cx = Math.cos(baseAngle);
  const cy = Math.sin(baseAngle);
  const px = -cy;
  const py = cx;
  const tipLen = (motion === "lunge" || archetype === "spear" ? 30 : 22) * ext;
  const baseLen = 5;
  const halfW = archetype === "torch" ? 5.2 : 3.8;
  const fade = Math.max(0, 1 - Math.max(0, (u - 0.42) / 0.58));
  g.poly([
    cx * baseLen + px * halfW, cy * baseLen + py * halfW,
    cx * (baseLen + tipLen), cy * (baseLen + tipLen),
    cx * baseLen - px * halfW, cy * baseLen - py * halfW,
    cx * (baseLen + tipLen * 0.25), cy * (baseLen + tipLen * 0.25),
  ], true).fill({ color: spec.fill, alpha: spec.fillAlpha * fade });
  g.moveTo(cx * baseLen, cy * baseLen).lineTo(cx * (baseLen + tipLen), cy * (baseLen + tipLen))
    .stroke({ color: spec.edge, width: 2.0, alpha: spec.edgeAlpha * fade });
  if (archetype === "torch") {
    g.circle(cx * (baseLen + tipLen * 0.75), cy * (baseLen + tipLen * 0.75), 2.4 * ext).fill({ color: spec.edge, alpha: 0.85 * fade });
  }
}

export interface ImpactClashOpts {
  readonly g: Graphics;
  readonly u: number;
  readonly baseAngle: number;
  readonly color: number;
  readonly radius: number;
}

const CHIP_TRAJECTORIES: readonly (readonly [number, number, number])[] = [
  [-0.95, -0.85, 1.05],
  [0.85, -0.78, 0.92],
  [-0.38, -1.15, 0.8],
  [0.42, -0.96, 1.15],
];

function drawImpactSparks(opts: {
  readonly g: Graphics; readonly cx: number; readonly cy: number;
  readonly radius: number; readonly u: number; readonly color: number; readonly fade: number;
}): void {
  const { g, cx, cy, radius, u, color, fade } = opts;
  const dist = radius * (0.25 + u * 0.9);
  for (const [dx, dy, mult] of CHIP_TRAJECTORIES) {
    const px = cx + dx * dist * mult;
    const py = cy + dy * dist * 0.55 * mult;
    const sz = 1.1 + (1 - u) * 1.1;
    g.rect(px - sz * 0.5, py - sz * 0.5, sz, sz).fill({ color, alpha: 0.92 * fade });
  }
}

function drawOverheadSlam(opts: WeaponSmearDrawOpts & { readonly spec: SmearSpec }): void {
  const { g, u, baseAngle, spec } = opts;
  g.clear();
  const cx = Math.cos(baseAngle);
  const cy = Math.sin(baseAngle);
  const slamT = Math.min(1, Math.max(0, (u - 0.24) / 0.42));
  if (u < 0.72 && slamT > 0.02) {
    const startY = -18 + slamT * 10;
    g.moveTo(cx * 11, startY).lineTo(cx * 15, startY + 13 + cy * 8)
      .stroke({ color: spec.edge, width: 3.0, alpha: (1 - u) * 0.9 });
  }
  if (u < 0.48) return;
  const ringT = (u - 0.48) / 0.52;
  const fade = 1 - ringT;
  const ix = cx * 15;
  const iy = cy * 11 + 2;
  const flash = Math.max(0, 1 - ringT * 2.2);
  if (flash > 0.05) {
    g.poly([ix, iy - 4, ix + 5, iy, ix, iy + 3, ix - 5, iy], true).fill({ color: 0xffffff, alpha: flash * 0.9 });
  }
  const rx = 5 + ringT * 10;
  const ry = 2.6 + ringT * 4.5;
  g.moveTo(ix - rx, iy).bezierCurveTo(ix - rx * 0.45, iy + ry, ix + rx * 0.45, iy + ry, ix + rx, iy)
    .stroke({ color: spec.edge, width: 2.0, alpha: 0.88 * fade });
  g.moveTo(ix - 4, iy - 1).lineTo(ix, iy + 2.5).lineTo(ix + 4.5, iy - 1.5)
    .stroke({ color: spec.fill, width: 1.5, alpha: 0.85 * fade });
  drawImpactSparks({ g, cx: ix, cy: iy, radius: 11, u: ringT, color: spec.edge, fade });
}

const CLASH_SPARKS: readonly (readonly [number, number])[] = [
  [-0.58, 1.05],
  [0.14, 1.2],
  [0.64, 0.9],
];

export function drawImpactClash(opts: ImpactClashOpts): void {
  const { g, u, baseAngle, color, radius } = opts;
  g.clear();
  const fade = Math.max(0, 1 - u * u);
  const starR = radius * (0.48 + 0.25 * (1 - u));
  const cos = Math.cos(baseAngle);
  const sin = Math.sin(baseAngle);
  const cross = starR * 0.55;
  g.moveTo(-cos * starR, -sin * starR).lineTo(cos * starR, sin * starR)
    .moveTo(-sin * cross, cos * cross).lineTo(sin * cross, -cos * cross)
    .stroke({ color: 0xffffff, width: 1.8 * (1 - u * 0.5), alpha: fade * 0.95 });
  const arcR = radius * (0.5 + u * 0.72);
  g.moveTo(Math.cos(baseAngle - 0.82) * arcR, Math.sin(baseAngle - 0.82) * arcR)
    .arc(0, 0, arcR, baseAngle - 0.82, baseAngle + 0.82)
    .stroke({ color, width: 2.0, alpha: fade * 0.9 });
  for (const [angOff, lenScale] of CLASH_SPARKS) {
    const a = baseAngle + angOff;
    const inner = radius * (0.25 + u * 0.55) * lenScale;
    const outer = radius * (0.62 + u * 0.78) * lenScale;
    g.moveTo(Math.cos(a) * inner, Math.sin(a) * inner).lineTo(Math.cos(a) * outer, Math.sin(a) * outer)
      .stroke({ color, width: 1.5, alpha: fade * 0.9 });
  }
}

function drawPunchImpact(opts: WeaponSmearDrawOpts & { readonly spec: SmearSpec }): void {
  const { g, u, baseAngle, spec } = opts;
  g.clear();
  const ext = Math.sin(Math.min(1, u / 0.72) * Math.PI);
  if (ext <= 0.04) return;
  const cx = Math.cos(baseAngle);
  const cy = Math.sin(baseAngle);
  const px = -cy * spec.dir;
  const py = cx * spec.dir;
  const lat = 3.2;
  const reach = 6 + ext * 11;
  const fx = cx * reach + px * lat;
  const fy = cy * reach + py * lat;
  const fade = Math.max(0, 1 - Math.max(0, (u - 0.45) / 0.55));
  g.moveTo(cx * 4 + px * lat, cy * 4 + py * lat).lineTo(fx, fy)
    .stroke({ color: spec.edge, width: 2.0, alpha: 0.88 * fade });
  g.moveTo(cx * 5 + px * (lat + 2.2), cy * 5 + py * (lat + 2.2))
    .lineTo(fx - cx * 2 + px * 2.2, fy - cy * 2 + py * 2.2)
    .stroke({ color: spec.fill, width: 1.3, alpha: 0.7 * fade });
  g.moveTo(fx + Math.cos(baseAngle - 0.65) * 4.5, fy + Math.sin(baseAngle - 0.65) * 4.5)
    .arc(fx, fy, 4.5, baseAngle - 0.65, baseAngle + 0.65)
    .stroke({ color: spec.edge, width: 2.0, alpha: 0.92 * fade });
  if (ext > 0.35) g.circle(fx, fy, 2.2 * ext).fill({ color: spec.edge, alpha: 0.85 * fade });
}

export function drawWeaponSmear(opts: WeaponSmearDrawOpts): void {
  if (!opts.spec) { opts.g.alpha = 1 - opts.u * opts.u; return; }
  const withSpec = { ...opts, spec: opts.spec };
  if (opts.motion === "punch") { drawPunchImpact(withSpec); return; }
  if (opts.motion === "overheadSlam") { drawOverheadSlam(withSpec); return; }
  if (opts.motion === "lunge" || opts.motion === "thrust") { drawThrustLance(withSpec); return; }
  drawCrescentSmear(withSpec);
}
