/** Classic DAW timeline panel: docked transport bar, track quick strip, aligned gutter, and canvas lane. */
import type { SoundTrackSpec } from "../studioTypes.js";
import { TimelineCanvas, type TimelineCanvasCallbacks } from "./timelineCanvas.js";
import { TRACK_COLORS } from "./timelineDraw.js";
import { SNAP_STEPS_MS, minTrackDelaySec } from "./timelineMath.js";

const MINI_BTN_CLS = "st-mini-btn";
const BTN_CLS = "st-btn";
const BAR_CLS = "st-bar";

export interface TimelinePanelCallbacks extends TimelineCanvasCallbacks {
  readonly loopBtn: HTMLButtonElement;
  readonly onJumpStart: () => void;
  readonly onPlay: () => void;
  readonly onStop: () => void;
  readonly onToggle: (id: string, field: "enabled" | "solo") => void;
  readonly onMoveOrder: (id: string, delta: -1 | 1) => void;
  readonly onQuickGain: (id: string, gain: number) => void;
  readonly onCloneSelected: () => void;
  readonly onDeleteSelected: () => void;
  readonly onTrimStart: () => void;
}

function makeMiniBtn(opts: {
  readonly label: string; readonly cls: string; readonly title: string; readonly onClick: () => void;
}): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = opts.cls;
  b.textContent = opts.label;
  b.title = opts.title;
  b.addEventListener("click", (e) => { e.stopPropagation(); b.blur(); opts.onClick(); });
  return b;
}

function buildSnapSelect(onChange: (ms: number) => void): HTMLSelectElement {
  const sel = document.createElement("select");
  sel.className = "st-select";
  sel.title = "Timeline drag snap grid";
  for (const ms of SNAP_STEPS_MS) {
    const o = document.createElement("option");
    o.value = String(ms);
    o.textContent = ms === 0 ? "Snap: Free" : `Snap: ${ms}ms`;
    if (ms === 5) o.selected = true;
    sel.append(o);
  }
  sel.addEventListener("change", () => { sel.blur(); onChange(Number(sel.value)); });
  return sel;
}

function gutterSignature(tracks: readonly SoundTrackSpec[], selectedId: string): string {
  return `${selectedId}::${tracks.map((t) => `${t.id}|${t.name}|${t.kind}|${t.enabled}|${t.solo}`).join(";")}`;
}

function buildGutterRow(t: SoundTrackSpec, opts: {
  readonly idx: number; readonly total: number; readonly selected: boolean; readonly cb: TimelinePanelCallbacks;
}): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "st-daw-row";
  row.dataset.selected = String(opts.selected);
  row.dataset.trackId = t.id;
  row.addEventListener("click", () => opts.cb.onSelectTrack(t.id));

  const dot = document.createElement("span");
  dot.className = "st-dot";
  dot.style.background = TRACK_COLORS[t.kind];
  const name = document.createElement("span");
  name.className = "st-daw-name";
  name.textContent = t.name;

  const btns = document.createElement("div");
  btns.className = "st-daw-actions";
  const mBtn = makeMiniBtn({ label: "M", cls: MINI_BTN_CLS, title: "Mute track", onClick: () => opts.cb.onToggle(t.id, "enabled") });
  mBtn.dataset.active = String(!t.enabled);
  const sBtn = makeMiniBtn({ label: "S", cls: MINI_BTN_CLS, title: "Solo track", onClick: () => opts.cb.onToggle(t.id, "solo") });
  sBtn.dataset.active = String(t.solo);
  const upBtn = makeMiniBtn({ label: "▲", cls: MINI_BTN_CLS, title: "Move up", onClick: () => opts.cb.onMoveOrder(t.id, -1) });
  upBtn.disabled = opts.idx === 0;
  const dnBtn = makeMiniBtn({ label: "▼", cls: MINI_BTN_CLS, title: "Move down", onClick: () => opts.cb.onMoveOrder(t.id, 1) });
  dnBtn.disabled = opts.idx === opts.total - 1;
  btns.append(mBtn, sBtn, upBtn, dnBtn);
  row.append(dot, name, btns);
  return row;
}

export class TimelinePanel {
  readonly el = document.createElement("div");
  readonly readout = document.createElement("span");
  private readonly quickDot = document.createElement("span");
  private readonly quickName = document.createElement("strong");
  private readonly quickGainRange = document.createElement("input");
  private readonly quickGainVal = document.createElement("span");
  private readonly deleteBtn: HTMLButtonElement;
  private readonly trimBtn: HTMLButtonElement;
  private readonly gutterRows = document.createElement("div");
  private readonly timeline: TimelineCanvas;
  private lastSig = "";

  constructor(private readonly cb: TimelinePanelCallbacks) {
    this.el.className = "st-timeline-card";
    this.deleteBtn = makeMiniBtn({ label: "Delete", cls: `${BTN_CLS} st-btn-danger`, title: "Delete selected track", onClick: cb.onDeleteSelected });
    this.trimBtn = makeMiniBtn({ label: "Trim Start", cls: BTN_CLS, title: "Shift all tracks left so earliest starts at 0ms", onClick: cb.onTrimStart });

    const canvas = document.createElement("canvas");
    canvas.className = "st-timeline-canvas";
    this.timeline = new TimelineCanvas(canvas, cb);

    const grid = document.createElement("div");
    grid.className = "st-daw-grid";
    const gutter = document.createElement("div");
    gutter.className = "st-daw-gutter";
    const gutterHead = document.createElement("div");
    gutterHead.className = "st-daw-gutter-head";
    gutterHead.textContent = "TRACKS";
    this.gutterRows.className = "st-daw-gutter-rows";
    gutter.append(gutterHead, this.gutterRows);
    const laneWrap = document.createElement("div");
    laneWrap.className = "st-daw-lane";
    laneWrap.append(canvas);
    grid.append(gutter, laneWrap);

    this.el.append(this.buildTransportRow(), this.buildQuickStrip(), grid);
  }

  private buildTransportRow(): HTMLDivElement {
    const meta = document.createElement("div");
    meta.className = "st-timeline-meta";
    const transport = document.createElement("div");
    transport.className = BAR_CLS;
    transport.append(
      makeMiniBtn({ label: "|<", cls: BTN_CLS, title: "Jump cue to 0ms", onClick: this.cb.onJumpStart }),
      makeMiniBtn({ label: "Play [Space]", cls: `${BTN_CLS} st-btn-play`, title: "Play from cue [Space]", onClick: this.cb.onPlay }),
      makeMiniBtn({ label: "Stop", cls: BTN_CLS, title: "Stop and return playhead to cue", onClick: this.cb.onStop }),
      this.cb.loopBtn,
    );
    const rightTools = document.createElement("div");
    rightTools.className = BAR_CLS;
    rightTools.append(this.readout, this.trimBtn, buildSnapSelect((ms) => this.timeline.setSnapMs(ms)));
    meta.append(transport, rightTools);
    return meta;
  }

  private buildQuickStrip(): HTMLDivElement {
    const strip = document.createElement("div");
    strip.className = "st-quick-strip";
    this.quickDot.className = "st-dot";
    this.quickGainRange.type = "range";
    this.quickGainRange.min = "0.01";
    this.quickGainRange.max = "0.85";
    this.quickGainRange.step = "0.01";
    this.quickGainRange.className = "st-quick-gain";
    this.quickGainRange.addEventListener("input", () => {
      const selId = this.quickGainRange.dataset.trackId;
      if (selId) this.cb.onQuickGain(selId, Number(this.quickGainRange.value));
    });
    this.quickGainRange.addEventListener("change", () => this.quickGainRange.blur());
    const gainWrap = document.createElement("label");
    gainWrap.className = "st-quick-field";
    gainWrap.append("Gain ", this.quickGainRange, this.quickGainVal);

    const rightBtns = document.createElement("div");
    rightBtns.className = BAR_CLS;
    rightBtns.append(
      gainWrap,
      makeMiniBtn({ label: "Clone", cls: BTN_CLS, title: "Clone selected track", onClick: this.cb.onCloneSelected }),
      this.deleteBtn,
    );
    const leftId = document.createElement("div");
    leftId.className = BAR_CLS;
    leftId.append(this.quickDot, this.quickName);
    strip.append(leftId, rightBtns);
    return strip;
  }

  private renderGutter(tracks: readonly SoundTrackSpec[], selectedId: string): void {
    const sig = gutterSignature(tracks, selectedId);
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.gutterRows.replaceChildren();
    tracks.forEach((t, idx) => {
      this.gutterRows.append(buildGutterRow(t, { idx, total: tracks.length, selected: t.id === selectedId, cb: this.cb }));
    });
  }

  sync(opts: {
    readonly tracks: readonly SoundTrackSpec[]; readonly selectedId: string;
    readonly cueSec: number; readonly playheadSec: number; readonly readoutText: string;
  }): void {
    this.readout.textContent = opts.readoutText;
    this.renderGutter(opts.tracks, opts.selectedId);
    const sel = opts.tracks.find((t) => t.id === opts.selectedId) ?? opts.tracks[0];
    if (sel) {
      this.quickDot.style.background = TRACK_COLORS[sel.kind];
      this.quickName.textContent = sel.name;
      this.quickGainRange.dataset.trackId = sel.id;
      if (document.activeElement !== this.quickGainRange) this.quickGainRange.value = String(sel.gain);
      this.quickGainVal.textContent = sel.gain.toFixed(2);
    }
    this.deleteBtn.disabled = opts.tracks.length <= 1;
    this.trimBtn.disabled = minTrackDelaySec(opts.tracks) <= 0.001;
    this.timeline.draw({ tracks: opts.tracks, selectedId: opts.selectedId, cueSec: opts.cueSec, playheadSec: opts.playheadSec });
  }
}
