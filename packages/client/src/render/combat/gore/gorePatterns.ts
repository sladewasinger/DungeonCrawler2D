/** Pure substance-specific gore particle and death-feature spawn planners. */
import type { GoreStyle, GoreSubstance } from "@dc2d/engine";

export type PlannedParticleKind = "arc" | "splat" | "streak" | "goop" | "chunk" | "spark";
export type StaticFeatureKind = "bloodPool" | "goopPuddle" | "bonePile" | "rubblePile";

export interface PlannedParticle {
  readonly kind: PlannedParticleKind;
  readonly ang: number;
  readonly rot?: number | undefined;
  readonly spd: number;
  readonly vz: number;
  readonly z0: number;
  readonly scale: number;
  readonly flipY?: boolean | undefined;
  readonly bounces: number;
  readonly bounceRestitution: number;
  readonly ephemeral: boolean;
  readonly ephemeralFadeSec: number;
  readonly flutter: boolean;
  readonly gravityMult: number;
  readonly ttlSec: number;
  readonly alpha: number;
  readonly spin: number;
  readonly colors?: readonly number[] | undefined;
}

export interface PlannedStaticDecal {
  readonly kind: StaticFeatureKind;
  readonly scaleMult: number;
}

export interface GoreSpawnPlan {
  readonly particles: readonly PlannedParticle[];
  readonly staticDecal?: PlannedStaticDecal | undefined;
}

export interface GorePlanRequest {
  readonly dirX: number;
  readonly dirY: number;
  readonly style: GoreStyle;
  readonly substance: GoreSubstance;
  readonly fatal?: boolean | undefined;
  readonly comboStep?: number | undefined;
  readonly sweepDir?: number | undefined;
  readonly passiveDrip?: boolean | undefined;
}

const SPARK_COLORS: readonly number[] = [0xfffbeb, 0xfde047, 0xf59e0b, 0xf97316];
const STYLE_CHUNK: GoreStyle = "chunk-spray";
const STYLE_SLICE: GoreStyle = "thin-streak";
const STYLE_DRIP: GoreStyle = "drip";

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function scaled(count: number, scale: number, min = 1): number {
  return Math.max(min, Math.round(count * scale));
}

function makeDrop(over: Partial<PlannedParticle> & { readonly kind: PlannedParticleKind; readonly ang: number }): PlannedParticle {
  return {
    spd: 42, vz: 20, z0: 7, scale: 0.52, bounces: 0, bounceRestitution: 0.32,
    ephemeral: false, ephemeralFadeSec: 0, flutter: false, gravityMult: 1,
    ttlSec: 150, alpha: 0.86, spin: 0, ...over,
  };
}

function pushSplats(out: PlannedParticle[], opts: { readonly base: number; readonly count: number; readonly spread: number; readonly spd: number; readonly loS: number; readonly hiS: number }): void {
  for (let i = 0; i < opts.count; i++) {
    out.push(makeDrop({
      kind: "splat", ang: opts.base + (Math.random() - 0.5) * opts.spread,
      spd: opts.spd * randRange(0.42, 1.25), vz: randRange(10, 32), z0: randRange(5, 11),
      scale: randRange(opts.loS, opts.hiS),
    }));
  }
}

function pushChunks(out: PlannedParticle[], opts: { readonly base: number; readonly count: number; readonly spread: number; readonly spd: number; readonly ephemeral?: boolean; readonly ttl?: number; readonly scale?: readonly [number, number] }): void {
  const [lo, hi] = opts.scale ?? [0.46, 0.72];
  for (let i = 0; i < opts.count; i++) {
    out.push(makeDrop({
      kind: "chunk", ang: opts.base + (Math.random() - 0.5) * opts.spread,
      spd: opts.spd * randRange(0.65, 1.25), vz: randRange(34, 58), z0: randRange(6, 11),
      scale: randRange(lo, hi), bounces: 1, bounceRestitution: 0.35, spin: (Math.random() - 0.5) * 14,
      ephemeral: Boolean(opts.ephemeral), ephemeralFadeSec: opts.ephemeral ? 0.35 : 0, ttlSec: opts.ttl ?? 140,
    }));
  }
}

function pushSparks(out: PlannedParticle[], base: number, count: number): void {
  const back = base + Math.PI;
  for (let i = 0; i < count; i++) {
    out.push(makeDrop({
      kind: "spark", ang: back + (Math.random() - 0.5) * 2.5,
      spd: randRange(85, 145), vz: randRange(22, 54), z0: randRange(7, 12),
      scale: randRange(0.58, 0.92), gravityMult: 0.65, ephemeral: true, ephemeralFadeSec: 0.24,
      alpha: 0.96, colors: SPARK_COLORS,
    }));
  }
}

function pushSwordArc(out: PlannedParticle[], opts: { readonly base: number; readonly sweepDir: number; readonly heavy: boolean }): void {
  const sweep = opts.sweepDir || 1;
  const flipY = opts.sweepDir < 0;
  const scale = opts.heavy ? randRange(0.72, 0.90) : randRange(0.54, 0.74);
  out.push(makeDrop({
    kind: "arc",
    ang: opts.base + sweep * randRange(0.22, 0.52) + randRange(-0.14, 0.14),
    rot: opts.base + sweep * randRange(0.98, 1.28),
    spd: randRange(22, 54), vz: randRange(8, 22), z0: randRange(6, 10), scale, flipY, alpha: 0.88,
  }));
}

function planBladeSlice(opts: { readonly out: PlannedParticle[]; readonly base: number; readonly scale: number; readonly sweepDir: number; readonly heavy: boolean; readonly fatal: boolean }): void {
  pushSwordArc(opts.out, { base: opts.base, sweepDir: opts.sweepDir, heavy: opts.heavy });
  if (opts.heavy || Math.random() < 0.55) {
    opts.out.push(makeDrop({
      kind: "streak", ang: opts.base + opts.sweepDir * randRange(0.35, 0.7),
      spd: randRange(44, 72), vz: randRange(10, 18), scale: randRange(0.42, 0.58),
    }));
  }
  pushSplats(opts.out, { base: opts.base, count: scaled(opts.heavy ? 4 : 3, opts.scale), spread: 1.6, spd: opts.heavy ? 64 : 52, loS: 0.24, hiS: 0.40 });
  if (opts.heavy) pushChunks(opts.out, { base: opts.base, count: scaled(opts.fatal ? 3 : 2, opts.scale), spread: 1.7, spd: 70 });
}

function planArrowExit(out: PlannedParticle[], base: number, scale: number): void {
  out.push(makeDrop({ kind: "streak", ang: base, spd: randRange(48, 68), vz: 10, scale: randRange(0.44, 0.60) }));
  pushSplats(out, { base, count: scaled(3, scale), spread: 0.65, spd: 46, loS: 0.24, hiS: 0.40 });
}

function planLiquidCombat(req: GorePlanRequest, base: number, scale: number): GoreSpawnPlan {
  const out: PlannedParticle[] = [];
  const fatal = Boolean(req.fatal);
  const heavy = fatal || req.style === STYLE_CHUNK;
  if (heavy || req.style === STYLE_SLICE) {
    planBladeSlice({ out, base, scale, sweepDir: req.sweepDir ?? 0, heavy, fatal });
  } else if (req.style === STYLE_DRIP) {
    planArrowExit(out, base, scale);
  } else {
    pushSplats(out, { base, count: scaled(5, scale), spread: 1.6, spd: 52, loS: 0.30, hiS: 0.54 });
  }
  return fatal ? { particles: out, staticDecal: { kind: "bloodPool", scaleMult: 1.05 } } : { particles: out };
}

function makeGoopDrop(base: number, spread: number, fatal: boolean): PlannedParticle {
  return makeDrop({
    kind: "goop", ang: base + (Math.random() - 0.5) * spread,
    spd: randRange(fatal ? 42 : 26, fatal ? 82 : 56), vz: randRange(24, 52), z0: randRange(6, 11),
    scale: randRange(0.52, fatal ? 0.88 : 0.74), bounces: 1, bounceRestitution: 0.2, gravityMult: 1.25,
  });
}

function planSlimeCombat(req: GorePlanRequest, base: number, scale: number): GoreSpawnPlan {
  const out: PlannedParticle[] = [];
  const fatal = Boolean(req.fatal) || req.style === "explode-away";
  const spread = fatal ? Math.PI * 2 : 1.7;
  const count = scaled(fatal ? 8 : 4, scale);
  for (let i = 0; i < count; i++) out.push(makeGoopDrop(base, spread, fatal));
  pushSplats(out, { base, count: scaled(fatal ? 4 : 2, scale), spread, spd: 46, loS: 0.3, hiS: 0.48 });
  return fatal ? { particles: out, staticDecal: { kind: "goopPuddle", scaleMult: 1.2 } } : { particles: out };
}

function planBoneCombat(req: GorePlanRequest, base: number, scale: number): GoreSpawnPlan {
  const out: PlannedParticle[] = [];
  const fatal = Boolean(req.fatal);
  pushChunks(out, { base, count: scaled(fatal ? 7 : 4, scale), spread: fatal ? Math.PI * 1.9 : 1.6, spd: fatal ? 76 : 56, ttl: 55, scale: [0.46, 0.74] });
  return fatal ? { particles: out, staticDecal: { kind: "bonePile", scaleMult: 1.0 } } : { particles: out };
}

function planStoneCombat(req: GorePlanRequest, base: number, scale: number): GoreSpawnPlan {
  const out: PlannedParticle[] = [];
  const fatal = Boolean(req.fatal);
  const hitSparks = req.style === STYLE_DRIP ? 3 : 6;
  pushSparks(out, base, scaled(fatal ? 9 : hitSparks, scale));
  if (!fatal) {
    pushChunks(out, { base, count: scaled(4, scale), spread: 1.8, spd: 64, ephemeral: true, scale: [0.4, 0.62] });
    return { particles: out };
  }
  pushChunks(out, { base, count: scaled(4, scale), spread: Math.PI * 1.8, spd: 72, ttl: 65, scale: [0.48, 0.74] });
  pushChunks(out, { base, count: scaled(4, scale), spread: Math.PI * 2, spd: 86, ephemeral: true, scale: [0.4, 0.58] });
  return { particles: out, staticDecal: { kind: "rubblePile", scaleMult: 1.0 } };
}

function planStrawCombat(req: GorePlanRequest, base: number, scale: number): GoreSpawnPlan {
  const out: PlannedParticle[] = [];
  const count = scaled(req.fatal ? 11 : 5, scale);
  const spread = req.fatal ? Math.PI * 2 : 1.9;
  for (let i = 0; i < count; i++) {
    out.push(makeDrop({
      kind: "chunk", ang: base + (Math.random() - 0.5) * spread,
      spd: randRange(24, 52), vz: randRange(18, 36), z0: randRange(7, 13),
      scale: randRange(0.48, 0.72), flutter: true, gravityMult: 0.28, spin: (Math.random() - 0.5) * 9, ttlSec: 22,
    }));
  }
  return { particles: out };
}

const SUBSTANCE_PLANNERS: Partial<Record<GoreSubstance, (req: GorePlanRequest, base: number, scale: number) => GoreSpawnPlan>> = {
  slime: planSlimeCombat,
  bone: planBoneCombat,
  stone: planStoneCombat,
  straw: planStrawCombat,
};

const SOLID_SUBSTANCES = new Set<GoreSubstance>(["bone", "stone", "straw"]);

function planPassiveDrip(req: GorePlanRequest, base: number): GoreSpawnPlan {
  if (SOLID_SUBSTANCES.has(req.substance)) return { particles: [] };
  const kind: PlannedParticleKind = req.substance === "slime" ? "goop" : "splat";
  return {
    particles: [makeDrop({ kind, ang: base + (Math.random() - 0.5) * 1.4, spd: randRange(6, 12), vz: 4, z0: 5, scale: randRange(0.32, 0.46), ttlSec: 75 })],
  };
}

export function planGoreSpawn(req: GorePlanRequest, levelScale: number): GoreSpawnPlan {
  if (levelScale <= 0) return { particles: [] };
  const base = Math.atan2(req.dirY || 0.01, req.dirX || 1);
  if (req.passiveDrip) return planPassiveDrip(req, base);
  return (SUBSTANCE_PLANNERS[req.substance] ?? planLiquidCombat)(req, base, levelScale);
}
