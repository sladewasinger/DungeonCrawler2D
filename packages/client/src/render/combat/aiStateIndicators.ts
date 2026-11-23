/** Diegetic overhead pixel indicators and sprite concealment/feed tells for creature AI states. */
import type { WorldEntitySnapshot } from "@dc2d/engine";
import { Container, Graphics } from "pixi.js";

export type AiIndicatorKind = "alert" | "charge" | "investigate" | "flank" | "feed";

const IND_ALERT: AiIndicatorKind = "alert";
const IND_CHARGE: AiIndicatorKind = "charge";
const IND_INVESTIGATE: AiIndicatorKind = "investigate";
const IND_FLANK: AiIndicatorKind = "flank";
const IND_FEED: AiIndicatorKind = "feed";
const INK = 0x0f172a;
const CALM_STATES = new Set<string>(["idle", "patrol", "ambush", "return"]);

const DIRECT_INDICATOR_MAP: Partial<Record<string, AiIndicatorKind>> = {
  [IND_CHARGE]: IND_CHARGE,
  [IND_ALERT]: IND_ALERT,
  [IND_INVESTIGATE]: IND_INVESTIGATE,
  [IND_FLANK]: IND_FLANK,
  [IND_FEED]: IND_FEED,
};

function resolveIndicatorKind(opts: {
  readonly snap: WorldEntitySnapshot; readonly dead: boolean;
  readonly timeSec: number; readonly chasePopUntilSec: number;
}): AiIndicatorKind | null {
  const { snap, dead, timeSec, chasePopUntilSec } = opts;
  if (dead) return null;
  const state = snap.aiState ?? "idle";
  if (state === IND_CHARGE) return IND_CHARGE;
  if (snap.telegraphProgress > 0) return IND_ALERT;
  const direct = DIRECT_INDICATOR_MAP[state];
  if (direct) return direct;
  return state === "chase" && timeSec < chasePopUntilSec ? IND_ALERT : null;
}

function drawExclamation(g: Graphics, ox: number, fill: number): void {
  g.rect(ox - 2, -12, 4, 7).fill(INK);
  g.rect(ox - 2, -4, 4, 4).fill(INK);
  g.rect(ox - 1, -11, 2, 5).fill(fill);
  g.rect(ox - 1, -3, 2, 2).fill(fill);
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
  alert: (g) => drawExclamation(g, 0, 0xf97316),
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
  private prevAiState = "idle";
  private chasePopUntilSec = 0;

  constructor(hpTopY: number) {
    this.baseY = hpTopY - 2;
    this.container.visible = false;
    this.container.addChild(this.gfx);
  }

  sync(opts: {
    readonly snap: WorldEntitySnapshot; readonly timeSec: number; readonly dead: boolean; readonly hpVisible: boolean;
  }): void {
    const { snap, timeSec, dead, hpVisible } = opts;
    const state = snap.aiState ?? "idle";
    if (CALM_STATES.has(this.prevAiState) && state === "chase") {
      this.chasePopUntilSec = timeSec + 1.2;
    }
    this.prevAiState = state;
    const kind = resolveIndicatorKind({ snap, dead, timeSec, chasePopUntilSec: this.chasePopUntilSec });
    this.container.visible = kind !== null;
    if (!kind) return;
    this.ensureDrawnKind(kind);
    const bob = kind === IND_INVESTIGATE ? Math.sin(timeSec * 4.5) * 1.4 : 0;
    this.container.position.set(0, this.baseY - (hpVisible ? 5 : 0) + bob);
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
    if (kind === IND_ALERT && telegraph > 0) return 1 + telegraph * 0.28;
    if (kind === IND_FEED) return 0.92 + Math.abs(Math.sin(timeSec * 5)) * 0.14;
    return 1;
  }
}
