# Title Screen & Character Entry (`packages/client/src/ui/title/`)

Pre-game entry overlay displayed over the live animated Verdant Overworld scene:

- **`titleScreen.ts`**: Centered hero creation card shown after the startup loading overlay finishes, with Hero Name input (`localStorage`-persisted), instant `192×192` Hero portrait preview (`getCharacterPortraitUrl` without rebaking full directional sheets per click), Body/Skin/Eyes/Hair/Hair Color pickers that persist via `saveCharacterPrefs` until `Enter World` commits to `WorldClient`, and localhost-only Sandbox / Sound Studio links (`isLocalhostOrigin()`).
- **`titleStyles.ts`**: Dark-gold glassmorphic styling matching the overworld HUD palette and `[data-title-open="true"]` gameplay HUD suppression rules.
