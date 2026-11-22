/** Entry script for standalone local multi-track Sound Studio (/sound-studio.html). */
import {
  StudioPresetBar, buildStudioTopBar, buildStudioTrackToolbar, buildStudioVisualizers, cloneStudioTracks, makeStudioBtn,
} from "./studioPresetBar.js";
import { STUDIO_PRESETS } from "./studioPresets.js";
import {
  loadSavedPresets, mergePresetLibrary, persistSavedPresets, removeSavedPreset,
  tracksFingerprint, upsertSavedPreset, type LibraryPreset,
} from "./studioStorage.js";
import { ensureStudioStyles } from "./studioStyles.js";
import { StudioSynthEngine, activeStudioTracks, totalTracksDurationSec } from "./studioSynth.js";
import { StudioTimeline } from "./studioTimeline.js";
import { createDefaultTrack, type SoundTrackSpec, type TrackKind } from "./studioTypes.js";
import { StudioVisualizer } from "./studioVisualizer.js";
import { renderTrackCard, syncTrackCardTimingField } from "./trackRowUi.js";

class SoundStudioApp {
  private readonly synth = new StudioSynthEngine();
  private readonly viz: StudioVisualizer;
  private readonly timeline: StudioTimeline;
  private readonly presetBar: StudioPresetBar;
  private readonly tracksHost = document.createElement("div");
  private readonly descEl = document.createElement("div");
  private readonly timelineReadout = document.createElement("span");
  private readonly statusEl = document.createElement("div");
  private readonly loopBtn: HTMLButtonElement;
  private savedPresets = loadSavedPresets();
  private library: LibraryPreset[] = mergePresetLibrary(STUDIO_PRESETS, this.savedPresets);
  private presetId = this.library[0]!.id;
  private presetName = this.library[0]!.name;
  private tracks: SoundTrackSpec[] = cloneStudioTracks(this.library[0]!.tracks);
  private savedFp = tracksFingerprint(this.tracks);
  private playheadSec = 0;
  private playing = false;
  private playOffsetSec = 0;
  private playStartMs = 0;
  private playDurMs = 0;
  private scrubUntilMs = 0;
  private lastScrubAtMs = 0;
  private looping = false;
  private loopTimer: number | null = null;
  private nextId = 1;

  constructor(host: HTMLElement) {
    ensureStudioStyles();
    const vizDom = buildStudioVisualizers(this.timelineReadout);
    this.viz = new StudioVisualizer(vizDom.wave, vizDom.spec);
    this.timeline = new StudioTimeline(vizDom.timeline, {
      onSeek: (sec, scrubbing) => this.handleSeek(sec, scrubbing),
      onTrackTiming: (id, patch) => this.handleTimelineDrag(id, patch),
      onDragEnd: () => this.presetBar.syncDirty(this.library, this.presetId, this.isDirty()),
    });
    this.presetBar = new StudioPresetBar({
      onSelect: (id) => { const hit = this.library.find((p) => p.id === id); if (hit) this.applyActivePreset(hit, true); },
      onSave: () => this.saveCurrentPreset(),
      onSaveAs: (name) => this.savePresetAs(name),
      onResetOrDelete: () => this.resetOrDeletePreset(),
    });
    this.loopBtn = makeStudioBtn("Loop: Off", () => this.toggleLoop());
    this.tracksHost.className = "st-tracks";
    this.descEl.className = "st-sub";
    this.statusEl.className = "st-status";
    this.mountShell(host, vizDom.row1, vizDom.row2);
    this.applyActivePreset(this.library[0]!, false);
    this.bindKeys();
    this.startVisualizerLoop();
  }

  private mountShell(host: HTMLElement, row1: HTMLElement, row2: HTMLElement): void {
    const shell = document.createElement("div");
    shell.className = "st-shell";
    const topBar = buildStudioTopBar({
      loopBtn: this.loopBtn,
      onJumpStart: () => { this.playing = false; this.playheadSec = 0; },
      onPlay: () => this.triggerPlayFromPlayhead(),
    });
    const trackToolbar = buildStudioTrackToolbar({
      onAddTrack: (kind) => this.addTrack(kind),
      onCopyJson: () => void this.copyPresetJson(),
      onExportWav: () => void this.downloadWav(),
    });
    shell.append(topBar, this.presetBar.el, this.descEl, row1, row2, trackToolbar, this.statusEl, this.tracksHost);
    host.append(shell);
  }

  private isDirty(): boolean {
    return tracksFingerprint(this.tracks) !== this.savedFp;
  }

  private applyActivePreset(preset: LibraryPreset, play: boolean): void {
    this.presetId = preset.id;
    this.presetName = preset.name;
    this.tracks = cloneStudioTracks(preset.tracks);
    this.savedFp = tracksFingerprint(this.tracks);
    this.playheadSec = 0;
    this.playing = false;
    this.descEl.textContent = preset.description;
    this.presetBar.refreshList(this.library, this.presetId, false);
    this.renderTracks();
    if (play) this.triggerPlayFromPlayhead();
  }

  private commitPresetStore(id: string, name: string, description: string): void {
    this.savedPresets = upsertSavedPreset(this.savedPresets, { id, name, description, tracks: cloneStudioTracks(this.tracks) });
    persistSavedPresets(this.savedPresets);
    this.library = mergePresetLibrary(STUDIO_PRESETS, this.savedPresets);
    this.presetId = id;
    this.presetName = name;
    this.savedFp = tracksFingerprint(this.tracks);
    this.presetBar.refreshList(this.library, id, false);
  }

  private saveCurrentPreset(): void {
    const cur = this.library.find((p) => p.id === this.presetId);
    this.commitPresetStore(this.presetId, this.presetName, cur?.description ?? "Custom saved preset.");
    this.statusEl.textContent = `Saved changes to "${this.presetName}" cleanly.`;
  }

  private savePresetAs(rawName: string): void {
    const name = rawName.trim() || `${this.presetName} Custom`;
    const id = `custom-${Date.now().toString(36)}`;
    this.commitPresetStore(id, name, `Custom preset based on ${this.presetName}.`);
    this.statusEl.textContent = `Saved new custom preset "${name}".`;
  }

  private resetOrDeletePreset(): void {
    const active = this.library.find((p) => p.id === this.presetId);
    if (active && (active.isCustom || active.isOverride)) {
      this.savedPresets = removeSavedPreset(this.savedPresets, active.id);
      persistSavedPresets(this.savedPresets);
      this.library = mergePresetLibrary(STUDIO_PRESETS, this.savedPresets);
      this.applyActivePreset(this.library.find((p) => p.id === active.id) ?? this.library[0]!, false);
      this.statusEl.textContent = active.isCustom ? `Deleted "${active.name}".` : `Restored "${active.name}" defaults.`;
      return;
    }
    if (active) this.applyActivePreset(active, false);
    this.statusEl.textContent = "Reverted unsaved edits.";
  }

  private addTrack(kind: TrackKind): void {
    this.tracks = [...this.tracks, createDefaultTrack(kind, this.nextId++)];
    this.presetBar.syncDirty(this.library, this.presetId, this.isDirty());
    this.renderTracks();
  }

  private handleSeek(sec: number, scrubbing: boolean): void {
    this.playing = false;
    this.playheadSec = sec;
    if (!scrubbing) return;
    const now = performance.now();
    if (now - this.lastScrubAtMs < 75) return;
    this.lastScrubAtMs = now;
    this.scrubUntilMs = now + 115;
    this.synth.playScrubSlice(this.tracks, sec);
  }

  private handleTimelineDrag(id: string, patch: { readonly delaySec?: number; readonly durationSec?: number }): void {
    this.tracks = this.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    if (patch.delaySec !== undefined) syncTrackCardTimingField(this.tracksHost, { id, field: "delaySec", valueSec: patch.delaySec });
    if (patch.durationSec !== undefined) syncTrackCardTimingField(this.tracksHost, { id, field: "durationSec", valueSec: patch.durationSec });
    this.presetBar.syncDirty(this.library, this.presetId, this.isDirty());
  }

  private triggerPlayFromPlayhead(): void {
    const total = totalTracksDurationSec(activeStudioTracks(this.tracks));
    if (this.playheadSec >= total - 0.02) this.playheadSec = 0;
    this.playDurMs = this.synth.playFrom(this.tracks, this.playheadSec) * 1000;
    this.playOffsetSec = this.playheadSec;
    this.playStartMs = performance.now();
    this.playing = true;
  }

  private toggleLoop(): void {
    this.looping = !this.looping;
    this.loopBtn.textContent = this.looping ? "Loop: On" : "Loop: Off";
    this.loopBtn.dataset.active = String(this.looping);
    if (this.loopTimer !== null) { window.clearInterval(this.loopTimer); this.loopTimer = null; }
    if (!this.looping) return;
    this.playheadSec = 0;
    this.triggerPlayFromPlayhead();
    this.loopTimer = window.setInterval(() => {
      if (!this.playing && performance.now() - this.playStartMs >= this.playDurMs + 220) {
        this.playheadSec = 0;
        this.triggerPlayFromPlayhead();
      }
    }, 100);
  }

  private async copyPresetJson(): Promise<void> {
    await navigator.clipboard?.writeText(JSON.stringify({ name: this.presetName, tracks: this.tracks }, null, 2)).catch(() => {});
    this.statusEl.textContent = "Copied preset JSON layers to clipboard.";
  }

  private async downloadWav(): Promise<void> {
    const blob = await this.synth.renderWavBlob(this.tracks);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.presetName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.wav`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.statusEl.textContent = "Exported mono 16-bit PCM .WAV render.";
  }

  private commitTrackList(next: SoundTrackSpec[], rerender = true): void {
    this.tracks = next;
    this.presetBar.syncDirty(this.library, this.presetId, this.isDirty());
    if (rerender) this.renderTracks();
  }

  private renderTracks(): void {
    this.tracksHost.replaceChildren();
    for (const track of this.tracks) {
      this.tracksHost.append(renderTrackCard(track, {
        onPatch: (id, patch) => this.commitTrackList(this.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)), patch.kind !== undefined),
        onToggle: (id, field) => this.commitTrackList(this.tracks.map((t) => (t.id === id ? { ...t, [field]: !t[field] } : t))),
        onClone: (id) => {
          const src = this.tracks.find((t) => t.id === id);
          if (src) this.commitTrackList([...this.tracks, { ...src, id: `trk-c-${this.nextId++}`, name: `${src.name} Copy` }]);
        },
        onDelete: (id) => {
          if (this.tracks.length > 1) this.commitTrackList(this.tracks.filter((t) => t.id !== id));
        },
      }));
    }
  }

  private bindKeys(): void {
    window.addEventListener("keydown", (e) => {
      const el = e.target as HTMLElement | null;
      const typingText = el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== "range");
      if (e.code === "Space" && !typingText) { e.preventDefault(); this.triggerPlayFromPlayhead(); }
    });
  }

  private startVisualizerLoop(): void {
    const { timeBuf, freqBuf } = this.viz.buffers();
    const tick = (): void => {
      const now = performance.now();
      const total = totalTracksDurationSec(this.tracks);
      if (this.playing) {
        const elapsed = now - this.playStartMs;
        if (elapsed >= this.playDurMs) { this.playing = false; this.playheadSec = total; }
        else this.playheadSec = Math.min(total, this.playOffsetSec + elapsed / 1000);
      }
      const sampleRate = this.synth.sampleAnalyser(timeBuf, freqBuf);
      this.viz.drawLive({ sampleRate, hasSignal: sampleRate > 0 && (this.playing || now < this.scrubUntilMs) });
      this.timeline.draw(this.tracks, this.playheadSec);
      this.timelineReadout.textContent = `Playhead: ${Math.round(this.playheadSec * 1000)}ms / ${Math.round(total * 1000)}ms`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

const host = document.getElementById("studio-app");
if (host) new SoundStudioApp(host);
