# Local Procedural Sound Studio (`packages/client/src/soundStudio/`)

Standalone localhost-friendly multi-track Web Audio synthesizer, preset explorer, visualizer, and exporter:

- **`studioTypes.ts`**: Pure `TrackKind` (`noise`, `sweptNoise`, `tone`), `SoundTrackSpec`, and `SoundPreset` definitions.
- **`studioPresets.ts`**: Editable multi-track presets mirroring the overworld game SFX (`Water Step Splash`, `Water Jump Plunge`, `Heavy Dirt Landing`, `Campfire Crackle & Pop`, `Iron Sword Slash`, `Shield Parry Ring`, `Treasure Chest Open`, `Dawn Songbird Phrase`).
- **`studioSynth.ts`**: Shared live Web Audio + `OfflineAudioContext` `.WAV` renderer with solo/mute track routing and `AnalyserNode` tap.
- **`studioVisualizer.ts`**: Real-time Oscilloscope Waveform, FFT Frequency Spectrum, and Multi-Track Timeline canvas renderers.
- **`trackRowUi.ts` & `studioMain.ts`**: Interactive multi-track DAW rack UI and transport mounted cleanly at `/sound-studio.html`.
