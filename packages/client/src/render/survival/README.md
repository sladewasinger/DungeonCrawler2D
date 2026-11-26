# Client Survival Textures & Harvest/Build VFX (`packages/client/src/render/survival/`)

Visuals for highland ore veins, craftable camp props, and gathering/building feedback:

- **`campPropTextures.ts`**: `48 px/tile` (`1/3` world scale) outlined HD-pixel sprites for `CopperVein`, `IronVein`, `Workbench`, `Bed`, `WoodChest` (`closed`/`open`), `Palisade` (+ orthogonal neighbor rails), and stripped `Bush`.
- **`harvestFxLayer.ts` & `propHitVisuals.ts`**: Bouncy physics-driven particle chips, `0.18s` hit wobble + flash, decaying `24×4px` micro HP bar + `<=50%` crack overlay, `0.35s` tree tip-over animations, `"Requires Pickaxe!"` + 5s-throttled tool hints, and structure build/dismantle VFX.
- **`placementGhostLayer.ts`**: `0.5`-tile snapped emerald/crimson structure ghost with dashed craft/light aura rings, `[R]` rotation `0..3`, and rejection badges.
