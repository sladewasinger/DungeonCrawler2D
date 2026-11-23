# Title Screen & Character Entry (`packages/client/src/ui/title/`)

Pre-game entry overlay displayed over the live animated Verdant Overworld scene:

- **`titleScreen.ts`**: Centered hero creation card with Hero Name input (`localStorage`-persisted), live pixelated 4-directional Hero portrait, Body/Skin/Eyes/Hair/Hair Color pickers, prominent `Enter World` action, and a localhost-only `Sound Studio` link (`isLocalhostOrigin()`).
- **`titleStyles.ts`**: Dark-gold glassmorphic styling matching the overworld HUD palette and `[data-title-open="true"]` gameplay HUD suppression rules.
