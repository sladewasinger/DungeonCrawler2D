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

export function resolveWeaponSmearSpec(archetype: WeaponArchetype, comboStep: number): {
  readonly smear: SmearSpec;
  readonly motion: AttackMotionKind;
  readonly ttl: number;
} {
  const stepSpec = getWeaponStepSpec(archetype, comboStep);
  const base = MELEE_SWING_TUNING.smears[comboStep] ?? MELEE_SWING_TUNING.smears[1]!;
  const pal = archetype === "sword" && comboStep === 3 ? { fill: base.fill, edge: base.edge } : MELEE_SWING_TUNING.palettes[archetype];
  const geom = MOTION_GEOMETRY[stepSpec.motion];
  return {
    motion: stepSpec.motion,
    ttl: Math.max(base.ttl, stepSpec.swingDurationSec * 1.12),
    smear: { ...base, radius: geom?.radius ?? base.radius, span: geom?.span ?? base.span, dir: stepSpec.sweepDir, fill: pal.fill, edge: pal.edge },
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

function drawOverheadSlam(opts: WeaponSmearDrawOpts & { readonly spec: SmearSpec }): void {
  const { g, u, baseAngle, spec } = opts;
  g.clear();
  const cx = Math.cos(baseAngle);
  const cy = Math.sin(baseAngle);
  const slamT = Math.min(1, Math.max(0, (u - 0.24) / 0.42));
  if (u < 0.74 && slamT > 0.02) {
    const startY = -18 + slamT * 10;
    const endY = startY + 13;
    g.moveTo(cx * 12, startY).lineTo(cx * 15, endY + cy * 8)
      .stroke({ color: spec.edge, width: 3.0, alpha: (1 - u) * 0.9 });
  }
  if (u < 0.5) return;
  const ringT = (u - 0.5) / 0.5;
  const fade = 1 - ringT;
  const ix = cx * 15;
  const iy = cy * 11 + 2;
  g.ellipse(ix, iy, 4 + ringT * 11, 2.2 + ringT * 5.5).stroke({ color: spec.edge, width: 1.8, alpha: 0.9 * fade });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    g.moveTo(ix + Math.cos(a) * 3, iy + Math.sin(a) * 1.5).lineTo(ix + Math.cos(a) * (4 + ringT * 9), iy + Math.sin(a) * (2 + ringT * 4.5));
  }
  g.stroke({ color: spec.fill, width: 1.4, alpha: 0.8 * fade });
}

export function drawWeaponSmear(opts: WeaponSmearDrawOpts): void {
  if (!opts.spec) { opts.g.alpha = 1 - opts.u * opts.u; return; }
  const withSpec = { ...opts, spec: opts.spec };
  if (opts.motion === "overheadSlam") { drawOverheadSlam(withSpec); return; }
  if (opts.motion === "lunge" || opts.motion === "thrust") { drawThrustLance(withSpec); return; }
  drawCrescentSmear(withSpec);
}
