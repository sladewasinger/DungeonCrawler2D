# Bespoke HD-Pixel Gore & Impact VFX (`render/combat/gore/`)

Data-driven, substance-grounded combat impact and surface decal pipeline:

- **`gorePatterns.ts`**: Pure pattern planner pairing `GoreStyle` × `GoreSubstance`:
  - `blood` / `ichor`: single curved sword-slice `arc` mirrored by `sweepDir` (`±1`) + a few accent drops/streaks, heavy `chunk-spray` finisher, arrow exit streak, single-drop passive bleeds, and expanding kill pools.
  - `slime`: thick glossy rounded `goop` globs with heavy gravity and squishy bounce on hit; expanding glossy bubble `goopPuddle` on kill.
  - `bone` (skeletons): crisp small spinning bone chips on hit (zero blood splatters) and a pixel-art `bonePile` on death.
  - `stone` (golems): ephemeral bouncing stone pebbles + emissive metallic `spark` bursts (`sparkLayer`) on hit, and a pixel-art `rubblePile` + stone chunks on death.
  - `straw`: fluttering low-gravity straw wisps.
- **`goreArtMasks.ts` & `goreTextures.ts`**: Rasterizes the original hand-crafted organic shapes (`SPLATTER_MASKS`, `ARC_MASKS`, `STREAK_MASKS`, `GOOP_BLOB_MASKS`, `GOOP_PUDDLE_MASKS`, `POOL_MASKS`, `WATER_PLUME_MASKS`, `FOOTPRINT_MASKS`, `DROPLET_MASK`) through a 4× supersampled Gaussian contour filter (`scaleMode: "linear"`) for silky asymmetrical liquid silhouettes without jagged staircases, paired with crisp nearest-neighbor solid pixel masks (`chunks`, `bonePile`, `rubblePile`, `spark`).
- **`goreDecals.ts` & `goreDecalHelpers.ts`**: Manages elevated plateau decals (`ysortCam` z-sorted above cliff strips), natural wet-to-dried RGB color darkening over `14s`, drifting translucent ink plumes in water, growing puddles, death piles, wet footprint trails, and Quality Preset / gore-level decal caps.
- **`goreSystem.ts` & `gorePrefs.ts`**: Steps 2.5D flight/flutter/bounce/ephemeral fade physics, gates passive bleed drips & bloody footprints to `Full` mode only, emits emissive sparks onto `sparkLayer`, and persists the `Full / Reduced / Off` user preference.
