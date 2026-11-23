/** Compact floating audio & gore settings popover (Music/SFX sliders, Mute, Gore). */
import type { AudioEngine } from "../audio/audioEngine.js";
import type { AudioPrefs } from "../audio/audioPrefs.js";
import { loadGoreLevel, saveGoreLevel, type GoreLevel } from "../render/combat/gore/gorePrefs.js";

function makeEl<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

function makeVolumeRow(label: string, initial: number, onInput: (val: number) => void): {
  readonly row: HTMLDivElement;
  readonly slider: HTMLInputElement;
  readonly valueEl: HTMLSpanElement;
} {
  const row = makeEl("div", "ow-audio-row");
  const head = makeEl("div", "ow-audio-row-head");
  const name = makeEl("span", "");
  name.textContent = label;
  const valueEl = makeEl("span", "ow-audio-pct");
  valueEl.textContent = `${Math.round(initial * 100)}%`;
  head.append(name, valueEl);

  const slider = makeEl("input", "ow-slider");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "0.05";
  slider.value = initial.toFixed(2);
  slider.setAttribute("aria-label", `${label} volume`);
  slider.addEventListener("input", () => {
    const v = Number(slider.value);
    valueEl.textContent = `${Math.round(v * 100)}%`;
    onInput(v);
  });
  row.append(head, slider);
  return { row, slider, valueEl };
}

const GORE_LEVELS: readonly { readonly id: GoreLevel; readonly label: string }[] = [
  { id: "full", label: "Full" },
  { id: "reduced", label: "Reduced" },
  { id: "off", label: "Off" },
];

function makeGoreRow(onChange?: (level: GoreLevel) => void): HTMLDivElement {
  const row = makeEl("div", "ow-audio-row");
  const head = makeEl("div", "ow-audio-row-head");
  const title = makeEl("span", "");
  title.textContent = "Gore";
  head.append(title);
  const pills = makeEl("div", "ow-presets");
  let active = loadGoreLevel();
  const buttons = GORE_LEVELS.map((entry) => {
    const btn = makeEl("button", "ow-pill");
    btn.type = "button";
    btn.textContent = entry.label;
    btn.dataset.active = String(entry.id === active);
    btn.addEventListener("click", () => {
      active = entry.id;
      saveGoreLevel(entry.id);
      onChange?.(entry.id);
      for (let i = 0; i < buttons.length; i++) buttons[i]!.dataset.active = String(GORE_LEVELS[i]!.id === active);
    });
    pills.append(btn);
    return btn;
  });
  row.append(head, pills);
  return row;
}

export class AudioPopover {
  readonly el: HTMLDivElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly musicSlider: HTMLInputElement;
  private readonly musicVal: HTMLSpanElement;
  private readonly sfxSlider: HTMLInputElement;
  private readonly sfxVal: HTMLSpanElement;
  private open = false;

  constructor(host: HTMLElement, private readonly audio: AudioEngine, opts?: { readonly onSetGoreLevel?: (level: GoreLevel) => void }) {
    const prefs = audio.getPrefs();
    this.el = makeEl("div", "ow-audio-popover");
    this.el.hidden = true;

    const head = makeEl("div", "ow-audio-head");
    const title = makeEl("span", "");
    title.textContent = "Audio";
    this.muteBtn = makeEl("button", "ow-pill");
    this.muteBtn.type = "button";
    this.muteBtn.addEventListener("click", () => this.toggleMute());
    head.append(title, this.muteBtn);

    const music = makeVolumeRow("Music", prefs.music, (v) => this.updatePrefs({ music: v }));
    const sfx = makeVolumeRow("SFX", prefs.sfx, (v) => this.updatePrefs({ sfx: v }));
    this.musicSlider = music.slider;
    this.musicVal = music.valueEl;
    this.sfxSlider = sfx.slider;
    this.sfxVal = sfx.valueEl;

    this.el.append(head, music.row, sfx.row, makeGoreRow(opts?.onSetGoreLevel));
    host.append(this.el);
    this.syncUi(prefs);
    window.addEventListener("pointerdown", (e) => {
      if (!this.open) return;
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".ow-audio-popover, .ow-audio-btn")) this.setOpen(false);
    });
  }

  isOpen(): boolean { return this.open; }
  isMuted(): boolean { return this.audio.getPrefs().muted; }
  toggle(): void { this.setOpen(!this.open); }

  setOpen(next: boolean): void {
    this.open = next;
    this.el.hidden = !next;
    if (next) this.syncUi(this.audio.getPrefs());
  }

  private toggleMute(): void {
    const cur = this.audio.getPrefs();
    this.updatePrefs({ muted: !cur.muted });
  }

  private updatePrefs(patch: Partial<AudioPrefs>): void {
    const next = { ...this.audio.getPrefs(), ...patch };
    this.audio.setPrefs(next);
    this.syncUi(next);
  }

  private syncUi(prefs: AudioPrefs): void {
    this.muteBtn.dataset.active = String(prefs.muted);
    this.muteBtn.textContent = prefs.muted ? "Muted" : "Mute All";
    this.musicSlider.value = prefs.music.toFixed(2);
    this.musicVal.textContent = `${Math.round(prefs.music * 100)}%`;
    this.sfxSlider.value = prefs.sfx.toFixed(2);
    this.sfxVal.textContent = `${Math.round(prefs.sfx * 100)}%`;
  }
}
