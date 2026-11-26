# Client Settings & Camera Zoom (`packages/client/src/ui/settings`)

Persistent client video, audio, zoom, and accessibility preferences modal:

- `settingsMenu.ts` & `settingsControls.ts`: Settings drawer (`Esc` / top-right gear) wiring Hero/Respawn/Title actions, quality preset selector, gore level, FPS/Ping toggles, hitbox debug, mobile auto-aim, crouch mode (`Toggle`/`Hold`), and audio volume sliders.
- `settingsPrefs.ts`: `localStorage`-persisted client preference loader/saver and localhost origin detection (`isLocalDebugOrigin`).
- `cameraZoom.ts`: Integer-friendly zoom stops (`ZOOM_STOPS`), `BASE_CAMERA_ZOOM`, and smooth zoom clamping.
- `settingsStyles.ts`: Scoped CSS styles injected for the Settings modal.
