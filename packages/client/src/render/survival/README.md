# Client Survival Textures & Harvest/Build VFX (`packages/client/src/render/survival/`)

Visuals for highland ore veins, craftable camp props, and gathering/building feedback:

- **`campPropTextures.ts`**: `48 px/tile` (`1/3` world scale) outlined HD-pixel sprites for `CopperVein`, `IronVein`, `Workbench`, `Bed`, and `WoodChest` merged into `PropTextureSet`.
- **`harvestFxLayer.ts`**: Bouncy physics-driven particle chips colored by resource node (`wood` bark/leaves, `stone` slate, `copper` amber, `iron` steel, `forage` berries/herbs) plus expanding placement dust and emerald `RESPAWN SET` rings.
