/** Compact mobile-first atmosphere, Day/Night scrubber, and quality preset toolbar. */
import { QUALITY_PRESETS, type QualityPresetId } from "@dc2d/content";
import { periodForPhase } from "@dc2d/engine";
import type { ConnectionMode } from "../net/worldClient.js";
import { ensureToolbarStyles } from "./toolbarStyles.js";

export interface ToolbarCallbacks {
  readonly onToggleTorch: () => void;
  readonly onSetDayPhase: (phase: number, paused?: boolean) => void;
  readonly onSetQuality: (preset: QualityPresetId) => void;
}

const PRESET_ORDER: readonly QualityPresetId[] = ["high", "balanced", "performance"];
const TIME_PRESETS = [
  { label: "Dawn", phase: 0.27 },
  { label: "Day", phase: 0.46 },
  { label: "Golden", phase: 0.68 },
  { label: "Dusk", phase: 0.79 },
  { label: "Night", phase: 0.94 },
] as const;

export class AtmosphereToolbar {
  private readonly dot: HTMLSpanElement;
  private readonly modeLabel: HTMLSpanElement;
  private readonly timeLabel: HTMLSpanElement;
  private readonly torchBtn: HTMLButtonElement;
  private readonly qualityBtn: HTMLButtonElement;
  private readonly drawer: HTMLDivElement;
  private readonly slider: HTMLInputElement;
  private readonly pauseBtn: HTMLButtonElement;
  private drawerOpen = false;

  constructor(host: HTMLElement, callbacks: ToolbarCallbacks) {
    ensureToolbarStyles();
    const root = el("div", "ow-hud");
    const bar = el("div", "ow-bar");
    this.dot = el("span", "ow-dot");
    this.modeLabel = el("span", "");
    this.timeLabel = el("span", "");
    const statusPill = el("div", "ow-pill");
    statusPill.append(this.dot, this.modeLabel, this.timeLabel);

    this.torchBtn = btn("Torch", () => callbacks.onToggleTorch());
    this.qualityBtn = btn("Quality: High", () => this.cycleQuality(callbacks.onSetQuality));
    const timeBtn = btn("Atmosphere ▾", () => this.toggleDrawer());
    bar.append(statusPill, this.torchBtn, this.qualityBtn, timeBtn);

    this.drawer = el("div", "ow-drawer");
    this.slider = makeSlider((val) => callbacks.onSetDayPhase(val, true));
    this.pauseBtn = btn("Pause Clock", () => {
      const paused = this.pauseBtn.dataset.paused !== "true";
      callbacks.onSetDayPhase(Number(this.slider.value), paused);
    });
    const presets = el("div", "ow-presets");
    for (const p of TIME_PRESETS) presets.append(btn(p.label, () => callbacks.onSetDayPhase(p.phase, true)));
    presets.append(this.pauseBtn);
    this.drawer.append(presets, this.slider);
    root.append(bar, this.drawer);
    host.appendChild(root);
  }

  sync(state: {
    readonly mode: ConnectionMode;
    readonly dayPhase: number;
    readonly dayPaused: boolean;
    readonly torchLit: boolean;
    readonly quality: QualityPresetId;
  }): void {
    this.dot.dataset.mode = state.mode;
    this.modeLabel.textContent = state.mode === "server" ? "Server" : state.mode === "local" ? "Local" : "Sync";
    this.timeLabel.textContent = `· ${periodForPhase(state.dayPhase)}`;
    this.torchBtn.dataset.active = String(state.torchLit);
    this.torchBtn.textContent = state.torchLit ? "Torch: ON" : "Torch: OFF";
    this.qualityBtn.textContent = `FX: ${QUALITY_PRESETS[state.quality].label}`;
    this.slider.value = state.dayPhase.toFixed(2);
    this.pauseBtn.dataset.paused = String(state.dayPaused);
    this.pauseBtn.textContent = state.dayPaused ? "Play Clock" : "Pause";
  }

  private cycleQuality(onSet: (p: QualityPresetId) => void): void {
    const current = PRESET_ORDER.findIndex((p) => this.qualityBtn.textContent?.includes(QUALITY_PRESETS[p].label));
    const next = PRESET_ORDER[(current + 1) % PRESET_ORDER.length] ?? "high";
    onSet(next);
  }

  private toggleDrawer(): void {
    this.drawerOpen = !this.drawerOpen;
    this.drawer.dataset.open = String(this.drawerOpen);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function btn(label: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", "ow-pill");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function makeSlider(onInput: (val: number) => void): HTMLInputElement {
  const slider = el("input", "ow-slider");
  slider.type = "range";
  slider.min = "0";
  slider.max = "0.99";
  slider.step = "0.01";
  slider.addEventListener("input", () => onInput(Number(slider.value)));
  return slider;
}
