# @dc2d/content — Props Registry

Declarative, compile-time-exhaustive `PROP_SPECS` registry (`satisfies Record<PropKind, PropSpec>`) co-locating collision shapes, LOS blocking, foliage occlusion, stealth lighting/cover, combat arrow surfaces, spider web anchors, interaction kinds, and harvest tables.

## Modules
- [propSpecsFlora.ts](./propSpecsFlora.ts) — Trees, foliage, boulders, crystals, and mineral veins.
- [propSpecsStructures.ts](./propSpecsStructures.ts) — Camp structures, lighting, ruins, shrines, and POI landmarks.
- [propSpecs.ts](./propSpecs.ts) — Unified `PROP_SPECS` map and `getPropSpec()` accessor.
