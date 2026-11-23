/** Diegetic 3-stage perception & behavior indicators (?, filling suspicion, dizzy stars, roar/howl rings). */
import { JUMP_VISUAL_PX_PER_TILE, type WorldEntitySnapshot } from "@dc2d/engine";
import { Container, Graphics } from "pixi.js";

export type AiIndicatorKind = "spotted" | "windup" | "charge" | "investigate" | "flank" | "feed";

const IND_SPOTTED: AiIndicatorKind = "spotted";
const IND_WINDUP: AiIndicatorKind = "windup";
const IND_CHARGE: AiIndicatorKind = "charge";
const IND_INVESTIGATE: AiIndicatorKind = "investigate";
const IND_FLANK: AiIndicatorKind = "flank";
const IND_FEED: AiIndicatorKind = "feed";
const INK = 0x0f172a;

const STATE_MARKER_MAP: Partial<Record<string, AiIndicatorKind>> = {
  [IND_INVESTIGATE]: IND_INVESTIGATE,
  [IND_FLANK]: IND_FLANK,
  [IND_FEED]: IND_FEED,
};

function resolveIndicatorKind(snap: WorldEntitySnapshot, dead: boolean): AiIndicatorKind | null {
  if (dead) return null;
  const state = snap.aiState ?? "idle";
  if (state === IND_CHARGE) return IND_CHARGE;
  if (snap.telegraphProgress > 0) return IND_WINDUP;
  if (snap.spottedPop || state === "alert") return IND_SPOTTED;
  return STATE_MARKER_MAP[state] ?? null;
}

function drawExclamation(g: Graphics, ox: number, fill: number): void {
  g.rect(ox - 2, -12, 4, 7).fill(INK);
  g.rect(ox - 2, -4, 4, 4).fill(INK);
  g.rect(ox - 1, -11, 2, 5).fill(fill);
  g.rect(ox - 1, -3, 2, 2).fill(fill);
}

function drawWindupDiamond(g: Graphics): void {
  g.poly([0, -13, 5, -7, 0, -1, -5, -7], true).fill(INK);
  g.poly([0, -11.5, 3.6, -7, 0, -2.5, -3.6, -7], true).fill(0xef4444);
  g.poly([0, -9.5, 1.8, -7, 0, -4.5, -1.8, -7], true).fill(0xfef08a);
}

const QUESTION_SEGS: readonly (readonly [number, number, number, number])[] = [
  [-3, -12, 6, 2], [-3, -10, 2, 2], [1, -10, 2, 4], [-1, -7, 3, 2], [-1, -5, 2, 2], [-1, -2, 2, 2],
];

function drawQuestionMark(g: Graphics, suspicion: number): void {
  const fillLineY = -12 * Math.max(0.08, Math.min(1, suspicion));
  const fillCol = suspicion >= 0.82 ? 0xf97316 : 0xfacc15;
  for (const [x, y, w, h] of QUESTION_SEGS) g.rect(x - 1, y - 1, w + 2, h + 2).fill(INK);
  for (const [x, y, w, h] of QUESTION_SEGS) g.rect(x, y, w, h).fill(y + h >= fillLineY ? fillCol : 0x475569);
}

function drawFlankChevrons(g: Graphics): void {
  const bars: readonly (readonly [number, number, number, number])[] = [
    [-5, -7, 2, 2], [-4, -9, 2, 2], [-4, -5, 2, 2], [3, -7, 2, 2], [2, -9, 2, 2], [2, -5, 2, 2],
  ];
  for (const [x, y, w, h] of bars) g.rect(x - 1, y - 1, w + 2, h + 2).fill(INK);
  for (const [x, y, w, h] of bars) g.rect(x, y, w, h).fill(0xf59e0b);
}

function drawFeedDots(g: Graphics): void {
  for (const ox of [-4, 0, 4]) {
    g.rect(ox - 2, -6, 4, 4).fill(INK);
    g.rect(ox - 1, -5, 2, 2).fill(0xfbbf24);
  }
}

const STATIC_DRAWERS: Partial<Record<AiIndicatorKind, (g: Graphics) => void>> = {
  spotted: (g) => drawExclamation(g, 0, 0xf97316),
  windup: drawWindupDiamond,
  charge: (g) => { drawExclamation(g, -2.5, 0xef4444); drawExclamation(g, 2.5, 0xfef08a); },
  flank: drawFlankChevrons,
  feed: drawFeedDots,
};

function drawDizzyStars(fx: Graphics, timeSec: number): void {
  for (let i = 0; i < 3; i++) {
    const a = timeSec * 5.2 + (i * Math.PI * 2) / 3;
    const sx = Math.cos(a) * 6.5; const sy = -11 + Math.sin(a) * 2.4;
    fx.circle(sx, sy, 1.9).fill(INK);
    fx.circle(sx, sy, 1.1).fill(0xfde047);
  }
}

function drawVocalWaves(fx: Graphics, col: number, timeSec: number): void {
  for (let i = 0; i < 2; i++) {
    const p = (timeSec * 2.2 + i * 0.5) % 1;
    fx.circle(0, -6, 5 + p * 12).stroke({ color: col, width: 1.3, alpha: Math.max(0, 0.8 - p * 0.8) });
  }
}

function drawDizzyAndWaves(fx: Graphics, opts: { readonly stunned: boolean; readonly howling: boolean; readonly bluffing: boolean; readonly timeSec: number }): void {
  fx.clear();
  if (opts.stunned) drawDizzyStars(fx, opts.timeSec);
  if (opts.howling || opts.bluffing) drawVocalWaves(fx, opts.howling ? 0x7dd3fc : 0xf97316, opts.timeSec);
}

export function resolveAiVisualEffects(snap: WorldEntitySnapshot, timeSec: number, dead: boolean): { readonly alpha: number; readonly scaleYMult: number } {
  if (dead) return { alpha: 1, scaleYMult: 1 };
  if (snap.aiState === "ambush") return { alpha: 0.36, scaleYMult: 1 };
  if (snap.aiState === IND_FEED) return { alpha: 1, scaleYMult: 1 - Math.abs(Math.sin(timeSec * 6)) * 0.1 };
  if (snap.telegraphProgress > 0) return { alpha: 1, scaleYMult: 1 + snap.telegraphProgress * 0.1 };
  return { alpha: 1, scaleYMult: 1 };
}

function readFxFlags(snap: WorldEntitySnapshot, dead: boolean, timeSec: number) {
  const stunned = !dead && Boolean(snap.stunned);
  const howling = !dead && Boolean(snap.howling);
  const bluffing = !dead && Boolean(snap.bluffing);
  return { stunned, howling, bluffing, timeSec, hasFx: stunned || howling || bluffing };
}

export class AiIndicatorView {
  readonly container = new Container();
  private readonly gfx = new Graphics();
  private readonly fxGfx = new Graphics();
  private readonly baseY: number;
  private drawnKey = "";

  constructor(hpTopY: number) {
    this.baseY = hpTopY - 2;
    this.container.visible = false;
    this.container.addChild(this.gfx, this.fxGfx);
  }

  sync(opts: { readonly snap: WorldEntitySnapshot; readonly timeSec: number; readonly dead: boolean; readonly hpVisible: boolean }): void {
    const { snap, timeSec, dead, hpVisible } = opts;
    const kind = resolveIndicatorKind(snap, dead);
    const fx = readFxFlags(snap, dead, timeSec);
    this.container.visible = kind !== null || fx.hasFx;
    if (!this.container.visible) { this.drawnKey = ""; return; }
    this.syncMainMarker(kind, snap.suspicion ?? 0.5);
    this.syncFxAndPos({ kind, fx, hasFx: fx.hasFx, snap, hpVisible });
  }

  private syncFxAndPos(opts: {
    readonly kind: AiIndicatorKind | null;
    readonly fx: { readonly stunned: boolean; readonly howling: boolean; readonly bluffing: boolean; readonly timeSec: number };
    readonly hasFx: boolean; readonly snap: WorldEntitySnapshot; readonly hpVisible: boolean;
  }): void {
    const { kind, fx, hasFx, snap, hpVisible } = opts;
    if (hasFx) drawDizzyAndWaves(this.fxGfx, fx);
    else this.fxGfx.clear();
    const bob = kind === IND_INVESTIGATE ? Math.sin(fx.timeSec * 4.5) * 1.4 : 0;
    const jumpLift = (snap.jumpZ ?? 0) * JUMP_VISUAL_PX_PER_TILE;
    this.container.position.set(0, this.baseY - (hpVisible ? 5 : 0) - jumpLift + bob);
    this.container.scale.set(kind ? this.computeScale(kind, snap.telegraphProgress, fx.timeSec) : 1);
    this.container.alpha = kind === IND_FEED ? 0.72 + Math.abs(Math.sin(fx.timeSec * 5)) * 0.28 : 1;
  }

  private syncMainMarker(kind: AiIndicatorKind | null, suspicion: number): void {
    const step = kind === IND_INVESTIGATE ? Math.round(suspicion * 12) : 0;
    const key = `${kind ?? "none"}:${step}`;
    if (this.drawnKey === key) return;
    this.drawnKey = key;
    this.gfx.clear();
    if (!kind) return;
    if (kind === IND_INVESTIGATE) drawQuestionMark(this.gfx, suspicion);
    else STATIC_DRAWERS[kind]?.(this.gfx);
  }

  private computeScale(kind: AiIndicatorKind, telegraph: number, timeSec: number): number {
    if (kind === IND_CHARGE) return 1.05 + Math.abs(Math.sin(timeSec * 12)) * 0.22;
    if (kind === IND_WINDUP) return 0.96 + telegraph * 0.36;
    if (kind === IND_FEED) return 0.92 + Math.abs(Math.sin(timeSec * 5)) * 0.14;
    return 1;
  }
}
