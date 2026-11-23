# Bespoke HD-Pixel Gore & Impact VFX (`render/combat/gore/`)

Data-driven, substance-grounded combat impact and surface decal pipeline:

- **`gorePatterns.ts`**: Pure pattern planner pairing `GoreStyle` × `GoreSubstance`:
  - `blood` / `ichor`: single curved sword-slice `arc` mirrored by `sweepDir` (`±1`) + a few accent drops/streaks, heavy `chunk-spray` finisher, arrow exit streak, single-drop passive bleeds, and expanding kill pools.
  - `slime`: thick glossy rounded `goop` globs with heavy gravity and squishy bounce on hit; expanding glossy bubble `goopPuddle` on kill.
  - `bone` (skeletons): crisp small spinning bone chips on hit (zero blood splatters) and a pixel-art `bonePile` on death.
  - `stone` (golems): ephemeral bouncing stone pebbles + emissive metallic `spark` bursts (`sparkLayer`) on hit, and a pixel-art `rubblePile` + stone chunks on death.
  - `straw`: fluttering low-gravity straw wisps.
- **`goreArtMasks.ts` & `goreTextures.ts`**: Monochrome luminance pixel-art masks compiled to cached nearest-neighbor `Texture` sprites (`arcs`, `splatters`, `streaks`, `goopBlobs`, `goopPuddles`, `pools`, `chunks`, `bonePile`, `rubblePile`, diffuse alpha-feathered `waterPlumes`, `footprints`, `droplet`, `spark`).
- **`goreDecals.ts` & `goreDecalHelpers.ts`**: Manages elevated plateau decals (`ysortCam` z-sorted above cliff strips), natural wet-to-dried RGB color darkening over `14s`, drifting translucent ink plumes in water, growing puddles, death piles, wet footprint trails, and Quality Preset decal caps.
- **`goreSystem.ts` & `gorePrefs.ts`**: Steps 2.5D flight/flutter/bounce/ephemeral fade physics, emits emissive sparks onto `sparkLayer`, and persists the `Full / Reduced / Off` user preference.
