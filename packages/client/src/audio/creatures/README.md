# Creature & Enemy Audio (`packages/client/src/audio/creatures/`)

Procedural multi-layer Web Audio voices for all 9 wildlife and POI guard archetypes across `alert`, `attack`, `charge`, `hurt`, and `death` vocal cues:

- **`creatureVoiceTypes.ts`**: Shared `CREATURE_VOICE_KINDS`, `CREATURE_VOCAL_KINDS`, `VoiceLayer` types, oscillator/filter/noise constants, and layer factory builders.
- **`creatureVoiceSpecs.ts`**: Wild beast voice profiles (`bear`, `boar`, `wolf`, `spider`, `slime`) including bear swipes/roars, boar charge squeal + hoofbeats, wolf pack calls, spider hiss/skitter clicks, and slime squelches.
- **`creaturePoiVoiceSpecs.ts`**: POI guard voice profiles (`goblin`, `orc`, `skeleton`, `golem`) covering goblin cackles, orc war-barks, skeleton bone rattles/collapses, and golem granite grinds/crumble.
- **`synthCreatureSfx.ts`**: `isWildlifeVoiceKind`, `getCreatureVoiceSpec`, and `synthCreatureVocal` with per-trigger pitch/gain variation and optional `creature:${kind}:${vocal}` sample overrides.
