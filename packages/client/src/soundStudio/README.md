# Local Procedural Sound Studio (`packages/client/src/soundStudio/`)

Standalone localhost-friendly multi-track Web Audio synthesizer, preset manager, visualizer, and exporter:

- **`studioTypes.ts` & `studioPresets.ts`**: Track/preset models and 8 built-in presets mirroring the game's procedural layers (`Water Step Splash`, `Water Jump Plunge`, `Heavy Dirt Landing`, `Campfire Crackle & Pop`, `Iron Sword Slash`, `Shield Parry Ring`, `Treasure Chest Open`, `Dawn Songbird Phrase`).
- **`studioStorage.ts`**: `localStorage` persistence for custom `Save As` presets and built-in overrides plus canonical dirty (`*`) track fingerprinting.
- **`studioSynth.ts`**: Offset playhead playback (`playFrom`), live scrub preview (`playScrubSlice`), float `AnalyserNode` tapping, and `OfflineAudioContext` `.WAV` export.
- **`studioVisualizer.ts` & `studioTimeline.ts`**: Row 1 high-amplitude auto-gain Oscilloscope Waveform + Log-Scale FFT Spectrum; Row 2 full-width interactive Multi-Track Envelope Timeline with ms ticks, draggable track delay bars, resize grips, and scrubbing golden playhead.
- **`trackRowUi.ts`, `studioPresetBar.ts` & `studioMain.ts`**: Patch-only multi-track DAW rack UI, preset bar (`Save` / `Save As` / `* Unsaved`), and DAW controller mounted at `/sound-studio.html`.
