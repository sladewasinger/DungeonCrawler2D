/** Right-side interactive Sandbox Pose Tuner drawer with preview overrides and JSON save. */
import { DEFAULT_APPEARANCE, type ArmorEquipment, type PlayerSnapshot } from "@dc2d/engine";
import { resolveFacingDir8 } from "../../render/character/characterTypes.js";
import {
  copyBodyTuning, getFullPoseTuning, mirrorEastWestPair,
  resetPoseTuning, resetPoseTuningDir, savePoseTuningToServer,
} from "../../render/poseTuning/poseTuningStore.js";
import { DIR8_LABELS, DIR8_VECTORS, type BodyKind } from "../../render/poseTuning/poseTuningTypes.js";
import { resolveDir8Idx } from "../../render/world/playerPoseHelpers.js";
import { isolateDrawerEvents, makeActionBtn, makePillGroup, makeSliderRow, ptNode } from "./poseTunerControls.js";
import { renderTuneFields, type TuneTab } from "./poseTunerSections.js";
import { ensurePoseTunerStyles } from "./poseTunerStyles.js";

type LoadoutKind = "empty" | "sword" | "bow";

interface UiState {
  open: boolean;
  body: BodyKind;
  loadout: LoadoutKind;
  lantern: boolean;
  bowCharge: number;
  dirLock: number | "mouse";
  tab: TuneTab;
  syncCardinalLR: boolean;
}

const STORAGE_KEY = "dc2d-pose-tuner-ui";
const CLS_SEC = "pt-sec";
const CLS_PILLS = "pt-pills";
const VARIANT_DEF = "default";
const EMPTY_ARMOR: ArmorEquipment = { head: null, chest: null, legs: null, feet: null, offhand: null };

const BODY_ITEMS: readonly { readonly id: BodyKind; readonly label: string }[] = [
  { id: "female", label: "Female" }, { id: "male", label: "Male" },
];
const LOADOUT_ITEMS: readonly { readonly id: LoadoutKind; readonly label: string }[] = [
  { id: "empty", label: "Empty" }, { id: "sword", label: "Sword" }, { id: "bow", label: "Bow" },
];
const LANTERN_ITEMS: readonly { readonly id: "off" | "on"; readonly label: string }[] = [
  { id: "off", label: "Off" }, { id: "on", label: "On" },
];
const DIR_ITEMS: readonly { readonly id: number | "mouse"; readonly label: string }[] = [
  ...DIR8_LABELS.map((label, id) => ({ id: id as number | "mouse", label })),
  { id: "mouse", label: "Mouse" },
];
const TAB_ITEMS: readonly { readonly id: TuneTab; readonly label: string }[] = [
  { id: "freeLeft", label: "L Arm" }, { id: "freeRight", label: "R Arm" },
  { id: "sword", label: "Sword" }, { id: "lantern", label: "Lantern" }, { id: "bow", label: "Bow" },
];

function loadInitialUi(): UiState {
  const urlOpen = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tuner") === "1";
  const base: UiState = { open: urlOpen, body: "female", loadout: "empty", lantern: false, bowCharge: 0.85, dirLock: 0, tab: "freeLeft", syncCardinalLR: true };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    return { ...base, ...(JSON.parse(raw) as Partial<UiState>), open: urlOpen || Boolean((JSON.parse(raw) as Partial<UiState>).open) };
  } catch {
    return base;
  }
}

function saveUi(ui: UiState): void {
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ui)); } catch { /* ignore */ }
}

export class PoseTunerPanel {
  readonly el: HTMLDivElement;
  private readonly ui: UiState = loadInitialUi();
  private readonly previewHost = ptNode("div", CLS_SEC);
  private readonly fieldsHost = ptNode("div", CLS_SEC);
  private readonly statusEl = ptNode("div", "pt-status");
  private lastMouseDirIdx = 0;

  constructor(host: HTMLElement, private readonly hooks: { readonly onZoomClose: () => void }) {
    ensurePoseTunerStyles();
    this.el = ptNode("div", "pt-drawer ow-hud");
    isolateDrawerEvents(this.el);
    const head = ptNode("div", "pt-head");
    const hBtns = ptNode("div", CLS_PILLS);
    hBtns.append(makeActionBtn("Zoom 4x", VARIANT_DEF, () => this.hooks.onZoomClose()), makeActionBtn("Close", VARIANT_DEF, () => this.setOpen(false)));
    head.append(ptNode("span", "pt-title", "POSE TUNER"), hBtns);
    this.el.append(head, this.previewHost, this.fieldsHost, this.buildActionsSec(), this.statusEl);
    host.append(this.el);
    this.syncVisibility();
    this.renderAll();
  }

  isOpen(): boolean { return this.ui.open; }
  toggle(): void { this.setOpen(!this.ui.open); }

  setOpen(open: boolean): void {
    this.ui.open = open;
    saveUi(this.ui);
    this.syncVisibility();
    if (open) this.renderAll();
  }

  applyPreview(pl: PlayerSnapshot): PlayerSnapshot {
    if (!this.ui.open) return pl;
    const baseApp = pl.appearance ?? DEFAULT_APPEARANCE;
    const facing = typeof this.ui.dirLock === "number" ? this.lockedFacing(this.ui.dirLock) : this.trackMouseDir(pl);
    return {
      ...pl,
      appearance: { ...baseApp, body: this.ui.body, hairStyle: this.ui.body === "female" ? "ponytail" : "short" },
      heldItem: this.ui.loadout === "empty" ? null : this.ui.loadout,
      torchLit: this.ui.lantern,
      bowCharge: this.ui.loadout === "bow" ? this.ui.bowCharge : 0,
      armor: { ...(pl.armor ?? EMPTY_ARMOR), offhand: null },
      ...facing,
    };
  }

  private lockedFacing(dirIdx: number): { readonly facingX: number; readonly facingY: number; readonly aimX: number; readonly aimY: number } {
    const v = DIR8_VECTORS[dirIdx] ?? DIR8_VECTORS[0]!;
    return { facingX: v.x, facingY: v.y, aimX: v.x, aimY: v.y };
  }

  private trackMouseDir(pl: PlayerSnapshot): Record<string, never> {
    const f = resolveFacingDir8(pl.aimX ?? pl.facingX, pl.aimY ?? pl.facingY);
    const idx = resolveDir8Idx(f.dir, f.flipX);
    if (idx !== this.lastMouseDirIdx) {
      this.lastMouseDirIdx = idx;
      if (!this.el.contains(document.activeElement)) this.renderAll();
    }
    return {};
  }

  private activeDirIdx(): number {
    return typeof this.ui.dirLock === "number" ? this.ui.dirLock : this.lastMouseDirIdx;
  }

  private syncVisibility(): void { this.el.classList.toggle("pt-hidden", !this.ui.open); }

  private setStatus(msg: string, isErr = false): void {
    this.statusEl.textContent = msg;
    this.statusEl.classList.toggle("pt-err", isErr);
  }

  private renderAll(): void {
    saveUi(this.ui);
    this.renderPreviewControls();
    this.renderFields();
  }

  private renderFields(): void {
    renderTuneFields(this.fieldsHost, {
      body: this.ui.body, dirIdx: this.activeDirIdx(), tab: this.ui.tab,
      syncCardinalLR: this.ui.syncCardinalLR,
      onToggleSyncLR: (v) => { this.ui.syncCardinalLR = v; saveUi(this.ui); this.renderFields(); },
    }, () => this.renderFields());
  }

  private renderPreviewControls(): void {
    this.previewHost.replaceChildren(
      makePillGroup({ label: "Body", items: BODY_ITEMS, active: this.ui.body, onSelect: (id) => { this.ui.body = id; this.renderAll(); } }),
      makePillGroup({ label: "Loadout", items: LOADOUT_ITEMS, active: this.ui.loadout, onSelect: (id) => this.selectLoadout(id) }),
      makePillGroup({ label: "Lantern", items: LANTERN_ITEMS, active: this.ui.lantern ? "on" : "off", onSelect: (id) => this.selectLantern(id === "on") }),
      makePillGroup({ label: `Facing (${DIR8_LABELS[this.activeDirIdx()] ?? "S"})`, items: DIR_ITEMS, active: this.ui.dirLock, onSelect: (id) => { this.ui.dirLock = id; this.renderAll(); } }),
      makePillGroup({ label: "Edit Layer", items: TAB_ITEMS, active: this.ui.tab, onSelect: (id) => { this.ui.tab = id; this.renderAll(); } }),
    );
    if (this.ui.loadout === "bow") {
      this.previewHost.append(makeSliderRow({ label: "Bow Charge", min: 0, max: 1, step: 0.05, value: this.ui.bowCharge, onChange: (v) => { this.ui.bowCharge = v; saveUi(this.ui); } }));
    }
  }

  private selectLoadout(loadout: LoadoutKind): void {
    this.ui.loadout = loadout;
    this.ui.tab = loadout === "sword" ? "sword" : loadout === "bow" ? "bow" : "freeLeft";
    this.renderAll();
  }

  private selectLantern(on: boolean): void {
    this.ui.lantern = on;
    if (on && this.ui.loadout !== "bow") this.ui.tab = "lantern";
    else if (!on && this.ui.tab === "lantern") this.ui.tab = "freeLeft";
    this.renderAll();
  }

  private buildActionsSec(): HTMLDivElement {
    const sec = ptNode("div", CLS_SEC);
    const r1 = ptNode("div", CLS_PILLS);
    const other: BodyKind = this.ui.body === "female" ? "male" : "female";
    r1.append(
      makeActionBtn("Mirror E<->W", VARIANT_DEF, () => {
        const ok = mirrorEastWestPair(this.ui.body, this.activeDirIdx());
        this.setStatus(ok ? "Mirrored E <-> W pose" : "Select SE, E, NE, NW, W, or SW to mirror", !ok);
      }),
      makeActionBtn(`Copy -> ${other}`, VARIANT_DEF, () => {
        copyBodyTuning(this.ui.body, other);
        this.setStatus(`Copied ${this.ui.body} tuning to ${other}`);
        this.renderFields();
      }),
      makeActionBtn("Reset Dir", "warn", () => { resetPoseTuningDir(this.ui.body, this.activeDirIdx()); this.setStatus("Reset active direction"); this.renderFields(); }),
      makeActionBtn("Reset All", "warn", () => { resetPoseTuning(); this.setStatus("Reset all defaults"); this.renderFields(); }),
    );
    const r2 = ptNode("div", CLS_PILLS);
    r2.append(
      makeActionBtn("Save to Repo", "save", () => { void this.handleSave(); }),
      makeActionBtn("Copy JSON", VARIANT_DEF, () => { void this.handleCopyJson(); }),
    );
    sec.append(r1, r2);
    return sec;
  }

  private async handleSave(): Promise<void> {
    this.setStatus("Saving...");
    const res = await savePoseTuningToServer();
    this.setStatus(res.message, !res.ok);
  }

  private async handleCopyJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(getFullPoseTuning(), null, 2));
      this.setStatus("Copied playerPoseTuning.json to clipboard");
    } catch {
      this.setStatus("Clipboard write blocked", true);
    }
  }
}
