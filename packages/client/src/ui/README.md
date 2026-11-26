# Client UI Shell (`packages/client/src/ui`)

Responsive desktop/mobile HTML overlay shell layered above the PixiJS WebGL2 canvas:

- `atmosphereToolbar.ts` & `toolbarStyles.ts`: Top toolbar buttons (`Bag`, debug `FX`/Atmosphere/Spawn drawer, zoom pills, `CompassBadge`).
- `fpsCounter.ts` & `fullscreen.ts`: Toggleable frame-rate telemetry and mobile auto-fullscreen prompt helpers.
- **Subfolders**: [`hud/`](./hud/README.md), [`settings/`](./settings/README.md), `icons/` (`32×32` procedural item icons), [`chat/`](./chat/README.md), [`discovery/`](./discovery/README.md), [`map/`](./map/README.md) (`minimapOverlay.ts`), `overlays/` (`combatFeedbackOverlay.ts`, `connectionOverlay.ts`), [`loading/`](./loading/README.md), and [`title/`](./title/README.md).
