/** Unified desktop & mobile Settings modal (Video/Gore, Audio, Controls, Character & Session). */
import { QUALITY_PRESETS, type QualityPresetId } from "@dc2d/content";
import type { AudioEngine } from "../../audio/audioEngine.js";
import type { AudioPrefs } from "../../audio/audioPrefs.js";
import { loadGoreLevel, saveGoreLevel, type GoreLevel } from "../../render/combat/gore/gorePrefs.js";
import { isFullscreenActive, isFullscreenSupported, onFullscreenChange, toggleFullscreen } from "../fullscreen.js";
import {
  makeChoiceRow, makeNode, makePillBtn, makeSection, makeSliderRow, makeToggleRow,
} from "./settingsControls.js";
import { loadSettingsPrefs, saveSettingsPrefs, type SettingsPrefs } from "./settingsPrefs.js";
import { ensureSettingsStyles } from "./settingsStyles.js";

export interface SettingsCallbacks {
  readonly audio: AudioEngine;
  readonly isLocalDebug: boolean;
  readonly initialQuality: QualityPresetId;
  readonly initialZoom: number;
  readonly onSetQuality: (preset: QualityPresetId) => void;
  readonly onSetGoreLevel: (level: GoreLevel) => void;
  readonly onZoom: (factor: number) => number;
  readonly onToggleCharacter: () => void;
  readonly onRespawn: () => void;
  readonly onReturnToTitle: () => void;
  readonly onPrefsChange: (prefs: SettingsPrefs) => void;
}

const QUALITY_CHOICES: readonly { readonly id: QualityPresetId; readonly label: string }[] = [
  { id: "high", label: QUALITY_PRESETS.high.label },
  { id: "balanced", label: QUALITY_PRESETS.balanced.label },
  { id: "performance", label: QUALITY_PRESETS.performance.label },
];

const GORE_CHOICES: readonly { readonly id: GoreLevel; readonly label: string }[] = [
  { id: "full", label: "Full" },
  { id: "reduced", label: "Reduced" },
  { id: "off", label: "Off" },
];

const CLS_ROW = "ow-settings-row";

export class SettingsMenu {
  private readonly backdrop: HTMLDivElement;
  private prefs: SettingsPrefs = loadSettingsPrefs();
  private readonly muteBtn: HTMLButtonElement;
  private readonly fsBtn: HTMLButtonElement | null;
  private readonly zoomValEl: HTMLSpanElement;
  private readonly musicRow: ReturnType<typeof makeSliderRow>;
  private readonly sfxRow: ReturnType<typeof makeSliderRow>;
  private readonly qualityChoice: ReturnType<typeof makeChoiceRow<QualityPresetId>>;
  private open = false;

  constructor(host: HTMLElement, private readonly cb: SettingsCallbacks) {
    ensureSettingsStyles();
    this.backdrop = makeNode("div", "ow-settings-backdrop");
    this.backdrop.hidden = true;
    const modal = makeNode("section", "ow-settings-modal");
    modal.setAttribute("aria-label", "Settings");

    const { sec: videoSec, qualityChoice, fsBtn, zoomVal } = this.buildVideoSection();
    this.qualityChoice = qualityChoice;
    this.fsBtn = fsBtn;
    this.zoomValEl = zoomVal;

    const { sec: audioSec, muteBtn, musicRow, sfxRow } = this.buildAudioSection();
    this.muteBtn = muteBtn;
    this.musicRow = musicRow;
    this.sfxRow = sfxRow;

    modal.append(this.buildHeader(), this.buildSessionSection(), videoSec, audioSec, this.buildControlsSection());
    this.backdrop.append(modal);
    this.backdrop.addEventListener("pointerdown", (e) => { if (e.target === this.backdrop) this.setOpen(false); });
    host.append(this.backdrop);
    onFullscreenChange(() => this.syncFs());
    this.syncAudioUi(cb.audio.getPrefs());
    this.syncFs();
  }

  currentPrefs(): SettingsPrefs { return this.prefs; }
  isOpen(): boolean { return this.open; }
  toggle(): void { this.setOpen(!this.open); }

  setOpen(next: boolean): void {
    this.open = next;
    this.backdrop.hidden = !next;
    if (next) this.syncAudioUi(this.cb.audio.getPrefs());
  }

  syncExternalState(quality: QualityPresetId, zoom: number): void {
    this.qualityChoice.setActive(quality);
    this.zoomValEl.textContent = `${zoom.toFixed(1)}×`;
    this.syncFs();
  }

  private buildHeader(): HTMLDivElement {
    const head = makeNode("div", "ow-settings-head");
    const title = makeNode("span", "");
    title.textContent = "Settings";
    head.append(title, makePillBtn("Close", () => this.setOpen(false)));
    return head;
  }

  private buildSessionSection(): HTMLDivElement {
    const sec = makeSection("Hero & Session");
    const row = makeNode("div", "ow-settings-actions");
    row.append(
      makePillBtn("Change Hero", () => { this.setOpen(false); this.cb.onToggleCharacter(); }),
      makePillBtn("Respawn", () => { this.setOpen(false); this.cb.onRespawn(); }, "ow-settings-danger"),
      makePillBtn("Title Screen", () => { this.setOpen(false); this.cb.onReturnToTitle(); }),
    );
    sec.append(row);
    return sec;
  }

  private buildVideoSection() {
    const sec = makeSection("Video & Graphics");
    const qualityChoice = makeChoiceRow({
      label: "Quality", choices: QUALITY_CHOICES, activeId: this.cb.initialQuality, onSelect: (id) => this.cb.onSetQuality(id),
    });
    const goreChoice = makeChoiceRow({
      label: "Gore", choices: GORE_CHOICES, activeId: loadGoreLevel(),
      onSelect: (lvl) => { saveGoreLevel(lvl); this.cb.onSetGoreLevel(lvl); },
    });
    const zoomControl = this.buildZoomRow();
    const fpsToggle = makeToggleRow("Show FPS", this.prefs.showFps, (val) => this.updatePrefs({ showFps: val }));
    sec.append(qualityChoice.row, goreChoice.row, zoomControl.row, fpsToggle.row);
    const fsBtn = this.appendOptionalVideoRows(sec);
    return { sec, qualityChoice, fsBtn, zoomVal: zoomControl.zoomVal };
  }

  private appendOptionalVideoRows(sec: HTMLDivElement): HTMLButtonElement | null {
    if (this.cb.isLocalDebug) {
      const hb = makeToggleRow("Debug Hitboxes", this.prefs.showHitboxes, (val) => this.updatePrefs({ showHitboxes: val }));
      sec.append(hb.row);
    }
    if (!isFullscreenSupported()) return null;
    const row = makeNode("div", CLS_ROW);
    const lbl = makeNode("span", "");
    lbl.textContent = "Fullscreen";
    const fsBtn = makePillBtn("Toggle", () => void toggleFullscreen());
    row.append(lbl, fsBtn);
    sec.append(row);
    return fsBtn;
  }

  private buildZoomRow() {
    const row = makeNode("div", CLS_ROW);
    const lbl = makeNode("span", "");
    lbl.textContent = "Camera Zoom";
    const grp = makeNode("div", "ow-settings-actions");
    const zoomVal = makeNode("span", "ow-settings-zoom-val");
    zoomVal.textContent = `${this.cb.initialZoom.toFixed(1)}×`;
    grp.append(
      makePillBtn("−", () => { zoomVal.textContent = `${this.cb.onZoom(1 / 1.18).toFixed(1)}×`; }, "ow-zoom-btn"),
      zoomVal,
      makePillBtn("+", () => { zoomVal.textContent = `${this.cb.onZoom(1.18).toFixed(1)}×`; }, "ow-zoom-btn"),
    );
    row.append(lbl, grp);
    return { row, zoomVal };
  }

  private buildAudioSection() {
    const sec = makeSection("Audio");
    const prefs = this.cb.audio.getPrefs();
    const row = makeNode("div", CLS_ROW);
    const lbl = makeNode("span", "");
    lbl.textContent = "Sound";
    const muteBtn = makePillBtn("Mute All", () => {
      const cur = this.cb.audio.getPrefs();
      this.updateAudio({ muted: !cur.muted });
    });
    row.append(lbl, muteBtn);
    const musicRow = makeSliderRow("Music", prefs.music, (v) => this.updateAudio({ music: v }));
    const sfxRow = makeSliderRow("SFX", prefs.sfx, (v) => this.updateAudio({ sfx: v }));
    sec.append(row, musicRow.row, sfxRow.row);
    return { sec, muteBtn, musicRow, sfxRow };
  }

  private buildControlsSection(): HTMLDivElement {
    const sec = makeSection("Controls");
    const autoAim = makeToggleRow("Mobile Auto-Aim", this.prefs.autoAim, (val) => this.updatePrefs({ autoAim: val }));
    sec.append(autoAim.row);
    return sec;
  }

  private updateAudio(patch: Partial<AudioPrefs>): void {
    const next = { ...this.cb.audio.getPrefs(), ...patch };
    this.cb.audio.setPrefs(next);
    this.syncAudioUi(next);
  }

  private syncAudioUi(prefs: AudioPrefs): void {
    this.muteBtn.dataset.active = String(prefs.muted);
    this.muteBtn.textContent = prefs.muted ? "Muted" : "Mute All";
    this.musicRow.sync(prefs.music);
    this.sfxRow.sync(prefs.sfx);
  }

  private updatePrefs(patch: Partial<SettingsPrefs>): void {
    this.prefs = { ...this.prefs, ...patch };
    saveSettingsPrefs(this.prefs);
    this.cb.onPrefsChange(this.prefs);
  }

  private syncFs(): void {
    if (!this.fsBtn) return;
    const active = isFullscreenActive();
    this.fsBtn.dataset.active = String(active);
    this.fsBtn.textContent = active ? "Exit FS" : "Enter FS";
  }
}