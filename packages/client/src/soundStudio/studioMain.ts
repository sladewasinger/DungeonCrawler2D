/** Entry script for standalone full-screen DAW Sound Studio (/sound-studio.html). */
import { buildImportDrawer, formatGameCodeSnippet, parseImportedPresetJson, triggerWavDownload } from "./io/studioCodeExport.js";
import {
  StudioPresetBar, bindStudioSpacebar, buildInspectorHeader, buildStudioTopBar,
  buildStudioTrackToolbar, buildStudioVizRow, cloneStudioTracks, makeStudioBtn,
} from "./studioPresetBar.js";
import { STUDIO_PRESETS } from "./studioPresets.js";
import { loadSavedPresets, mergePresetLibrary, resetOrDeleteEntry, savePresetEntry, tracksFingerprint, type LibraryPreset } from "./studioStorage.js";
import { ensureStudioStyles } from "./studioStyles.js";
import { StudioSynthEngine, StudioTransport } from "./studioSynth.js";
import { reorderTracks, trimLeadingSilence } from "./timeline/timelineMath.js";
import { TimelinePanel } from "./timeline/timelinePanel.js";
import { StudioVisualizer } from "./studioVisualizer.js";
import { createDefaultTrack, type SoundTrackSpec, type TrackKind } from "./studioTypes.js";
import { renderTrackInspectorList, syncAllTrackTimings, syncTrackCardTimingField } from "./trackRowUi.js";

class SoundStudioApp {
  private readonly synth = new StudioSynthEngine();
  private readonly transport = new StudioTransport(this.synth, () => this.tracks);
  private readonly viz: StudioVisualizer;
  private readonly timelinePanel: TimelinePanel;
  private readonly presetBar: StudioPresetBar;
  private readonly importDrawer = buildImportDrawer((raw) => this.handleImportJson(raw));
  private readonly tracksHost = document.createElement("div");
  private readonly inspectorTitle = document.createElement("span");
  private readonly descEl = document.createElement("div");
  private readonly statusEl = document.createElement("div");
  private readonly loopBtn = makeStudioBtn("Loop: Off", () => {
    const on = this.transport.toggleLoop();
    this.loopBtn.textContent = on ? "Loop: On" : "Loop: Off";
    this.loopBtn.dataset.active = String(on);
  });
  private readonly viewToggleBtn = makeStudioBtn("View: Selected Track", () => this.toggleInspectorView());
  private savedPresets = loadSavedPresets();
  private library: LibraryPreset[] = mergePresetLibrary(STUDIO_PRESETS, this.savedPresets);
  private presetId = this.library[0]!.id;
  private presetName = this.library[0]!.name;
  private tracks: SoundTrackSpec[] = cloneStudioTracks(this.library[0]!.tracks);
  private selectedTrackId = this.tracks[0]!.id;
  private showAllTracks = false;
  private savedFp = tracksFingerprint(this.tracks);
  private nextId = 1;

  constructor(host: HTMLElement) {
    ensureStudioStyles();
    const vizDom = buildStudioVizRow();
    this.viz = new StudioVisualizer(vizDom.wave, vizDom.spec);
    this.timelinePanel = this.createTimelinePanel();
    this.presetBar = new StudioPresetBar({
      onSelect: (id) => { const hit = this.library.find((p) => p.id === id); if (hit) this.applyActivePreset(hit, true); },
      onSave: () => this.saveCurrentPreset(this.presetId, this.presetName, `Saved changes to "${this.presetName}" cleanly.`),
      onSaveAs: (name) => this.saveCurrentPreset(`custom-${Date.now().toString(36)}`, name.trim() || `${this.presetName} Custom`, "Saved custom preset."),
      onResetOrDelete: () => this.resetOrDeletePreset(),
    });
    this.mountShell(host, vizDom.row1);
    this.applyActivePreset(this.library[0]!, false);
    bindStudioSpacebar(() => this.transport.playFromCue());
    this.startVisualizerLoop();
  }

  private createTimelinePanel(): TimelinePanel {
    return new TimelinePanel({
      onSelectTrack: (id) => { if (this.selectedTrackId !== id) { this.selectedTrackId = id; this.renderTracks(); } },
      onSeek: (sec, scrubbing) => this.transport.seek(sec, scrubbing),
      onReplaceTracks: (next) => this.commitTrackList(next, false, true),
      onTrackTiming: (id, patch) => this.commitTrackList(this.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)), false, true),
      onDragEnd: () => this.presetBar.syncDirty(this.library, this.presetId, this.isDirty()),
      onToggle: (id, field) => this.toggleTrackField(id, field),
      onMoveOrder: (id, delta) => this.commitTrackList(reorderTracks(this.tracks, id, delta), true),
      onQuickGain: (id, gain) => { this.commitTrackList(this.tracks.map((t) => (t.id === id ? { ...t, gain } : t)), false); syncTrackCardTimingField(this.tracksHost, { id, field: "gain", rawVal: gain }); },
      onCloneSelected: () => this.cloneTrack(this.selectedTrackId),
      onDeleteSelected: () => this.deleteTrack(this.selectedTrackId),
      onTrimStart: () => { this.commitTrackList(trimLeadingSilence(this.tracks), true); this.statusEl.textContent = "Trimmed leading silence to 0ms."; },
    });
  }

  private mountShell(host: HTMLElement, row1: HTMLElement): void {
    this.tracksHost.className = "st-tracks";
    this.descEl.className = "st-sub";
    this.statusEl.className = "st-status";
    const shell = document.createElement("div");
    shell.className = "st-shell";
    const topBar = buildStudioTopBar({
      loopBtn: this.loopBtn,
      onJumpStart: () => this.transport.resetCue(),
      onPlay: () => this.transport.playFromCue(),
      onStop: () => this.transport.stop(),
    });
    const trackToolbar = buildStudioTrackToolbar({
      onAddTrack: (kind) => this.addTrack(kind),
      onImportJson: () => this.importDrawer.open(),
      onCopyJson: () => void this.copyText(JSON.stringify({ name: this.presetName, tracks: this.tracks }, null, 2), "Copied preset JSON layers to clipboard."),
      onCopyGameCode: () => void this.copyText(formatGameCodeSnippet(this.presetName, this.tracks), "Copied proceduralSynth TypeScript snippet to clipboard."),
      onExportWav: () => void this.synth.renderWavBlob(this.tracks).then((blob) => { triggerWavDownload(this.presetName, blob); this.statusEl.textContent = "Exported stereo 16-bit PCM .WAV render."; }),
    });
    shell.append(topBar, this.presetBar.el, this.descEl, row1, this.timelinePanel.el, trackToolbar, this.importDrawer.el, this.statusEl, buildInspectorHeader({ titleEl: this.inspectorTitle, toggleBtn: this.viewToggleBtn }), this.tracksHost);
    host.append(shell);
  }

  private isDirty(): boolean {
    return tracksFingerprint(this.tracks) !== this.savedFp;
  }

  private toggleInspectorView(): void {
    this.showAllTracks = !this.showAllTracks;
    this.viewToggleBtn.textContent = this.showAllTracks ? "View: All Tracks" : "View: Selected Track";
    this.renderTracks();
  }

  private applyActivePreset(preset: LibraryPreset, play: boolean): void {
    this.transport.resetCue();
    this.presetId = preset.id;
    this.presetName = preset.name;
    this.tracks = cloneStudioTracks(preset.tracks);
    this.selectedTrackId = this.tracks[0]?.id ?? "";
    this.savedFp = tracksFingerprint(this.tracks);
    this.descEl.textContent = preset.description;
    this.presetBar.refreshList(this.library, this.presetId, false);
    this.renderTracks();
    if (play) this.transport.playFromCue();
  }

  private handleImportJson(raw: string): string | null {
    const parsed = parseImportedPresetJson(raw);
    if (!parsed.ok) return parsed.error;
    this.transport.resetCue();
    this.tracks = parsed.tracks;
    if (parsed.name) this.presetName = parsed.name;
    if (parsed.description) this.descEl.textContent = parsed.description;
    this.selectedTrackId = this.tracks[0]?.id ?? "";
    this.presetBar.syncDirty(this.library, this.presetId, this.isDirty());
    this.renderTracks();
    this.statusEl.textContent = `Imported ${this.tracks.length} track(s) cleanly — click Save As to store permanently.`;
    return null;
  }

  private saveCurrentPreset(id: string, name: string, notice: string): void {
    const cur = this.library.find((p) => p.id === this.presetId);
    const res = savePresetEntry({ saved: this.savedPresets, builtIns: STUDIO_PRESETS, entry: { id, name, description: cur?.description ?? "Custom preset.", tracks: cloneStudioTracks(this.tracks) } });
    this.savedPresets = res.saved;
    this.library = res.library;
    this.presetId = id;
    this.presetName = name;
    this.savedFp = tracksFingerprint(this.tracks);
    this.presetBar.refreshList(this.library, id, false);
    this.statusEl.textContent = notice;
  }

  private resetOrDeletePreset(): void {
    const active = this.library.find((p) => p.id === this.presetId);
    if (active && (active.isCustom || active.isOverride)) {
      const res = resetOrDeleteEntry({ saved: this.savedPresets, builtIns: STUDIO_PRESETS, activeId: active.id });
      this.savedPresets = res.saved;
      this.library = res.library;
      this.applyActivePreset(res.nextPreset, false);
      this.statusEl.textContent = active.isCustom ? `Deleted "${active.name}".` : `Restored "${active.name}" defaults.`;
      return;
    }
    if (active) this.applyActivePreset(active, false);
    this.statusEl.textContent = "Reverted unsaved edits.";
  }

  private addTrack(kind: TrackKind): void {
    const created = createDefaultTrack(kind, this.nextId++);
    this.selectedTrackId = created.id;
    this.commitTrackList([...this.tracks, created], true);
  }

  private cloneTrack(id: string): void {
    const src = this.tracks.find((t) => t.id === id);
    if (!src) return;
    const copy = { ...src, id: `trk-c-${this.nextId++}`, name: `${src.name} Copy` };
    this.selectedTrackId = copy.id;
    this.commitTrackList([...this.tracks, copy], true);
  }

  private deleteTrack(id: string): void {
    if (this.tracks.length > 1) this.commitTrackList(this.tracks.filter((t) => t.id !== id), true);
  }

  private toggleTrackField(id: string, field: "enabled" | "solo"): void {
    this.commitTrackList(this.tracks.map((t) => (t.id === id ? { ...t, [field]: !t[field] } : t)), true);
  }

  private async copyText(text: string, notice: string): Promise<void> {
    await navigator.clipboard?.writeText(text).catch(() => {});
    this.statusEl.textContent = notice;
  }

  private commitTrackList(next: SoundTrackSpec[], rerender: boolean, syncTimings = false): void {
    this.tracks = next;
    if (!this.tracks.some((t) => t.id === this.selectedTrackId)) this.selectedTrackId = this.tracks[0]?.id ?? "";
    this.presetBar.syncDirty(this.library, this.presetId, this.isDirty());
    if (syncTimings) syncAllTrackTimings(this.tracksHost, this.tracks);
    if (rerender) this.renderTracks();
  }

  private renderTracks(): void {
    const sel = this.tracks.find((t) => t.id === this.selectedTrackId) ?? this.tracks[0];
    this.selectedTrackId = sel?.id ?? "";
    this.inspectorTitle.textContent = this.showAllTracks
      ? `All Track Parameters (${this.tracks.length} layers)`
      : `Selected Track Inspector — ${sel?.name ?? ""}`;
    renderTrackInspectorList(this.tracksHost, {
      tracks: this.tracks, selectedId: this.selectedTrackId, showAll: this.showAllTracks,
      callbacks: {
        onPatch: (id, patch) => {
          this.commitTrackList(this.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)), patch.kind !== undefined);
          if (patch.name !== undefined && !this.showAllTracks) this.inspectorTitle.textContent = `Selected Track Inspector — ${patch.name}`;
        },
        onToggle: (id, field) => this.toggleTrackField(id, field),
        onClone: (id) => this.cloneTrack(id),
        onDelete: (id) => this.deleteTrack(id),
      },
    });
  }

  private startVisualizerLoop(): void {
    const { timeBuf, freqBuf } = this.viz.buffers();
    const tick = (): void => {
      const frame = this.transport.stepFrame(performance.now());
      const sampleRate = this.synth.sampleAnalyser(timeBuf, freqBuf);
      this.viz.drawLive({ sampleRate, hasSignal: sampleRate > 0 && frame.activeAudio });
      this.timelinePanel.sync({
        tracks: this.tracks, selectedId: this.selectedTrackId, cueSec: frame.cueSec, playheadSec: frame.playheadSec,
        readoutText: `Playhead: ${Math.round(frame.playheadSec * 1000)}ms · Cue: ${Math.round(frame.cueSec * 1000)}ms · Total: ${Math.round(frame.totalSec * 1000)}ms`,
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

const host = document.getElementById("studio-app");
if (host) new SoundStudioApp(host);
