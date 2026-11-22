# Hybrid Web Audio Engine (`packages/client/src/audio/`)

Mobile-unlocked Web Audio mixer supporting zero-latency procedural synthesis out of the box plus drop-in `.ogg`/`.wav` asset overrides:

- **`audioEngine.ts`**: Lazy `AudioContext` gesture unlock (desktop + iOS/Android Safari), stereo-panned world event dispatch (`swing`, `hit` by `GoreSubstance`, `block`, `parry`, `arrowFire`, `dodge`, `heal`, `respawn`), terrain footstep sync, and `Master` / `Music` / `SFX` buses.
- **`ambienceBed.ts`**: Day/Night wind filter sweep, Dawn/Day birds ↔ Dusk/Night crickets, distance-attenuated spatial campfire crackle & river flow, subtle reactive combat-tension pulse, and optional decoded `AudioBuffer` registration via `preloadSample`.
- **`synthSfx.ts`**: Pure Web Audio API synthesis with shared noise/oscillator envelope helpers.
- **`audioTuning.ts`**: Single editable config object (`AUDIO_TUNING`) holding wind, campfire rumble/crackle/pop, river, biosphere, footstep (`masterGain`, `pitchScale`, `crunchMix`, `stepIntervalSec`), and combat gains/frequencies.
- **`audioPrefs.ts`**: Persistent volume/mute settings saved in `localStorage`.
