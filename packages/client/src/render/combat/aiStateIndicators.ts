/** Diegetic 3-stage perception & behavior indicators (?, brief ! pop, distinct Attack Windup/Charge, Flank, Feed). */
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

function drawQuestionMark(g: Graphics): void {
  const segs: readonly (readonly [number, number, number, number])[] = [
    [-3, -12, 6, 2], [-3, -10, 2, 2], [1, -10, 2, 4], [-1, -7, 3, 2], [-1, -5, 2, 2], [-1, -2, 2, 2],
  ];
  for (const [x, y, w, h] of segs) g.rect(x - 1, y - 1, w + 2, h + 2).fill(INK);
  for (const [x, y, w, h] of segs) g.rect(x, y, w, h).fill(0xfacc15);
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

const INDICATOR_DRAWERS: Record<AiIndicatorKind, (g: Graphics) => void> = {
  spotted: (g) => drawExclamation(g, 0, 0xf97316),
  windup: drawWindupDiamond,
  charge: (g) => { drawExclamation(g, -2.5, 0xef4444); drawExclamation(g, 2.5, 0xfef08a); },
  investigate: drawQuestionMark,
  flank: drawFlankChevrons,
  feed: drawFeedDots,
};

export function resolveAiVisualEffects(snap: WorldEntitySnapshot, timeSec: number, dead: boolean): {
  readonly alpha: number;
  readonly scaleYMult: number;
} {
  if (dead) return { alpha: 1, scaleYMult: 1 };
  if (snap.aiState === "ambush") return { alpha: 0.36, scaleYMult: 1 };
  if (snap.aiState === IND_FEED) return { alpha: 1, scaleYMult: 1 - Math.abs(Math.sin(timeSec * 6)) * 0.1 };
  if (snap.telegraphProgress > 0) return { alpha: 1, scaleYMult: 1 + snap.telegraphProgress * 0.1 };
  return { alpha: 1, scaleYMult: 1 };
}

export class AiIndicatorView {
  readonly container = new Container();
  private readonly gfx = new Graphics();
  private readonly baseY: number;
  private drawnKind: AiIndicatorKind | null = null;

  constructor(hpTopY: number) {
    this.baseY = hpTopY - 2;
    this.container.visible = false;
    this.container.addChild(this.gfx);
  }

  sync(opts: {
    readonly snap: WorldEntitySnapshot; readonly timeSec: number; readonly dead: boolean; readonly hpVisible: boolean;
  }): void {
    const { snap, timeSec, dead, hpVisible } = opts;
    const kind = resolveIndicatorKind(snap, dead);
    this.container.visible = kind !== null;
    if (!kind) { this.drawnKind = null; return; }
    this.ensureDrawnKind(kind);
    const bob = kind === IND_INVESTIGATE ? Math.sin(timeSec * 4.5) * 1.4 : 0;
    const jumpLift = (snap.jumpZ ?? 0) * JUMP_VISUAL_PX_PER_TILE;
    this.container.position.set(0, this.baseY - (hpVisible ? 5 : 0) - jumpLift + bob);
    this.container.scale.set(this.computeScale(kind, snap.telegraphProgress, timeSec));
    this.container.alpha = kind === IND_FEED ? 0.72 + Math.abs(Math.sin(timeSec * 5)) * 0.28 : 1;
  }

  private ensureDrawnKind(kind: AiIndicatorKind): void {
    if (this.drawnKind === kind) return;
    this.drawnKind = kind;
    this.gfx.clear();
    INDICATOR_DRAWERS[kind](this.gfx);
  }

  private computeScale(kind: AiIndicatorKind, telegraph: number, timeSec: number): number {
    if (kind === IND_CHARGE) return 1.05 + Math.abs(Math.sin(timeSec * 12)) * 0.22;
    if (kind === IND_WINDUP) return 0.96 + telegraph * 0.36;
    if (kind === IND_FEED) return 0.92 + Math.abs(Math.sin(timeSec * 5)) * 0.14;
    return 1;
  }
}