# `@dc2d/client`

Tier-4 mobile-first PixiJS v8 WebGL2 client built over `@dc2d/contracts`, `@dc2d/content`, and `@dc2d/engine`:

## Architecture & Directories
| Directory | Covers |
| --- | --- |
| [`src/render/`](./src/render/README.md) | PixiJS v8 WebGL2 textures, shaders, 3D player rig, combat/gore VFX, pose tuning, and world scene |
| [`src/input/`](./src/input/README.md) | Desktop keyboard/mouse, floating mobile joystick, 2-row touch combat cluster, and auto-aim |
| [`src/net/`](./src/net/README.md) | WebSocket reconnect client, offline preview fallback, movement/swing prediction, and `PendingGate` |
| [`src/ui/`](./src/ui/README.md) | HUD shell, toolbar, Settings, ItemCard, Proximity Chat, Discovery banners, Overworld Map, Title Screen |
| [`src/audio/`](./src/audio/README.md) | Mobile-unlocked Hybrid Web Audio mixer, spatial campfire/river/footsteps, and vocal-tract growl synth |
| [`src/soundStudio/`](./src/soundStudio/README.md) | Localhost multi-track DAW synthesizer, oscilloscope/FFT visualizer, and `.WAV` exporter (`/sound-studio.html`) |
| [`src/sandbox/`](./src/sandbox/README.md) | Localhost `96×32` visual asset gallery & interactive biome diorama (`/?sandbox=1`) |
| [`src/admin/`](./src/admin/README.md) | Gated `window.admin` DevTools console helpers and server auth bridge |
| `src/diag/` | QA telemetry hook (`window.__dc2dDiag`, gated to dev / `?qaDiag=1`) |
