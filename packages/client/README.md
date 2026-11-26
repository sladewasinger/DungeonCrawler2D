# `@dc2d/client`

Mobile-first PixiJS v8 WebGL2 client:
- Procedural HD-pixel terrain/prop textures & tangent-space normal maps (`src/render/textures/`)
- Custom WebGL2 GLSL shaders for water, wind, lighting, bloom, god-rays, mist & color grading (`src/render/shaders/`)
- Chunked world renderer with Y-sorting and canopy fade (`src/render/world/`)
- Touch joystick + strict dynamic touch/desktop aim switching for hybrid touchscreen laptops, multi-touch hotbar/torch/map interaction while moving (`M` permanent Overworld Map slot + enlarged map overlay), world tap-to-interact (without swipe-to-roll), throttled input sync, auto-reconnect lifecycle (`ConnectionStatusOverlay`), auto-appearing mobile `Fullscreen` toolbar prompt (`src/ui/fullscreen.ts`, `src/ui/atmosphereToolbar.ts`), and HUD (`src/input/`, `src/net/`, `src/ui/`)
