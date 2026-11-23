# Creature & Enemy Audio (`packages/client/src/audio/creatures/`)

Procedural multi-layer Web Audio voices for all 9 wildlife and POI guard archetypes across `alert`, `attack`, `charge`, `hurt`, and `death` vocal cues:

- **`vocalSynth.ts`**: Organic animal vocal-tract Web Audio synthesizer (`scheduleVocalTrack`) combining glottal FM/AM flutter, breath noise, soft `tanh` throat overdrive, and dual parallel formant bandpass resonators + ceiling lowpass (`lowpass` deep chest, `bandpass` nasal snout/snarl, `highpass` screech).
- **`creatureVoiceTypes.ts`**: Shared `CREATURE_VOICE_KINDS`, `CREATURE_VOCAL_KINDS`, `VoiceLayer` types (`tone`, `sweep`, `burst`, `vocal`), oscillator/filter/noise constants, and layer factory builders.
- **`creatureVoiceSpecs.ts`**: Wild beast voice profiles (`bear`, `boar`, `wolf`, `spider`, `slime`) using organic vocal-tract growls/snorts/howls paired with hoofbeats, claw swipes, chitin clicks, and wet slime bloops.
- **`creaturePoiVoiceSpecs.ts`**: POI guard voice profiles (`goblin`, `orc`, `skeleton`, `golem`) covering goblin raspy cackles, orc war-barks, skeleton bone rattles/collapses, and golem granite grinds/crumble.
- **`synthCreatureSfx.ts`**: `isWildlifeVoiceKind`, `getCreatureVoiceSpec`, and `synthCreatureVocal` checking sample overrides, then live Sound Studio `localStorage` overrides (`creature-${kind}-${vocal}`), before synthesizing built-in layers with pitch/gain variance.
