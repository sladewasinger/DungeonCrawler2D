/** Minimalist HUD toolbar: top-left compact bag icon (plus ?debug=1 bar) and top-right FPS, compass, and settings gear. */
import { QUALITY_PRESETS, type QualityPresetId } from "@dc2d/content";
import { periodForPhase, type EntityKind } from "@dc2d/engine";
import type { ConnectionMode } from "../net/worldClient.js";
import { FpsCounter, PingCounter } from "./fpsCounter.js";
import { onFullscreenStateChange, shouldShowFullscreenPrompt, toggleFullscreen } from "./fullscreen.js";
import { DebugSpawnPopover } from "./hud/debugSpawnPopover.js";
import type { ActiveHudPanel } from "./hud/hudRoot.js";
import { CompassBadge } from "./map/compassBadge.js";
import { isLocalDebugOrigin } from "./settings/settingsPrefs.js";
import { ensureToolbarStyles } from "./toolbarStyles.js";

export interface ToolbarCallbacks {
  readonly onSetDayPhase: (phase: number, paused?: boolean) => void;
  readonly onSetQuality: (preset: QualityPresetId) => void;
  readonly onToggleInventory: () => void;
  readonly onToggleSettings: () => void;
  readonly onDebugSpawn?: (kind: EntityKind, count: number) => void;
}

function isDebugMode(): boolean {
  if (!isLocalDebugOrigin()) return false;
  const params = new URLSearchParams(window.location.search);
  return ["1", "true"].includes(params.get("debug") ?? "") || ["1", "true"].includes(params.get("admin") ?? "");
}

const PRESET_ORDER: readonly QualityPresetId[] = ["high", "balanced", "performance"];
const TIME_PRESETS = [
  { label: "Dawn", phase: 0.27 },
  { label: "Day", phase: 0.46 },
  { label: "Golden", phase: 0.68 },
  { label: "Dusk", phase: 0.79 },
  { label: "Night", phase: 0.94 },
] as const;

const BACKPACK_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M9 6a3 3 0 0 1 6 0"/>
  <rect x="4" y="6" width="16" height="14" rx="3" fill="rgba(180,83,9,0.45)"/>
  <path d="M4 12h16"/>
  <rect x="9" y="10" width="6" height="4" rx="1"/>
</svg>`;

const GEAR_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.79 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
</svg>`;

const EXPAND_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
</svg>`;

export class AtmosphereToolbar {
  private readonly debug = isDebugMode();
  private readonly dot: HTMLSpanElement;
  private readonly modeLabel: HTMLSpanElement;
  private readonly timeLabel: HTMLSpanElement;
  private readonly bagBtn: HTMLButtonElement;
  private readonly qualityBtn: HTMLButtonElement;
  private readonly fullscreenBtn: HTMLButtonElement;
  private readonly settingsBtn: HTMLButtonElement;
  private readonly compass = new CompassBadge();
  private readonly fps = new FpsCounter();
  private readonly ping = new PingCounter();
  private readonly drawer: HTMLDivElement;
  private readonly spawnPopover: DebugSpawnPopover | null;
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

    this.bagBtn = iconBtn({ svg: BACKPACK_SVG, label: "Inventory (Tab)", onClick: callbacks.onToggleInventory });
    this.qualityBtn = btn("FX: High", () => this.cycleQuality(callbacks.onSetQuality));
    const timeBtn = btn("Atmosphere ▾", () => this.toggleDrawer());
    this.spawnPopover = this.debug ? new DebugSpawnPopover((kind, count) => callbacks.onDebugSpawn?.(kind, count)) : null;
    const spawnBtn = btn("Spawn ▾", () => this.spawnPopover?.toggle());
    if (this.debug) bar.append(statusPill, this.bagBtn, this.qualityBtn, timeBtn, spawnBtn);
    else bar.append(this.bagBtn);

    this.drawer = this.buildDrawer(callbacks.onSetDayPhase);
    this.slider = this.drawer.querySelector("input") as HTMLInputElement;
    this.pauseBtn = this.drawer.querySelector("[data-role='pause']") as HTMLButtonElement;
    if (this.debug && this.spawnPopover) root.append(bar, this.drawer, this.spawnPopover.el);
    else root.append(bar);

    const topRight = el("div", "ow-zoom-controls");
    this.fullscreenBtn = buildFullscreenBtn();
    this.settingsBtn = iconBtn({ svg: GEAR_SVG, label: "Settings", onClick: callbacks.onToggleSettings });
    topRight.append(this.fps.el, this.ping.el, this.compass.el, this.fullscreenBtn, this.settingsBtn);
    host.append(root, topRight);
    onFullscreenStateChange(() => this.syncFullscreenBtn());
    this.syncFullscreenBtn();
  }

  setFpsVisible(visible: boolean): void {
    this.fps.setVisible(visible);
  }

  setPingVisible(visible: boolean): void {
    this.ping.setVisible(visible);
  }

  tickFps(nowMs: number): void {
    this.fps.tick(nowMs);
  }

  sync(state: {
    readonly mode: ConnectionMode;
    readonly pingMs?: number | null | undefined;
    readonly dayPhase: number;
    readonly dayPaused: boolean;
    readonly quality: QualityPresetId;
    readonly activePanel: ActiveHudPanel;
    readonly settingsOpen: boolean;
    readonly playerX?: number;
    readonly playerY?: number;
  }): void {
    this.bagBtn.dataset.active = String(state.activePanel === "inventory");
    this.settingsBtn.dataset.active = String(state.settingsOpen);
    this.syncFullscreenBtn();
    this.ping.sync(state.mode, state.pingMs);
    this.compass.sync(state.playerX ?? 0, state.playerY ?? 0);
    if (this.debug) this.syncDebugBar(state);
  }

  private buildDrawer(onSetDayPhase: (phase: number, paused?: boolean) => void): HTMLDivElement {
    const drawer = el("div", "ow-drawer");
    const slider = makeSlider((val) => onSetDayPhase(val, true));
    const pauseBtn = btn("Pause Clock", () => {
      const paused = pauseBtn.dataset.paused !== "true";
      onSetDayPhase(Number(slider.value), paused);
    });
    pauseBtn.dataset.role = "pause";
    const presets = el("div", "ow-presets");
    for (const p of TIME_PRESETS) presets.append(btn(p.label, () => onSetDayPhase(p.phase, true)));
    presets.append(pauseBtn);
    drawer.append(presets, slider);
    return drawer;
  }

  private syncDebugBar(state: {
    readonly mode: ConnectionMode; readonly dayPhase: number; readonly dayPaused: boolean; readonly quality: QualityPresetId;
  }): void {
    this.dot.dataset.mode = state.mode;
    this.modeLabel.textContent = state.mode === "server"
      ? "Server"
      : state.mode === "reconnecting"
        ? "Reconnecting"
        : state.mode === "connecting"
          ? "Connecting"
          : "Offline";
    this.timeLabel.textContent = `· ${periodForPhase(state.dayPhase)}`;
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

  private syncFullscreenBtn(): void {
    this.fullscreenBtn.hidden = !shouldShowFullscreenPrompt();
  }
}

function buildFullscreenBtn(): HTMLButtonElement {
  const b = el("button", "ow-pill ow-fs-pill");
  b.type = "button";
  b.setAttribute("aria-label", "Fullscreen");
  b.title = "Enter Fullscreen";
  b.innerHTML = `${EXPAND_SVG}<span>Fullscreen</span>`;
  b.addEventListener("pointerdown", (e) => e.stopPropagation());
  b.addEventListener("click", () => { void toggleFullscreen(); });
  return b;
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

function iconBtn(opts: { readonly svg: string; readonly label: string; readonly onClick: () => void }): HTMLButtonElement {
  const b = el("button", "ow-pill ow-icon-pill");
  b.type = "button";
  b.setAttribute("aria-label", opts.label);
  b.title = opts.label;
  b.innerHTML = opts.svg;
  b.addEventListener("click", opts.onClick);
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