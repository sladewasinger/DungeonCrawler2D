# 02 — Performance, Memory, GPU/VRAM, Audio & Asset Payload Audit

> **Audit Scope**: Client rendering (`packages/client/src/render/**`), WebGL2 shaders/textures/atlases, DOM HUD/UI (`packages/client/src/ui/**`), Web Audio synthesis (`packages/client/src/audio/**`), static public assets & Vite bundle (`packages/client/public/**`, `packages/client/vite.config.ts`, `tools/sprite-studio/**`, `.github/workflows/deploy-production.yml`), and shared engine / authoritative 20 Hz game-server simulation scaling (`packages/engine/src/**`, `packages/game-server/src/**`).
>
> **Scaling Horizon**: DungeonCrawler2D is currently **<10% feature-complete** (early overworld vertical slice). Phases 8–13+ will expand the game **10×** across items (`77 → 770+`, plus Phase 13 runtime System-AI-crafted items), creatures/bosses (`9 → 90+`), armor/cosmetic layers (`16 → 160+`), multi-floor dungeons, weather, NPCs, and concurrent multiplayer population (`1–10 → 50–100+` players, `60 → 600+` active entities).

---

## Executive Summary & Severity Matrix

| Severity | Count | Primary Bottleneck Themes |
| :--- | :---: | :--- |
| **Critical** | **6** | `40.06 MB` dead PNG packs in `public/`; `16 × 51.47 MB` (`823 MB`) uncompressed hero sheets preloaded at boot; main-thread hero compositor (`625` `getImageData` calls + `toDataURL` + `32`-entry cache thrashing); `WorldChunkCache` `96`-chunk cap thrashing + `67,272`-sample `findChunkPoi` stalls; `1.68M`-check A* linear obstacle scan; `O(C × N)` tick cloning + `O(C²)` action broadcast amplification |
| **High** | **11** | `4.74 MB` prod sourcemaps + `865 KB` main bundle; per-row `1024×52` cliff strip textures (`up to 1,600` GPU textures); unbatched `55+` procedural prop canvases; broken Low-quality shader bypass (`3` full-screen FBOs); unculled `ysortCam` + `17` DisplayObjects/entity; per-frame `getBoundingClientRect()` reflow; `1,000 Hz` `elementFromPoint` polling; `MinimapOverlay` `57,600`-tile redraw + `225`-chunk cache eviction; Web Audio `vocalSynth` node leaks + uncapped pack polyphony; permanent POI chest retention + global `worldDeltas` rebuild storm; `O(E²)` wildlife AI loops |
| **Medium** | **7** | Duplicate static + sheet creature WebPs; PixiJS v8 `TextStyle`/text cache leaks on view destroy; per-frame `Graphics.clear()` tessellation; `VitalsBar` 20 Hz SVG `innerHTML` reparsing + redundant 120 Hz FBM & DOM writes; 120 Hz `AudioParam.setTargetAtTime` timeline flooding; per-strand `cache.propsNear` in `WorldWebNetwork`; synchronous `JSON.stringify` world-save stalls |
| **Low** | **2** | `Array.shift()` `O(N)` compaction & double `client.snapshot()` per frame; redundant per-tick `cache.propsNear` in projectiles & `ScentTrail` |
| **Total** | **26** | **`PERF-01` through `PERF-26`** |

### Summary Index

| ID | Severity | Subsystem | Title | Current Cost | 10× Scale Impact |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `PERF-01` | Critical | Assets / CDN | `40.06 MB` unreferenced PNG packs, 29 orphaned files, pretty-printed JSON manifests, and `no-cache` S3 headers | `43.26 MB` deployed (`92.6%` dead); `369 KB` JSON (`70%` whitespace/dead sockets) revalidated every load | Multi-MB JSON manifests per reload; hundreds of MB S3/CloudFront sync & egress bloat |
| `PERF-02` | High | Build / Bundle | `sourcemap: true` (`4.74 MB` `.map`), `soundStudio` prod entry, and monolithic `864.9 KB` main JS bundle | `864.9 KB` blocking JS + `4.74 MB` sourcemaps shipped to prod S3 | `3–5 MB` main JS bundle stalling mobile parse/compile for seconds |
| `PERF-03` | Medium | Assets / VRAM | Animated creatures load and retain unused static `<kind>.webp` preview textures alongside `<kind>-sheet.webp` | `9` redundant textures + HTTP fetches at boot | `90+` wasted HTTP requests & tens of MB of dead GPU textures |
| `PERF-04` | Critical | Hero / RAM | Eager boot preload & retention of all `1152×11712` (`51.47 MB` RGBA each) hero layer bitmaps | `16` layers = up to `823.5 MB` uncompressed bitmap footprint | `160` layers = `~8.2 GB` decoded RGBA bitmaps — instant tab OOM crash |
| `PERF-05` | Critical | Hero / GPU | Synchronous main-thread hero compositor, per-slot `getImageData` armor recolor, eager `toDataURL`, & `32`-set LRU thrash | `50–180 ms` main-thread hitch per new outfit; up to `480–960 MB` RAM+VRAM at 32 sets | `>32` visible players evicts/destroys live on-screen textures every frame |
| `PERF-06` | High | World / VRAM | Per-row `1024×52` elevated cliff strip textures (`bakeElevatedChunkRows`) fragmenting VRAM & breaking batching | `30–64` `TextureSource`s/hilly chunk (`up to 680 MB` RAM+VRAM across 25 chunks) | Multi-elevation dungeons/biomes exceed `2,000+` `TextureSource`s & saturate draw calls |
| `PERF-07` | High | Textures / Boot | Synchronous startup Canvas2D baking (`55+` unbatched prop `TextureSource`s + `77` `toDataURL` item icons) | `~120–300 ms` boot stall; 55+ separate prop textures breaking sprite batching | `770+` items + `300+` props stall startup `>3 s` and explode draw calls |
| `PERF-08` | High | Shaders / GPU | Unconditional full-screen FBO passes (`waterHost`, `canopyHost`, `sceneRoot`), broken Low preset bypass, & heavy composite GLSL | `3` full-screen FBO passes every frame even on Low preset or dry land; `11–17` taps/px | Severe GPU fill-rate throttling on mobile/1440p/4K displays (`220M+` fragments/s) |
| `PERF-09` | High | Scene Graph | Global unculled `ysortCam` (`sortableChildren`) + `17` eager DisplayObjects per `EntityView` | `2,000–4,000` unculled children sorted/traversed per frame; `17` nodes per dry-land mob | `300` entities + `20` players = `5,100+` actor nodes & `15,000+` sorted children/frame |
| `PERF-10` | Medium | PixiJS Lifecycle | Missing `{ style: true, texture: true }` on `Text` destruction in `PlayerView`, `EntityView`, and `LootView` | Orphaned `TextStyle`s & `CanvasTextPipe` entries on every despawn/chat bubble | Thousands of leaked `TextStyle` objects & GPU text textures over long dungeon runs |
| `PERF-11` | Medium | Render / CPU | Per-frame `Graphics.clear()` re-tessellation on idle web overlays, AI indicators, projectiles, bow ray, & elite auras | Hundreds of redundant `Graphics.clear()` + stroke/fill tessellations at 120 Hz | Thousands of CPU geometry rebuilds per frame in swarm combat |
| `PERF-12` | Low | Render / GC | `Array.shift()` `O(N)` eviction in `GoreDecalManager`/`GoreSystem` & double `WorldClient.snapshot()` per frame | `800`-element array shifts on splatter overflow; `10+` transient arrays per 120 Hz tick | Continuous young-gen GC minor pauses (`1–3 ms`) during heavy AoE/swarm fights |
| `PERF-13` | High | DOM / Layout | Per-frame `canvas.getBoundingClientRect()` in `resolveMouseAim` & post-mutation `offsetHeight` in `ItemCardPopover` | Forced synchronous browser style + layout reflow at `60–120 Hz` | Deeper HUD DOM trees push synchronous reflows to `1–3 ms` every render frame |
| `PERF-14` | High | UI / Input | Global `pointermove` `document.elementFromPoint` hit-testing (`125–1,000 Hz`) & synchronous `HudRoot.sync` cascade | Up to `1,000` DOM hit-test flushes/sec while aiming mouse over canvas | Severe input-to-photon jitter with high-polling-rate mice & complex HUD overlays |
| `PERF-15` | Medium | UI / HUD | `VitalsBar` 20 Hz `<svg>` `innerHTML` reparsing, `3×` per-frame `sampleMacroBiome`, unfingerprinted HUD writes, & leaked `TitleScreen` timer | `60` SVG DOM nodes destroyed/reparsed/sec while sprinting; `15+` DOM writes/frame | Compounded main-thread style invalidation across status/party/quest HUD widgets |
| `PERF-16` | High | UI / Map | `MinimapOverlay` full `57,600`-tile re-rasterization per tile step & `225`-chunk `WorldChunkCache` overflow at `1×` zoom | `57,600` `tileAt` calls + `921 KB` alloc `5–8×/s` sprinting; `129+` chunk evictions at `1×` | `200–500 ms` main-thread freezes while walking with map open |
| `PERF-17` | High | Web Audio | `vocalSynth` (`14` nodes/layer) & `playSampleOverride` missing `onended` disconnect + uncapped polyphony + leaked `window` listeners | Permanent `2×` `WaveShaper` + `3` `BiquadFilter` leaks in Sound Studio; `300+` nodes in pack fights | `2,000+` simultaneous active DSP nodes in swarm fights → audio glitches & bus clipping |
| `PERF-18` | Medium | Web Audio | `AmbienceBed` scheduling `240–480` `AudioParam.setTargetAtTime` events/sec & running silent noise loops when muted/far | `~1.7M` automation events/hr queued on audio thread; 3 continuous filter loops | Progressive Web Audio render-thread CPU creep over multi-hour sessions |
| `PERF-19` | Critical | Engine / Worldgen | `WorldChunkCache.maxCachedChunks = 96` thrashing at `>10` players + `67,272`-sample worst-case `findChunkPoi` stalls | `100%` chunk cache thrash at `11+` spread players; `15–40 ms` spike per hilly POI chunk | Server 20 Hz tick collapses completely (`>200 ms/tick`) at `50–100` spread players |
| `PERF-20` | Critical | Engine / AI | `findTilePath` linear scan over `grid.props` (`500–1,400` obstacles × `1,200` cells = `~1.68M` checks/pathfind) | `2–8 ms` per pathfind in dense forest (`33M–90M` checks/s at 20 mobs) | `200+` chasing creatures exceed `50 ms` server tick budget on pathfinding alone |
| `PERF-21` | Critical | Server / Net | Global entity/chest cloning before AOI filter, unculled `players`, `JSON.stringify` inv check, & `O(C²)` action broadcasts | Clones all global chests/mobs every 50 ms; every hotbar tap broadcasts to all clients | `100` players × `5` actions/s = `50,000` snapshots/s (`>100 MB/s` outbound JSON CPU saturation) |
| `PERF-22` | High | Server / World | Permanent registration of untouched POI chests & full-world `worldDeltas` broadcast/remount on every resource chop/regrow | Every tree chop/regrow sends all world deltas to all clients & remounts all delta chunks | `1,100` untouched chests (`594k` slot clones/s) + multi-MB delta broadcasts on every chop |
| `PERF-23` | High | Server / AI | `O(E²)` entity pair scans (`scanAlliesAndCorpses`, `findBestEntityTarget`, `separation`, `cohesion`) + uncached POI guard cap | `5` full-list scans + `2` 9-chunk obstacle queries per entity every 50 ms | `600` entities = `1.8M` pair checks + thousands of LOS raycasts per 50 ms tick |
| `PERF-24` | Medium | Server / Webs | `WorldWebNetwork.hasHeatSourceNear` calling `cache.propsNear` (9 chunks) per web strand every tick + `prevPos` leak | Up to `192 × 9 = 1,728` chunk lookups (`~190k` prop checks) every 50 ms | Multi-spider lairs burn `3–6 ms/tick` scanning static props for campfires |
| `PERF-25` | Medium | Server / Save | Synchronous `buildFullWorldSaveSnapshot()` + `JSON.stringify` on main event loop + unbounded `savedProfiles` RAM | Clones & stringifies entire world/profile history synchronously inside `WorldSim.step` | `100–400 ms` global server tick freeze every `10 s` at `10,000` profiles / `5,000` chests |
| `PERF-26` | Low | Server / Sim | Linear `ecology.list` & `9`-chunk `propsNear` scans per projectile tick + duplicate campfire scan in `ScentTrail` | `9`-chunk `propsNear` per arrow flight step & per player tick | Bow volleys (`50+` arrows) + `100` players add `1,500+` redundant 9-chunk prop scans/tick |

---

## Detailed Findings & Remediation Blueprints

---

### 1. Static Assets, Build Pipeline & Network Payload Bloat

#### `PERF-01` · Critical — `40.06 MB` of Unreferenced Asset Packs, 29 Orphaned Public Files, Unminified Manifests, and `no-cache` S3 Asset Headers
- **Subsystem**: Client Static Assets / CI Deployment Pipeline
- **Locations**:
  - [packages/client/public/assets/packs/](file:///c:/repos/DungeonCrawler2D/packages/client/public/assets/packs) (`48` PNG files = **`40.06 MB`**)
  - [packages/client/public/assets/player/player-rig.json](file:///c:/repos/DungeonCrawler2D/packages/client/public/assets/player/player-rig.json#L1-L11057) (`244,085 B` raw; `88,015 B` minified; `37,292 B` minified / `~105 KB` pretty-printed dead `sockets` tree)
  - [packages/client/public/assets/sprite-manifest.json](file:///c:/repos/DungeonCrawler2D/packages/client/public/assets/sprite-manifest.json#L1-L6223) (`124,954 B` raw vs `21,195 B` minified — **`83.0%` whitespace**)
  - [packages/client/src/render/character/playerAssets.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/playerAssets.ts#L162-L166) (`fetch(RIG_META_URL, { cache: "no-cache" })`)
  - [.github/workflows/deploy-production.yml](file:///c:/repos/DungeonCrawler2D/.github/workflows/deploy-production.yml#L100-L112)
  - [tools/sprite-studio/bakePlayerAssets.mjs](file:///c:/repos/DungeonCrawler2D/tools/sprite-studio/bakePlayerAssets.mjs#L231-L232), [tools/sprite-studio/manifestSync.mjs](file:///c:/repos/DungeonCrawler2D/tools/sprite-studio/manifestSync.mjs)
- **Evidence & Quantified Impact**:
  - `packages/client/public/` totals **`43.26 MB` across `136` files**, all copied verbatim into `packages/client/dist/` by `vite build` and synced to `s3://$FRONTEND_BUCKET` on every push to `main`.
  - Zero runtime, tool, or script files reference `/assets/packs/**` (`coc`, `dragon-cave`, `dwarf-volcano-underground-fortress`, `goblin-cave`, `goblin-mechanical-workshop`, `haunted-amusement-park`, `medieval-sewer` = **`40.06 MB`**) or `26` legacy root/prop/terrain/pet/editor files (`atlas.png` `119.7 KB`, `atlas.json` `135.6 KB`, `shared-atlas.png` `60.3 KB`, `contact-sheet.png` `48.4 KB`, `.pxo` Pixelorama source files `61.4 KB`, `pets/*` `37.3 KB`, `animations.json` `14.2 KB`, `debug-atlas.png` `12.8 KB`, `creatures/gifs/*.gif` `10.8 KB`, `monogram.ttf` `10.2 KB`, etc. = **`~555 KB`**). **`93.9%` of deployed static bytes are completely unused.**
  - `player-rig.json` (`244.1 KB`) exports `sockets` (shoulder sockets for `sampleShoulderSockets` in `playerAssets.ts:249`, which has **zero callers** anywhere in the codebase) alongside `handSockets`, and is serialized with `JSON.stringify(rigMeta, null, 2)`. Stripping dead `sockets` and minifying shrinks `player-rig.json` from **`244.1 KB → 50.7 KB` (`-79.2%`)** and `sprite-manifest.json` from **`125.0 KB → 21.2 KB` (`-83.0%`)**.
  - `deploy-production.yml:104-105` uploads all `public/assets/**` with `--cache-control "no-cache"`, forcing conditional origin/edge revalidation on `30+` sprite/layer requests on every page reload even though `playerAssets.ts:110` already appends `?v=${rigBakeVersion}`!
  - **At 10× Scale**: `player-rig.json` + `sprite-manifest.json` with 2-space indentation grow to **`2.5–4.0 MB` of uncached JSON per page load**, and S3 sync + `/*` CloudFront invalidations waste minutes and gigabytes of CDN transfer.
- **Proposed Fix**:
  1. Move raw/reference art (`packs/**`, `.pxo` files, `gifs/`, legacy `atlas.*`) out of `packages/client/public/` into a git-ignored or non-shipped `assets/raw/` workspace directory (add a CI budget check failing if unreferenced files exist in `public/`).
  2. Remove dead `sockets` from `bakePlayerAssets.mjs:231` and write minified JSON (`JSON.stringify(rigMeta)`) in both `bakePlayerAssets.mjs:273` and `manifestSync.mjs`.
  3. Content-hash or version-stamp `sprite-manifest.json` entries (`?v=<sha256-8>`) and serve `/assets/*.webp` with `Cache-Control: public, max-age=31536000, immutable`, keeping `no-cache` only on `index.html`, `player-rig.json`, and `sprite-manifest.json`.

---

#### `PERF-02` · High — Production Build Ships `4.74 MB` of Source Maps, Dev `sound-studio.html` Entry, and Monolithic `864.9 KB` Main Bundle
- **Subsystem**: Client Build & Bundle Splitting (`Vite`)
- **Locations**:
  - [packages/client/vite.config.ts](file:///c:/repos/DungeonCrawler2D/packages/client/vite.config.ts#L104-L114)
  - [packages/client/src/main.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/main.ts#L4-L24)
- **Evidence & Quantified Impact**:
  - `vite.config.ts:107-112` hardcodes `sourcemap: true` and `rollupOptions.input.soundStudio`, shipping **`4,735.0 KB`** of `.js.map` files (including `main-*.js.map` at `3,161.7 KB`), `sound-studio.html`, and `soundStudio-*.js` (`51.4 KB`) to the public S3 bucket.
  - `main-*.js` is a single **`864.9 KB`** chunk loaded synchronously before the Title Screen (`index.html:151`), bundling PixiJS v8 + `@dc2d/engine` + `@dc2d/content` + `WorldScene` + `AudioEngine` + `HudRoot` + dev-only `adminConsole.ts` + `playerPoseTuning.json` all upfront before the user even enters their hero name.
  - **At 10× Scale**: Inline procedural icon/prop painters, 10× item/recipe/dialogue catalogs, and dungeon renderers will bloat `main.js` past **`3–5 MB`**, stalling mobile JS parse/compile for `2–4 s` before first interactive paint.
- **Proposed Fix**:
  - Gate sourcemaps and dev HTML entries by environment (`sourcemap: process.env.VITE_SOURCEMAP === "true"` and include `soundStudio` input only when `command === "serve"` or `process.env.INCLUDE_DEV_TOOLS === "1"`).
  - Split `pixi.js` into a vendor chunk (`manualChunks: { pixi: ["pixi.js"] }`), lazy-import `WorldScene` / `HudRoot` / `AudioEngine` while the lightweight HTML/CSS `TitleScreen` is interactive, and dynamically `import("./admin/adminConsole.js")` only when needed.

---

#### `PERF-03` · Medium — Animated Creatures Preload & Retain Unused Static `<kind>.webp` Textures Alongside `<kind>-sheet.webp`
- **Subsystem**: Sprite Manifest Loader / GPU VRAM
- **Locations**:
  - [packages/client/src/render/textures/spriteManifest.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/textures/spriteManifest.ts#L106-L117)
  - [packages/client/public/assets/sprite-manifest.json](file:///c:/repos/DungeonCrawler2D/packages/client/public/assets/sprite-manifest.json#L4-L18)
  - [packages/client/src/render/combat/entitySprites.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/entitySprites.ts#L59-L74)
- **Evidence & Quantified Impact**:
  - For every animated creature (`slime`, `wolf`, `boar`, `spider`, `bear`, `goblin`, `orc`, `skeleton`, `golem`), `loadManifestEntry` (`spriteManifest.ts:111-116`) loads `entry.path` (`/assets/creatures/<kind>.webp`) into a GPU `TextureSource` and *then* loads `entry.animations.sheetPath` (`/assets/creatures/<kind>-sheet.webp`).
  - Once `loadedAnimations` is present, `EntityView.syncAnimatedSprite` (`entitySprites.ts:165-171`) immediately overwrites `this.body.texture` with frame `[0, 0]` of `sheetPath`. All 9 static `.webp` files are redundant network requests + wasted GPU textures.
  - **At 10× Scale**: `90+` creature/NPC/boss types waste `90+` HTTP requests during boot preload and tens of megabytes of duplicate GPU `TextureSource` allocations.
- **Proposed Fix**:
  - In `loadManifestEntry`, when `entry.animations` is defined, load only `loadSheetAnimations(entry.animations)` and derive `entry.texture` as a sub-frame `Texture` (`clips.idle?.south?.frames[0] ?? new Texture({ source: sheet.source, frame: new Rectangle(0, 0, fw, fh) })`), removing standalone `<kind>.webp` files from `public/assets/creatures/`.

---

### 2. Client Startup, Hero Compositor & GPU/VRAM Memory Scaling

#### `PERF-04` · Critical — Eager Preload & Retention of All `1152×11712` (`51.47 MB` RGBA Each) Hero Layer Sheets in RAM
- **Subsystem**: Character Asset Pipeline & Browser Memory
- **Locations**:
  - [packages/client/src/render/character/playerAssets.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/playerAssets.ts#L43-L50)
  - [packages/client/src/render/character/playerAssets.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/playerAssets.ts#L144-L169)
  - [tools/sprite-studio/bakePlayerAssets.mjs](file:///c:/repos/DungeonCrawler2D/tools/sprite-studio/bakePlayerAssets.mjs#L9-L53)
- **Evidence & Quantified Impact**:
  - `bakePlayerAssets.mjs` packs every hero layer onto a fixed `6 × 61` grid of `192 × 192` cells = **`1,152 × 11,712` pixels (`13,492,224` px)** per `.webp` file — even though clips only use `2–6` columns and ~`73×119` to `171×169` trimmed pixels (`>75%` of every `.webp` image is empty transparent space, plus `11,712 px` exceeds mobile `8,192` hardware limits if ever uploaded directly).
  - At startup, `fetchAllPlayerAssets` (`playerAssets.ts:144-169`) downloads **every layer in `meta.layers` (`16` layers)** before allowing the loading screen to finish, and line `166` sets `maxCachedLayers = Math.max(64, meta.layers.length + 16)` so **none are ever evicted**.
  - Each decoded `1152 × 11712` RGBA8 `HTMLImageElement` occupies **`51.47 MB`** when decoded in browser bitmap memory (`16 × 51.47 MB = 823.5 MB` peak decoded image memory!).
  - **At 10× Scale**: With `160` armor sets, helmets, hairstyles, capes, and offhands in `meta.layers`, `fetchAllPlayerAssets` will download 160 `.webp` sheets on boot and `maxCachedLayers = meta.layers.length + 16` will retain **`160 × 51.47 MB = 8.24 GB`** of decoded RGBA bitmaps — crashing iOS Safari, Android Chrome, and 8 GB laptops before the Title Screen even opens.
- **Proposed Fix**:
  1. **Tight-pack `.webp` layers at bake time** in `bakePlayerAssets.mjs` using the exact same shelf-packing + `trim` layout as `playerAtlasPacker.ts` (`~1536 × 1050` Core + `~1536 × 850` Secondary ≈ **`11.1 MB` RGBA total instead of `51.47 MB` — a `4.6×` pixel reduction per layer**).
  2. **Lazy-load equipment & hair layers on demand**: At boot, preload only `body-male`, `body-female`, `body-male-arms`, `body-female-arms`, and the local player's saved `hair-*` + equipped armor (`~5–7` layers instead of all `160`). Load remote/unseen armor layers asynchronously via `ensurePlayerLayersLoaded`.
  3. **Use `createImageBitmap` + `.close()` or a strict byte-bounded LRU** (`MAX_CACHED_LAYER_IMAGES = 16`, never scaling `maxCachedLayers` with `meta.layers.length`) so raw layer bitmaps are freed once baked into GPU atlases.

---

#### `PERF-05` · Critical — Synchronous Main-Thread Hero Compositing, Per-Slot `getImageData` Armor Recoloring, Eager `toDataURL`, & `32`-Set Cache Thrashing
- **Subsystem**: 3D Hero Compositor / CPU Frame Pacing & VRAM
- **Locations**:
  - [packages/client/src/render/character/playerCompositor.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/playerCompositor.ts#L90-L151)
  - [packages/client/src/render/character/atlas/armorLayerRecolor.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/atlas/armorLayerRecolor.ts#L46-L68)
  - [packages/client/src/render/character/playerRecolor.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/playerRecolor.ts#L263-L278)
  - [packages/client/src/render/character/atlas/playerPortraitBake.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/atlas/playerPortraitBake.ts#L139-L153)
  - [packages/client/src/render/character/characterSprites.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/characterSprites.ts#L19-L22) (`MAX_CACHED_SETS = 32`), [lines 168–183](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/characterSprites.ts#L168-L183)
  - [packages/client/src/render/world/playerSprite.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/playerSprite.ts#L91-L92)
- **Evidence & Quantified Impact**:
  - Whenever a player enters AOI, swaps any armor piece, or first triggers a secondary clip (`jump`, `fall`, `crouch`, `swim`, `bow`, `downed` via `ensureSecondary()` in `playerSprite.ts:92`), `compositeTierCanvas` executes **synchronously inside `renderFrame()`**:
    1. **Up to `625` Canvas `getImageData` readbacks per bake**: For any Frontier armor with `recolorPrimary` (Copper, Iron, Bandit, Bog, Runic, etc.), `drawRecoloredSlots` (`armorLayerRecolor.ts:60-67`) loops over all `125` Core slots (or `115` Secondary slots) and calls `scratch.ctx.getImageData` → CPU loop → `putImageData` → `drawImage` *per slot, per armor/sleeve layer* (`125 × 5 = 625` separate `ImageData` allocations & readbacks!).
    2. **Full-sheet CPU passes**: `ctx.getImageData(0, 0, plan.width, plan.height)` (`~1536 × 1220` = `7.5 MB`) + `applyRecolorPass` + `applyUnifiedSelOut` (allocates another `7.5 MB` `Uint8ClampedArray` + `1.87 MB` `Uint8Array` and scans `1.87M` pixels) + `putImageData` + WebGL2 `texImage2D` upload.
    3. **Unnecessary synchronous PNG encoding**: `extractPortraitUrlFromCore` (`playerPortraitBake.ts:152`) calls `canvas.toDataURL()` on every character bake, even for remote players whose portrait URL is never used in any DOM element.
    4. **Double RAM + VRAM retention**: `Texture.from({ resource: canvas })` retains the `HTMLCanvasElement` (`~7.5 MB` CPU backing store) alongside the `~7.5 MB` WebGL2 texture (`~15 MB` Core + `~12 MB` Secondary = **`~27 MB` per cached outfit × `32` = up to `864 MB` RAM+VRAM**).
  - **At 10× Scale (Catastrophic Live-Texture Destruction Bug + Frame Freeze)**: In a `40`-player Sanctuary hub or raid with `>32` unique `appearance|armor` keys on screen simultaneously, `reconcilePlayerViews` calls `getCharacterSpriteSet` (`characterSprites.ts:176`) or `PlayerView.syncAppearanceSet`, and **`evictOldestIfFull()` (`MAX_CACHED_SETS = 32`) destroys GPU `TextureSource`s that are actively bound to other visible `PlayerView`s**, causing black/corrupted sprites or `32+` full `compositeTierCanvas` rebuilds per second (`100%` main-thread lockup)!
- **Proposed Fix**:
  1. **Move Sentinel/Armor Recoloring & Sel-Out Outline to a GPU Fragment Shader or Web Worker (`OffscreenCanvas` → `ImageBitmap` → `BufferImageSource`)**, or recolor each armor layer once on a single packed sheet before compositing instead of `625` per-slot `getImageData` calls.
  2. **Upload via `BufferImageSource({ resource: imgData.data, width, height })`** instead of retaining `HTMLCanvasElement` so Canvas2D backing memory is garbage-collected immediately (`-50%` memory).
  3. **Compute `previewUrl` lazily** inside `getCharacterPortraitUrl` only when requested by `TitleScreen` or `CharacterPanel`.
  4. **Reference-count active `PlayerView` sprite sets** so `spriteCache` never evicts/destroys a `CharacterSpriteSet` currently mounted on a live `PlayerView`.

---

#### `PERF-06` · High — Per-Row Unbatched `1024×52` Cliff Strip Textures (`bakeElevatedChunkRows`) Causing VRAM Bloat & Batch Thrashing
- **Subsystem**: World Chunk Rendering / WebGL2 Textures
- **Locations**:
  - [packages/client/src/render/world/cliffStrips.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/cliffStrips.ts#L150-L198)
  - [packages/client/src/render/world/chunkRenderer.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/chunkRenderer.ts#L172-L180)
  - [packages/client/src/render/textures/terrainTextures.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/textures/terrainTextures.ts#L150-L160)
- **Evidence & Quantified Impact**:
  - For every mounted chunk, `bakeElevatedChunkRows` iterates `ly = 0..31` × `elev ∈ [1, 2]` (`64` passes). Whenever a row contains **even 1 elevated tile**, `bakeSingleElevationRow` (`cliffStrips.ts:155, 162, 167`) allocates a full-chunk-wide **`1024 × 52` `HTMLCanvasElement`** (`212,992 B` RGBA RAM) and uploads a dedicated WebGL2 `TextureSource` (`212,992 B` VRAM = **`426 KB` per strip**).
  - On `craggy-highlands` chunks where plateaus span most rows at elevations 1 & 2, **one chunk creates `35–60` separate `TextureSource`s (`14.9–25.5 MB` RAM+VRAM)**. Across `5 × 5 = 25` mounted chunks (`High` preset, `chunkRadius: 2`), cliff strips alone consume **up to `350–600 MB` RAM+VRAM and `800–1,500` separate `TextureSource` objects**.
  - Because every cliff strip has a unique `TextureSource`, interleaved Y-sorted cliff strips and props in `ysortCam` overflow PixiJS v8's `MAX_TEXTURES = 16` batch bind group every few rows, multiplying draw calls.
  - Additionally, `terrainTextures.ts:151-160` retains `68` `32×32` `HTMLCanvasElement`s in `atlas.variants` solely for `cliffStrips.ts:145` (`ctx.drawImage`) plus `cliffFace` and `stairFace` canvases unused in gameplay.
  - **At 10× Scale**: Deeper elevation tiers (`elevation 0..4` in mountain/dungeon floors) double strip count to `128` per chunk, blowing mobile VRAM budgets and spiking chunk-mount frame times (`10–25 ms` per chunk boundary crossing).
- **Proposed Fix**:
  - Put cliff wall & stair tiles into the shared `TerrainTileAtlas` (`gpuSheet`) and emit Y-sorted **quads/meshes referencing `terrain.gpuSheet.source`** (or horizontal contiguous tile runs trimmed to `[minLx..maxLx]` packed into **1 single tight-packed atlas `TextureSource` per chunk** released from Canvas2D via `ImageBitmap`/`BufferImageSource`). All cliff geometry then shares 1 `TextureSource` per chunk (or the single global `terrain.gpuSheet`!), cutting VRAM by **`>90%`** and collapsing cliff draw calls into standard batches.

---

#### `PERF-07` · High — Synchronous Startup Canvas Baking of `55+` Unbatched Prop Textures & `77` `toDataURL()` Item Icons
- **Subsystem**: Procedural Texture & Icon Baking
- **Locations**:
  - [packages/client/src/render/textures/propTextures.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/textures/propTextures.ts#L45-L66)
  - [packages/client/src/render/textures/pixelCanvas.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/textures/pixelCanvas.ts#L125-L195)
  - [packages/client/src/ui/icons/itemIcons.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/icons/itemIcons.ts#L155-L182)
  - [packages/client/src/ui/loading/bootPreloader.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/loading/bootPreloader.ts#L50-L69)
- **Evidence & Quantified Impact**:
  - `WorldScene.mount` calls `createPropTextureSet()`, synchronously creating **`55+` separate `HTMLCanvasElement`s and `55+` separate WebGL2 `TextureSource`s** (trees, bushes, grass, boulders, flowers, campfires, torches, veins, camp structures, biome props, 14 frontier POI props, plus unused `fallbackKnight`).
  - Each prop calls `stampSelOutOutline` (`pixelCanvas.ts:174-195`), which—unlike `playerRecolor.ts`'s cached edge-splat—rebuilds & sorts `buildOffsetRing` from scratch and scans **every transparent pixel** in the canvas via `findNearestInk` (`52` `getImageData` + `putImageData` round-trips on the main thread).
  - Because all `55+` procedural props + `16` manifest props live on **70+ distinct `TextureSource`s**, Y-sorted world chunks (`ysortCam`) constantly flush WebGL batches as trees, bushes, boulders, grass, and POI props interleave by `y`.
  - Meanwhile, `prebakeAllItemIcons()` (`itemIcons.ts:170-173`) synchronously bakes all `77` `32×32` item canvases (`ITEM_CATALOG.length === 77`) and encodes `77` PNG data URLs via `canvas.toDataURL()`, storing them in unbounded module `Map`s (`iconUrlCache`, `heldTextureCache`).
  - **At 10× Scale**: `770+` items (plus unbounded runtime Phase 13 System-AI-crafted item IDs!) and `300+` biome/dungeon props will stall startup by **`2–4 seconds`**, leak `heldTextureCache`/`iconUrlCache` without bounds, and cause severe texture-bind thrashing across `300+` individual prop `TextureSource`s.
- **Proposed Fix**:
  1. **Pack all procedural prop canvases into a single shared `2048×2048` `PropAtlas` `TextureSource`** (slicing sub-`Texture` `Rectangle`s), so every tree, bush, boulder, campfire, and POI prop in `ysortCam`, `grassCam`, and `canopyCam` batches into **1 WebGL draw call per layer**!
  2. Replace `stampSelOutOutline` in `pixelCanvas.ts` with `applyUnifiedSelOut` (`DISK_OFFSET_CACHE` silhouette-edge splatting) — or pre-bake static props/icons into build-time `.webp` sprite sheets + CSS sprite coordinates.
  3. Bake item icons **lazily on first `getItemIconUrl(id)`** (with an LRU cap for Phase 13 dynamic items) or pack into a single shared icon atlas sheet (`background-position`) instead of `770+` synchronous `toDataURL()` calls at boot.

---

### 3. WebGL2 Shaders, Post-Processing, Scene Graph & PixiJS v8 Lifecycle

#### `PERF-08` · High — Unconditional Full-Screen FBO Filter Passes, Broken "Low" Quality Shader Bypass, Empty Water Meshes, & Heavy Composite Shader
- **Subsystem**: WebGL2 Shaders & Post-Processing (`WorldScene`, `LightingSystem`, `WaterSurfaceEffect`, `FoliageWindEffect`)
- **Locations**:
  - [packages/client/src/render/world/worldScene.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/worldScene.ts#L76-L92), [lines 240–261](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/worldScene.ts#L240-L261)
  - [packages/client/src/render/shaders/waterFilter.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/shaders/waterFilter.ts#L48-L60)
  - [packages/client/src/render/shaders/foliageWindFilter.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/shaders/foliageWindFilter.ts#L44-L53)
  - [packages/client/src/render/world/tileBuilder.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/tileBuilder.ts#L122-L131)
  - [packages/client/src/render/shaders/glsl/waterGlsl.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/shaders/glsl/waterGlsl.ts#L18-L48)
  - [packages/client/src/render/shaders/glsl/lightingCompositeGlsl.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/shaders/glsl/lightingCompositeGlsl.ts#L48-L104)
- **Evidence & Quantified Impact**:
  1. **Broken Low-Quality Bypass**: When the user selects `"performance"` ("Low" quality: `waterShader: false`, `windShader: false`), `WaterSurfaceEffect.update` sets `uEnabled = 0` and `FoliageWindEffect.update` sets `uWindStrength = 0`, **leaving `this.filter.enabled === true` and `host.filterArea = app.screen`**! PixiJS v8 still binds, clears, renders into, and blits **3 full-screen offscreen `RenderTexture` FBOs every frame** just to execute early-exit passthrough fragment shaders!
  2. **Empty Water Meshes Keep Full-Screen Water FBO Alive on Dry Land**: `buildChunkTilemapMeshes` (`tileBuilder.ts:122-131`) creates a `water` `Mesh` + `Shader` + `4 KB` `BufferImageSource` for **every chunk** even when `waterData` contains zero water tiles. Thus `waterHost` is never empty, running a full-screen FBO pass on dry forest/highland chunks, and on water pixels `ringAlphaMin` (`waterGlsl.ts:18-25, 43-44`) executes **17 `texture()` fetches per pixel**.
  3. **Heavy Unconditional Full-DPR Composite Shader**: `LIGHTING_COMPOSITE_FRAGMENT_GLSL` runs at full `maxDpr` (`up to 2.0`) and performs **11 texture samples per pixel** (including 4 `bloomTap` reads even if `uBloomStrength == 0`) plus **16–20 procedural `hash21` noise calls per pixel** (`cloudFbm` × 2 + `smoothNoise` sunbeam ray). At `2560×1440` (`3.69M` px × 60 fps = `221M` fragments/sec), this consumes **`~2.4 billion` texture fetches/sec + `~4.4 billion` hash evaluations/sec**.
  - **At 10× Scale**: Adding dungeon fog-of-war, weather shaders (rain/snow/ash), or poison/curse post-processing stacked as additional full-screen `Filter`s will cripple integrated GPUs and mobile thermal budgets.
- **Proposed Fix**:
  ```ts
  // In WaterSurfaceEffect.update:
  this.filter.enabled = params.enabled && params.hasVisibleWater;
  if (!this.filter.enabled) return;

  // In FoliageWindEffect.update:
  this.filter.enabled = params.windStrength >= 0.01 && params.hasVisibleCanopy;
  if (!this.filter.enabled) return;
  ```
  - In `packChunkTilemapBuffers` (`tileBuilder.ts`), track `hasWater: boolean` and skip creating `water` `Mesh`/`Shader`/`BufferImageSource` for dry chunks (`~85%` of chunks).
  - Pre-bake tileable `128×128` cloud/noise lookup textures instead of computing 20 `hash21` procedural FBM evaluations per fragment, and guard `sampleSelectiveBloom` behind `if (uBloomStrength > 0.01)` (or disable cloud/mist FBM in indoor dungeons & Low preset).

---

#### `PERF-09` · High — Global Unculled `ysortCam` Sorting (`2,000–4,000+` Children) & Scene-Graph Bloat (`17` Eager DisplayObjects per `EntityView`)
- **Subsystem**: PixiJS Scene Graph & Culling (`WorldScene`, `ChunkRenderer`, `EntityRenderer`)
- **Locations**:
  - [packages/client/src/render/world/worldScene.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/worldScene.ts#L74)
  - [packages/client/src/render/world/chunkRenderer.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/chunkRenderer.ts#L155-L186)
  - [packages/client/src/render/world/chunkProps.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/chunkProps.ts#L161-L209)
  - [packages/client/src/render/combat/entitySprites.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/entitySprites.ts#L89-L128)
- **Evidence & Quantified Impact**:
  - On `High` quality (`chunkRadius = 2`, `5×5 = 25` chunks = `160×160` tiles), only ~`4–6` chunks overlap the camera viewport at `zoom = 3.5`, yet **all `25` chunks' `ground.mesh`, `water.mesh`, `ysortSprites`, `grassSprites`, and `canopySprites` (`2,000–4,000+` sprites) remain `visible = true` and unculled** in global containers.
  - Because `ysortCam.sortableChildren = true`, every frame any player, mob, or bobbing loot updates `zIndex`, PixiJS re-sorts the entire `2,000–4,000+` element `ysortCam.children` array and computes world transforms for offscreen chunks.
  - Every `EntityView` (`entitySprites.ts:90-128`) eagerly instantiates **17 DisplayObjects (`10 Graphics`, `2 Sprites`, `1 Text`, `3 Containers` + root)** at spawn — including 4 `WaterSubmergeRig` `Graphics` shapes + `submergedBody` `Sprite` (unused on 98% dry land), 3 `AiIndicatorView` `Graphics` + 2 `Containers`, and `EliteVisuals` `aura` `Graphics` + `Text` (even for Tier-I non-elites).
  - `animateChunkPropsAndFoliage` (`chunkProps.ts:161-192`) runs `updateCanopyAlpha` and `findGrassPush` (`O(visibleGrass × players)`) and mutates `grass.sprite.rotation` and `grass.sprite.scale` on every visible grass tuft every 120 Hz frame, invalidating PixiJS local transform matrices continuously.
  - **At 10× Scale**: `300` swarm enemies + `20` co-op players instantiate **`5,100+` `EntityView` DisplayObjects (`3,000` `Graphics`)** on top of `4,000` prop sprites in `ysortCam`, pushing scene-graph transform + sort time past `6–10 ms/frame`.
- **Proposed Fix**:
  1. Toggle chunk visibility by frustum overlap in `ChunkRenderer`: hide offscreen chunks' `ground.mesh` / `water.mesh` and store non-overlapping chunk props in per-chunk sub-containers when outside `viewBounds` (mounting into `ysortCam` only for the `~4–9` chunks intersecting `viewBounds`).
  2. **Lazy-instantiate `WaterSubmergeRig`, `EliteVisuals`, and `AiIndicatorView` sub-Graphics** on `EntityView` (and `PlayerView`) only when `inDeepWater`, `tier >= 2 || isElite`, or an AI indicator actually activates — reducing baseline `EntityView` from **17 DisplayObjects → 3 (`root`, `shadow` Sprite, `body` Sprite)**.
  3. Spatial-filter `players` to `viewBounds` once before `animateChunkPropsAndFoliage` and skip `updateGrassRustle` transform writes when gust delta is `< 0.005 rad` or throttle grass rustle to `30 Hz`.

---

#### `PERF-10` · Medium — PixiJS v8 `TextStyle` & GPU Text Cache Leaks on `PlayerView`, `EntityView`, and `LootView` Destruction
- **Subsystem**: PixiJS v8 Resource Lifecycle
- **Locations**:
  - [packages/client/src/render/world/chunkRenderer.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/chunkRenderer.ts#L139-L140)
  - [packages/client/src/render/world/chat/playerSpeechBubble.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/chat/playerSpeechBubble.ts#L73-L77)
  - [packages/client/src/render/combat/entitySprites.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/entitySprites.ts#L243)
  - [packages/client/src/render/combat/eliteVisuals.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/eliteVisuals.ts#L32), [line 63](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/eliteVisuals.ts#L63)
  - [packages/client/src/render/combat/worldPickups.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/worldPickups.ts#L170)
  - [packages/client/src/render/combat/lootViewHelpers.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/lootViewHelpers.ts#L63-L76)
- **Evidence & Quantified Impact**:
  - In PixiJS v8 (`AbstractText.mjs`), `text.destroy({ children: true })` **does not destroy `this._style`** unless `options === true` or `options.style === true` (consistent with `docs/LESSONS.md:30`: *"pass `destroy(true)` on expired dynamic `Text` popups so text styles and canvases are freed together"*).
  - Yet all three actor/pickup unmounters call `view.root.destroy({ children: true })`:
    - `ChunkRenderer.reconcilePlayerViews` (`chunkRenderer.ts:140`) leaks `PlayerView.label`'s `TextStyle` and never calls `PlayerSpeechBubble.destroy()` (`playerSpeechBubble.ts:73`).
    - `EntityRenderer.sync` (`entitySprites.ts:243`) leaks `EliteVisuals.label`'s per-instance `TextStyle` (allocated for *every* entity, with `style.fill` mutated per tier).
    - `WorldPickupsRenderer.syncGroundLoot` (`worldPickups.ts:170`) leaks `createCountBadge` `TextStyle`s on every loot pickup.
  - **At 10× Scale**: Across a 2-hour dungeon session with `5,000+` slain enemies and `10,000+` loot drops/AOI transitions, thousands of `TextStyle` instances and unique `styleKey` entries churn in `CanvasTextPipe`.
- **Proposed Fix**:
  - Share a module-level immutable `const` `TextStyle` instance per badge color/role (never mutating `label.style.fill` on an instance), add explicit `PlayerView.destroy()`, `EntityView.destroy()`, and `LootView.destroy()` methods that call `text.destroy({ texture: true, textureSource: true, style: false })` (when sharing immutable `TextStyle`s) or `text.destroy(true)` (when owning a private `TextStyle`), while keeping `{ texture: false }` on shared sprite children.

---

#### `PERF-11` · Medium — Per-Frame `Graphics.clear()` Geometry Re-Tessellation Across Idle Overlays, AI Indicators, Webs, Projectiles, & Elite Auras
- **Subsystem**: PixiJS v8 Vector `Graphics` CPU Tessellation
- **Locations**:
  - [packages/client/src/render/combat/webs/webRenderer.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/webs/webRenderer.ts#L19-L60), [lines 77–91](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/webs/webRenderer.ts#L77-L91)
  - [packages/client/src/render/combat/aiStateIndicators.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/aiStateIndicators.ts#L197-L224)
  - [packages/client/src/render/combat/combatVfx.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/combatVfx.ts#L216-L221), [lines 231–241](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/combatVfx.ts#L231-L241)
  - [packages/client/src/render/world/playerPoseHelpers.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/playerPoseHelpers.ts#L198-L219)
  - [packages/client/src/render/combat/eliteVisuals.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/eliteVisuals.ts#L42-L49)
- **Evidence & Quantified Impact**:
  - Every `60–120 Hz` render frame:
    - `drawPlayerWebOverlay` (`webRenderer.ts:81`) calls `g.clear()` unconditionally for every player even when `webStick <= 0.12 && cocoonProgress <= 0`.
    - `AiIndicatorView.sync` (`aiStateIndicators.ts:202, 218`) calls `backstabGfx.clear()` and `fxGfx.clear()` on every entity even when already empty.
    - `WebLayer.sync` (`webRenderer.ts:20, 55-59`) calls `this.gfx.clear()` every frame even when `strands.length === 0`, and when webs exist, tessellates 2 `quadraticCurveTo(...).stroke()`s + 1 `circle(...).fill()` per strand every frame even when nodes have settled at rest (`vx ≈ 0, vy ≈ 0`).
    - `CombatVfxLayer.syncSingleProjectile` (`combatVfx.ts:217-218`) redraws static `"web"` orb shapes every frame, and `EliteVisuals.syncAura` (`eliteVisuals.ts:46-48`) re-tessellates 2 ellipses per elite every frame instead of scaling a static `Graphics` / `Sprite`.
  - **At 10× Scale**: `20` players + `200` entities (`30` elites) + `150` web strands + `30` projectiles trigger **`700+` `GraphicsContext` clear/tessellate/upload cycles per frame (`84,000/sec` at 120 Hz)**.
- **Proposed Fix**:
  - Guard `.clear()` with a boolean `wasDrawn` flag (`if (!active) { if (wasDrawn) { g.clear(); wasDrawn = false; } g.visible = false; return; }`).
  - Bake static shapes (`webOrb`, `eliteAura`, `pebble` body+shadow sprites, bow aim dots) once and animate via `scale`/`position`/`rotation`/`alpha` instead of per-frame `Graphics.clear()` tessellation; skip `WebLayer` redraw when node deltas are `< 0.01 px` and `fire === 0`.

---

#### `PERF-12` · Low — `Array.shift()` `O(N)` Evictions in Gore Pools & Redundant Per-Frame Array Allocations in `main.ts` / `WorldScene`
- **Subsystem**: Client Frame Loop & GC Pressure
- **Locations**:
  - [packages/client/src/main.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/main.ts#L73-L76), [lines 94–119](file:///c:/repos/DungeonCrawler2D/packages/client/src/main.ts#L94-L119)
  - [packages/client/src/render/world/sceneHelpers.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/sceneHelpers.ts#L68-L102)
  - [packages/client/src/render/world/worldScene.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/worldScene.ts#L192-L193)
  - [packages/client/src/render/combat/gore/goreDecals.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/gore/goreDecals.ts#L241-L247), [goreDecalHelpers.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/gore/goreDecalHelpers.ts#L15-L20)
  - [packages/client/src/render/combat/gore/goreSystem.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/combat/gore/goreSystem.ts#L178)
- **Evidence & Quantified Impact**:
  - `renderTick` (`main.ts:94, 116`) calls `ctx.client.snapshot()` **twice per frame** (`pre` and `view`), running `buildPlayersForSnapshot` (spreading `{ ...raw }` per remote player) twice and allocating `[...pre.events, ...view.events]` + `mergeFrameChat(pre, view)` every frame even when empty.
  - `WorldScene` allocates fresh arrays every frame in `collectWaterActors` (`filter` + `map` × 2 + spread), `collectActorParticleEmitters`, `lights.filter((l) => l.kind === "torch")`, `buildGoreFootActors` (`map` × 2 + spread), and `new Set(entities.map(...))` in `EntityRenderer.sync`.
  - Once `GoreDecalManager` hits `maxDecals = 800` (`High` preset), every landed droplet calls `this.decals.shift()!.sprite.destroy()` (`O(N)` `800`-element shift + destroying and re-allocating a `new Sprite` instead of pooling/reusing the evicted `Sprite`!).
  - **At 10× Scale**: High-cadence AoE combat (`50+` droplets/frame, `300+` entities) churns thousands of short-lived objects and `Sprite` instances per second, inducing periodic V8 young-generation GC pauses on `120 Hz` displays.
- **Proposed Fix**:
  - Ring-buffer `GoreDecalManager.decals` and `GoreSystem.droplets` (`head = (head + 1) % max`), **reusing the evicted `Sprite`** in-place instead of `destroy()` + `new Sprite()`.
  - Read `ctx.client.localPose()` / `peekPreStepState()` before `stepInput` so `ctx.client.snapshot()` is called **once** per frame, and reuse preallocated scratch arrays in `WorldScene`.

---

### 4. Client DOM / HUD Layout Thrashing & Input Polling

#### `PERF-13` · High — Per-Frame Synchronous Browser Layout Reflow via `canvas.getBoundingClientRect()` & `ItemCardPopover` `offsetHeight`
- **Subsystem**: Client Input / HUD DOM Layout
- **Locations**:
  - [packages/client/src/render/world/worldScene.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/worldScene.ts#L139-L146)
  - [packages/client/src/main.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/main.ts#L32-L41), [lines 69–71](file:///c:/repos/DungeonCrawler2D/packages/client/src/main.ts#L69-L71)
  - [packages/client/src/ui/hud/itemCard/itemCardPopover.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/itemCard/itemCardPopover.ts#L158-L161)
- **Evidence & Quantified Impact**:
  - `resolveMouseAim` (`main.ts:36`) calls `ctx.scene.screenToWorldTile(mouse.x, mouse.y)`, which calls **`this.app.canvas.getBoundingClientRect()` (`worldScene.ts:140`) on every `60–120 Hz` frame** whenever the player is stationary or attacking.
  - Because `syncUiAndAudio` at the end of the previous `renderTick` mutates HUD DOM styles/attributes/text (`vitals`, `toolbar`, `feedback`, `ping`), reading `getBoundingClientRect()` at the start of the next `renderTick` forces Chromium/WebKit to flush pending style recalculation and synchronous layout before JS can proceed!
  - Similarly, `ItemCardPopover.sync` (`itemCardPopover.ts:158-160`) calls `this.renderCard(...)` (`replaceChildren`), sets `this.el.hidden = false`, and immediately reads `this.el.offsetHeight` on line `160`, triggering a forced synchronous layout reflow mid-sync.
  - **At 10× Scale**: As HUD complexity grows (party frames, buff bars, quest tracker, minimap pins, combat log), forced synchronous reflows climb from `0.2–0.5 ms` to **`1.5–3.0 ms` every frame**.
- **Proposed Fix**:
  - Cache `canvasRect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }` inside `WorldScene` and update it **only** inside a `ResizeObserver` on `this.app.canvas` (and `window` `scroll`/`fullscreenchange`), making `screenToWorldTile` pure `O(1)` math with zero DOM layout reads.
  - Position `ItemCardPopover` using CSS `transform` / `max-height` clamping or defer measurement to a `ResizeObserver` instead of synchronous `offsetHeight`.

---

#### `PERF-14` · High — High-Frequency `document.elementFromPoint` Hit-Testing (`125–1,000 Hz`) & Full `HudRoot.sync` Cascade on `pointermove`
- **Subsystem**: HUD Drag & Hover Manager (`SlotDragManager`, `HudRoot`)
- **Locations**:
  - [packages/client/src/ui/hud/slotDragManager.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/slotDragManager.ts#L41), [lines 124–129](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/slotDragManager.ts#L124-L129), [lines 141–148](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/slotDragManager.ts#L141-L148)
  - [packages/client/src/ui/hud/hudRoot.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/hudRoot.ts#L75-L76), [line 181](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/hudRoot.ts#L181)
- **Evidence & Quantified Impact**:
  - `SlotDragManager` binds a global `window.addEventListener("pointermove", ...)` (`slotDragManager.ts:41`). Whenever the player moves their mouse to aim on the WebGL canvas (`125 Hz` standard mice, **`500–1,000 Hz` gaming mice**), `updateMouseHover` executes **`document.elementFromPoint(e.clientX, e.clientY)?.closest(SLOT_SELECTOR)`** on every raw pointer event!
  - `document.elementFromPoint` forces browser hit-test tree traversal (and layout flush if dirty) up to **`1,000` times/sec** even when `e.target === app.canvas`!
  - Furthermore, whenever hover transitions onto/off a slot (`emitHover`), `hudRoot.ts:76` calls `this.refreshFromCache()` → **`this.sync(this.lastState)`**, re-running the *entire* `HudRoot.sync` pipeline (`hotbar`, `vitals`, `inventoryModal`, `chestModal`, `craftingPanel`, `characterPanel`, `itemCard`, `minimap`) synchronously inside `pointermove`.
  - **At 10× Scale**: Complex HUD trees + `1,000 Hz` mouse polling waste `2–5 ms` of main-thread CPU per frame while aiming in combat.
- **Proposed Fix**:
  - Replace global `document.elementFromPoint` polling on `pointermove` with **delegated `pointerover` / `pointerout` listeners** on the HUD container roots (or immediately short-circuit `if (e.target instanceof HTMLCanvasElement) { this.emitHover(null); return; }`), and have `onHoverItem` call **only `this.itemCard.sync(...)`** (or let the next `requestAnimationFrame` `hud.sync` render it) instead of `refreshFromCache()`.

---

#### `PERF-15` · Medium — `VitalsBar` 20 Hz `<svg>` `innerHTML` Reparsing, `3×` Redundant `sampleMacroBiome` Calls/Frame, Unfingerprinted 120 Hz HUD Writes, & Leaked `TitleScreen` Timer
- **Subsystem**: HUD / Overlays (`VitalsBar`, `AtmosphereToolbar`, `PingCounter`, `SettingsMenu`, `CombatFeedbackOverlay`, `DiscoveryOverlay`, `TitleScreen`)
- **Locations**:
  - [packages/client/src/ui/hud/vitalsBar.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/vitalsBar.ts#L24-L29), [lines 139–150](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/vitalsBar.ts#L139-L150), [lines 174–182](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/vitalsBar.ts#L174-L182)
  - [packages/client/src/main.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/main.ts#L86-L90), [worldScene.ts:191](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/worldScene.ts#L191), [discoveryOverlay.ts:67](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/discovery/discoveryOverlay.ts#L67)
  - [packages/client/src/ui/atmosphereToolbar.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/atmosphereToolbar.ts#L115-L133), [lines 150–166](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/atmosphereToolbar.ts#L150-L166)
  - [packages/client/src/ui/fpsCounter.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/fpsCounter.ts#L68-L97)
  - [packages/client/src/ui/settings/settingsMenu.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/settings/settingsMenu.ts#L94-L98)
  - [packages/client/src/ui/overlays/combatFeedbackOverlay.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/overlays/combatFeedbackOverlay.ts#L57-L60)
  - [packages/client/src/ui/title/titleScreen.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/title/titleScreen.ts#L60-L62)
- **Evidence & Quantified Impact**:
  1. **`VitalsBar` SVG `innerHTML` Thrashing**: `VitalsBar.sync` (`vitalsBar.ts:145`) combines `v.hp`, `v.stam`, buff timers, and stealth state into **one single `lastKey`**. Whenever the player sprints, blocks, attacks, or regenerates stamina (`v.stam` changes `20×/sec`), `syncStealthEye` (`line 181`) runs **`this.stealthPill.innerHTML = ...`**, destroying and HTML-parsing **3 `<svg>` elements (`60` SVG DOM nodes/sec)** even when stealth state hasn't changed! Also `resolveThreatLevel` (`lines 24-29`) iterates all `entities` every 120 Hz frame *before* fingerprint checking.
  2. **Triple Redundant `sampleMacroBiome` per Frame**: Every 120 Hz frame evaluates `sampleMacroBiome` (8 FBM octaves) **three separate times** (`worldScene.ts:191`, `discoveryOverlay.ts:67`, and `formatCompassBiomeHint` in `main.ts:88` *before* `compass.sync` checks if `(Math.floor(lx), Math.floor(ly))` even changed!).
  3. **Unfingerprinted 120 Hz DOM Mutations**: Every frame unconditionally writes:
     - `settings.syncExternalState` (`settingsMenu.ts:94-98`): mutates `dataset.active` on 3 quality buttons, `zoomValEl.textContent`, and `fsBtn.textContent` **even when the Settings modal is closed (`hidden`)**!
     - `ping.sync` (`fpsCounter.ts:68-97`): rewrites `textContent`, `dataset.tier`, and `title` every frame **even when `el.hidden === true` or `ms` is unchanged**.
     - `toolbar.sync` (`atmosphereToolbar.ts:127-129, 150-166`): writes `bagBtn.dataset.active`, `settingsBtn.dataset.active`, `window.matchMedia("(display-mode: standalone)")`, and (in `?debug=1`) 6 text/slider DOM properties every frame.
     - `feedback.sync` (`combatFeedbackOverlay.ts:58-59`): allocates `vigAlpha.toFixed(3)` and writes `style.opacity` on two full-viewport `inset: 0` divs every frame even at full HP (`opacity: 0`).
  4. **Leaked Interval**: `TitleScreen` (`titleScreen.ts:60-62`) starts a `200 ms` `window.setInterval` that is never cleared on `dismiss()`.
- **Proposed Fix**:
  - Give `VitalsBar.syncStealthEye` its own `lastStealthKey = "${cover}:${lit}:${openStep}:${tier}"` and pre-create persistent SVG `<path>`/`<ellipse>` nodes, mutating `d`/`rx`/`ry`/`dataset.on` attributes instead of `innerHTML`.
  - Compute `(tileIx, tileIy) → { biome, dangerTier, biomeHint }` **once per tile change** and pass into `WorldScene`, `DiscoveryOverlay`, and `CompassBadge`.
  - Add early-exit fingerprint guards to `PingCounter.sync`, `SettingsMenu.syncExternalState` (skip when `!this.open`), `AtmosphereToolbar.sync`, and `CombatFeedbackOverlay.sync` (plus `hidden = true` when `vigAlpha === 0 && !downed`), and clear `TitleScreen`'s interval in `dismiss()`.

---

#### `PERF-16` · High — `MinimapOverlay` Re-Rasterizes `57,600` Tiles on Every Tile Step & Overflows `WorldChunkCache` (`225` vs `96` Chunks) at `1×` Zoom
- **Subsystem**: Overworld Map UI & Client Chunk Cache
- **Locations**:
  - [packages/client/src/ui/map/minimapOverlay.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/map/minimapOverlay.ts#L157-L188), [lines 198–209](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/map/minimapOverlay.ts#L198-L209)
  - [packages/client/src/ui/map/mapPinRenderer.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/map/mapPinRenderer.ts#L66-L102), [lines 122, 141](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/map/mapPinRenderer.ts#L122)
  - [packages/engine/src/world/collision.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/collision.ts#L14)
- **Evidence & Quantified Impact**:
  - `MinimapOverlay.sync` (`minimapOverlay.ts:158-159`) checks `if (!wasHidden && cacheKey === this.terrainCacheKey && nowMs - this.lastDrawMs < 95) return;`. Because `cacheKey` embeds `${tx0}:${ty0}`, **crossing any tile boundary (`5–8×/sec` while sprinting with `[M]` open or holding `"map"`) bypasses the `95 ms` throttle** and runs `refreshTerrainLayer` from scratch!
  - Every `refreshTerrainLayer` allocates `ctx.createImageData(480, 480)` (`921.6 KB`) and calls `cache.tileAt(wx, wy)` **`240 × 240 = 57,600` times** (`345,600–460,800` `tileAt` calls/sec while sprinting!).
  - **Catastrophic Cache Overflow at `1×` Zoom**: Cycling the zoom button (`minimapOverlay.ts:132`) to `1×` sets `half = 240` (`480 × 480` tiles = **`15 × 15 = 225` chunks**!). Because `WorldChunkCache.maxCachedChunks = 96`, a single `refreshTerrainLayer` at `1×` zoom **evicts and regenerates `129+` procedural chunks synchronously on the main thread** (including `ChunkRenderer`'s active viewport chunks!), causing **`200–600 ms` main-thread freezes** every time the player steps 1 tile!
  - **At 10× Scale**: Larger map exploration windows, fog-of-war overlays, and richer POI/quest markers make full-canvas CPU re-rasterization per tile step completely untenable.
- **Proposed Fix**:
  - Cache a lightweight `32×32` RGB minimap thumbnail (`Uint8ClampedArray(32 * 32 * 4) = 4 KB`, or `OffscreenCanvas`) per `(cx, cy)` inside a dedicated `MinimapTileCache` (`max = 512` chunks = `2 MB` total!), decoupling minimap terrain blitting from `WorldChunkCache`'s `96`-chunk full-prop/mesh cache and turning `refreshTerrainLayer` into **`25–225` hardware-accelerated `ctx.drawImage` calls (`<0.2 ms`)** instead of `57,600` `tileAt` lookups + chunk evictions.

---

### 5. Web Audio Synthesis & Node Graph Leaks

#### `PERF-17` · High — `vocalSynth.ts` (`14` Nodes/Layer) & `playSampleOverride` Missing `onended` Disconnect, Uncapped Pack Polyphony, & Permanent `window` Unlock Listeners
- **Subsystem**: Web Audio Engine (`vocalSynth.ts`, `synthCreatureSfx.ts`, `spatialMix.ts`, `audioEngine.ts`)
- **Locations**:
  - [packages/client/src/audio/creatures/vocalSynth.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/creatures/vocalSynth.ts#L55-L80), [lines 110–172](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/creatures/vocalSynth.ts#L110-L172)
  - [packages/client/src/audio/creatures/synthCreatureSfx.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/creatures/synthCreatureSfx.ts#L39-L49)
  - [packages/client/src/audio/spatialMix.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/spatialMix.ts#L40-L69)
  - [packages/client/src/audio/audioEngine.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/audioEngine.ts#L24-L29), [lines 57–65](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/audioEngine.ts#L57-L65)
- **Evidence & Quantified Impact**:
  1. **Missing `onended` Disconnection in `scheduleVocalTrack` & `playSampleOverride`**: Unlike `proceduralSynth.ts:231, 259`, `scheduleVocalTrack` (`vocalSynth.ts:158-172`) constructs **14 Web Audio nodes per vocal layer** (`WaveShaperNode` with `oversample = "2x"`, `3 BiquadFilterNode`s, `2 OscillatorNode`s, `1 AudioBufferSourceNode`, `6 GainNode`s, and an uncaptured `StereoPannerNode` on line `169`) and **never attaches `detachAudioNodesOnEnded`**.
     - In **Sound Studio** (where `dst` is `masterGain`, not a `SpatialBus`), every vocal track preview **permanently leaks** its passive `2×`-oversampled `WaveShaper` + `3 BiquadFilter` chain connected to `AudioContext.destination`, burning real-time audio-thread DSP forever until reload!
     - In **gameplay**, `createSpatialBus` (`spatialMix.ts:40-50`) relies on a `setTimeout(..., 3200)` hack to disconnect the bus, keeping `28–42` nodes per creature vocal active in the audio graph for `3.2 s` after a `0.18 s` sound finishes (and `audioEngine.ts:62` even allocates a `SpatialBus` + `3.2 s` timer for `UI_DISCOVERY_EVENTS` that immediately no-op on line `157`!). `playSampleOverride` (`synthCreatureSfx.ts:39-49`) also never disconnects `src`/`g`.
  2. **Zero Voice Polyphony Cap, Deduplication, or Master Limiter**: `handleWorldEvents` (`audioEngine.ts:57-65`) synthesizes every audible event unconditionally. Cleaving 8 wolves/goblins in one swing spawns `8 × (impact + 2–3 vocal layers)` = **`250–350` simultaneous Web Audio nodes** in a single frame with no `DynamicsCompressorNode` on `masterGain`, causing harsh digital clipping (`>0 dBFS`) and audio-thread glitches.
  3. **Permanent `window` Capture Listeners**: `audioEngine.ts:26-28` registers 5 `window` capture-phase listeners (`pointerdown`, `mousedown`, `keydown`, `touchstart`, `click`) and never removes them once `ctx.state === "running"`.
  - **At 10× Scale**: Dungeon swarm fights (`30–50` mobs taking AoE burn/poison/cleave hits simultaneously) spawn **`1,500–3,000` concurrent Web Audio nodes** (`2×` oversampled WaveShapers + BiquadFilters), starving the Web Audio render quantum (`128` samples = `2.67 ms`) and causing severe audio crackles.
- **Proposed Fix**:
  - In `scheduleVocalTrack`, capture `panner = connectWithPan(...)` and attach `detachAudioNodesOnEnded` once all 3 sources (`carrier`, `lfo`, `breath`) end, disconnecting all 14 nodes immediately upon completion (and do the same in `playSampleOverride`).
  - Add a **Voice Limiter / Cooldown Gate** in `AudioEngine` (e.g., max `24` concurrent SFX voices, max `2` identical event/species cues within `45 ms` with slight gain boost, skip `createSpatialBus` when `prefs.muted || prefs.sfx <= 0.001` or `UI_DISCOVERY_EVENTS.has(ev.kind)`), insert a `DynamicsCompressorNode` limiter before `ctx.destination`, and call `window.removeEventListener` on all 5 unlock listeners as soon as `ctx.state === "running"`.

---

#### `PERF-18` · Medium — `AmbienceBed` Schedules `240–480` `AudioParam.setTargetAtTime` Events/Sec & Runs Continuous Filter Loops When Silent/Muted
- **Subsystem**: Web Audio Ambience (`AmbienceBed`)
- **Locations**:
  - [packages/client/src/audio/ambienceBed.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/ambienceBed.ts#L16-L35), [lines 59–91](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/ambienceBed.ts#L59-L91)
  - [packages/client/src/main.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/main.ts#L83)
- **Evidence & Quantified Impact**:
  - `AmbienceBed.update` runs every `60–120 Hz` render frame and calls `.setTargetAtTime(...)` **4 times per frame** (`windBed.gain`, `windBed.filter.frequency`, `fireBed.gain`, `waterBed.gain` = **`240–480` automation events/sec**, **`864,000–1,728,000` events/hour**) even when target values haven't changed!
  - In Chromium's Web Audio engine, unbounded high-rate `setTargetAtTime` calls without `cancelScheduledValues` or delta thresholds accumulate timeline automation events in the `AudioParam` event list, progressively increasing audio-thread CPU usage over long sessions.
  - Moreover, `fireBed` and `waterBed` run continuous looping `BufferSource` → `BiquadFilter` → `Gain` chains (`gain = 0.0001`) even when the player is miles from any campfire or river, and `AudioContext` stays running (`ctx.suspend()` is never called) when the user mutes audio or backgrounds the tab!
  - **At 10× Scale**: Adding biome weather beds (rain, cave drip, wind, lava, dungeon hum, adaptive music stems in Phase 12) multiplies continuous `AudioParam` timeline churn and background battery drain on mobile.
- **Proposed Fix**:
  - Throttle `AmbienceBed` parameter updates to **`10 Hz`** (`accum += dt; if (accum < 0.1) return;`) AND skip `setTargetAtTime` whenever `Math.abs(nextVal - lastVal) < 0.0005`.
  - Suspend `AudioContext` (`ctx.suspend()`) when `prefs.muted === true` or `document.visibilityState === "hidden"`, resuming cleanly on unmute/focus.

---

### 6. Shared Engine & Authoritative Game-Server Scaling (`20 Hz` Tick Loop)

#### `PERF-19` · Critical — `WorldChunkCache.maxCachedChunks = 96` Thrashing at `>10` Players & `67,272`-Sample Worst-Case `findChunkPoi` Generation Spikes
- **Subsystem**: Shared World Generation & Chunk Cache (`@dc2d/engine`)
- **Locations**:
  - [packages/engine/src/world/collision.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/collision.ts#L14), [lines 22–36](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/collision.ts#L22-L36)
  - [packages/engine/src/world/poiStamper.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/poiStamper.ts#L62-L85), [lines 118–158](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/poiStamper.ts#L118-L158)
  - [packages/engine/src/world/chunkGenerator.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/chunkGenerator.ts#L123-L141)
  - [packages/engine/src/world/biomeSampler.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/biomeSampler.ts#L114-L125)
- **Evidence & Quantified Impact**:
  1. **Hardcoded `maxCachedChunks = 96` Thrashing**: On the server, every player touches a `3×3 = 9` chunk neighborhood every 50 ms tick (`WorldEcology.ensureAroundPlayers`, `resolveMovement`, `ScentTrail`, `ResourceHarvester`). With **just `11` spread-out players** (`11 × 9 = 99 > 96`, plus chasing wildlife touching adjacent chunks), `WorldChunkCache.getChunk` **evicts active chunks every single tick**, regenerating procedural chunks `20` times/sec!
  2. **`67,272`-Sample Worst-Case `findChunkPoi` Stall**: Each `sampleWorldTile(seed, wx, wy)` call evaluates **up to `26` 2D value/ridge noise octaves** (`riverMetric`: 9 octaves; `sampleMacroBiome`: 8 octaves; `hill` + `moisture` + `trail`: 9 octaves).
     - When a POI-eligible chunk (`~11%` of chunks) lands on hilly (`craggy-highlands`) or river/bog terrain where no `7×7` (`rx=3, ry=3`) flat dry patch exists, `findChunkPoi` (`poiStamper.ts:154-157`) scans all `26 × 26 = 676` candidate centers × up to `49` footprint tiles for `primary` (**up to `33,124` `sampleWorldTile` calls**), fails, **scans all `676 × 49` again for `fallback` (`+33,124` calls)**, and then `generateChunk` (`chunkGenerator.ts:136`) samples all `1,024` tiles *again* without reusing any sample = **up to `67,272` `sampleWorldTile` calls (`~1.75M` noise octaves, `15–40 ms` synchronous stall) for a single chunk!**
  - **At 10× Scale**: With `50–100` concurrent players exploring the overworld (`450–900` active chunks needed vs `96` cap), `WorldChunkCache` suffers near-`100%` cache-miss thrashing every tick, burning **`500–2,000 ms` per 50 ms tick** (`10–40×` over budget — total server freeze).
- **Proposed Fix**:
  1. **Invert `generateChunk` order (`65×` faster POI placement)**: Sample the chunk's `32 × 32 = 1,024` tiles **once** up front into `ground`, `elevation`, and `stairs` (evaluating `sampleMacroBiome` on a `4×4` coarse grid with bilinear/nearest lookup where appropriate). Build a `33 × 33` 2D prefix-sum table of `(isWater || isStairs)` and `elevation` to test any `(2*rx+1) × (2*ry+1)` flat dry rectangle in **`O(1)` (`4` array reads)** instead of `49` `sampleWorldTile` noise evaluations — capping chunk generation strictly at **`1,024` tile samples (`<0.6 ms`)**!
  2. **Make `maxCachedChunks` configurable** (`constructor(readonly worldSeed: number, private readonly maxCachedChunks = 256)`), passing `maxCachedChunks = Math.max(512, maxPlayers * 16)` on `game-server` (each `WorldChunk` is only `~18 KB` in RAM: `1,024` chunks ≈ **`18 MB`**, completely negligible on Node.js!).

---

#### `PERF-20` · Critical — `findTilePath` `O(cells × obstacles)` Linear Scan Over `grid.props` (`Up to 1.68M` Checks per Pathfind)
- **Subsystem**: Engine A* Pathfinding (`@dc2d/engine`)
- **Locations**:
  - [packages/engine/src/combat/pathfinding.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/combat/pathfinding.ts#L72-L84), [lines 91–128](file:///c:/repos/DungeonCrawler2D/packages/engine/src/combat/pathfinding.ts#L91-L128)
  - [packages/game-server/src/sim/wildlife/creatureNavigation.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/creatureNavigation.ts#L99), [lines 206–218](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/creatureNavigation.ts#L206-L218)
- **Evidence & Quantified Impact**:
  - `collectBlockingProps` (`pathfinding.ts:72-84`) collects all blocking obstacles across `blockingObstaclesNear(start)` (`9` chunks) + `blockingObstaclesNear(goal)` (`9` chunks) — up to `18` chunks containing **`500–1,400` blocking props** in `verdant-forest` (`forestDensity = 0.82`) or `autumn-woods`.
  - For **every unique cell** sampled during A* (`maxRadiusTiles = 22 → side = 45 → 2,025` grid cells; `maxNodes = 900` expanding 8 neighbors + diagonal corner checks samples **`1,100–1,600` cells**), `evaluatePropCost` (`lines 116-128`) iterates linearly over **every obstacle in `grid.props`** (`1,400 × 1,200 = 1,680,000` `closestObstacleCorePoint` + `Math.hypot` calls per `findTilePath`!).
  - Furthermore, `evaluatePropCost` ignores `p.elevation` (treating obstacles on a cliff above/below as blocking ground tiles or vice versa) and allocates up to `1,600` `CellSample` objects in `new Array(side * side)` per call.
  - **At 10× Scale**: `20` chasing mobs refreshing paths every `0.36 s` (`~55` pathfinds/sec) already execute **`33M–90M` obstacle checks/sec**; at `200+` active creatures (`~550` pathfinds/sec = **nearly `1 billion` obstacle checks/sec**), pathfinding alone exceeds the entire `50 ms` server tick!
- **Proposed Fix**:
  - **Pre-rasterize `grid.props` once into a flat `Float32Array` / `Int8Array(side * side)` obstacle penalty grid** before starting A*:
    ```ts
    // For each obstacle p in grid.props, iterate ONLY its local AABB [minLx..maxLx] × [minLy..maxLy]:
    const reach = p.radius + Math.max(p.halfX ?? 0, p.halfY ?? 0) + softThresh;
    const x0 = Math.max(0, Math.floor(p.x - reach) - minTx);
    const x1 = Math.min(side - 1, Math.ceil(p.x + reach) - minTx);
    // ~9–16 cells checked per obstacle inside bounds → ~4,000–12,000 total checks instead of 1,680,000 (>130× faster!)
    ```
  - Stagger path refreshes across ticks with a global **per-tick pathfind budget** (e.g., max `12` A* searches per server tick, queueing remaining refreshes for the next 50 ms tick).

---

#### `PERF-21` · Critical — `O(C × N)` Per-Tick Global Cloning, Unculled `players` Broadcast, `JSON.stringify` Dirty Check, & `O(C²)` Action-Packet Broadcast Amplification
- **Subsystem**: Authoritative Multiplayer Networking (`@dc2d/game-server`)
- **Locations**:
  - [packages/game-server/src/net/wsServer.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/net/wsServer.ts#L21-L23), [lines 71–118](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/net/wsServer.ts#L71-L118), [lines 181–185](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/net/wsServer.ts#L181-L185), [line 235](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/net/wsServer.ts#L235)
  - [packages/game-server/src/net/snapshotFilter.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/net/snapshotFilter.ts#L75-L104)
- **Evidence & Quantified Impact**:
  1. **Out-of-Tick `O(C²)` Broadcast Amplification**: `BROADCAST_ACTIONS` (`wsServer.ts:21-23`) includes routine per-player actions (`selectHotbar`, `toggleTorch`, `equipArmor`, `unequipArmor`, `pickupLoot`, `dropItem`, `useItem`, `setAppearance`, `placeStructure`, `chat`). Whenever *any* client sends one of these packets, `dispatchMessage` (`line 184`) **immediately runs `broadcastTickSnapshots` across ALL `C` connected clients** outside the 20 Hz tick loop! If `50` players scroll hotbars or loot `4×/sec`, the server executes **`200` extra full-server broadcasts/sec** (`10×` the 20 Hz tick rate = `10,000` `JSON.stringify` snapshots/sec)!
  2. **`O(C × N_global)` Full-World Cloning + Linear Filtering**: Every broadcast calls `makeTickBroadcastData` (cloning *all* global players, *all* global entities, *all* global registered chests, *all* ground loot) and then `filterSnapshotForPlayer` linearly `.filter()`s and `.map(roundEntity)`s every global array **once per client `C`**.
  3. **Unculled Global `players` Array**: `snapshotFilter.ts:91` (`const players = data.players.map(...)`) **never filters remote players by AOI radius**, sending all `C` players' full `PlayerSnapshot` (appearance, armor, timers, coordinates) to all `C` clients (`O(C²)` bandwidth every 50 ms!).
  4. **Per-Tick `JSON.stringify(inv)` Dirty Check**: `syncInventoryIfChanged` (`wsServer.ts:71-77`) builds a fresh `InventorySnapshot` (`36` slots + `5` armor) and runs `JSON.stringify(inv)` for every client on every broadcast.
  - **At 10× Scale**: `100` concurrent players with `600` global entities and `1,000` registered chests generate **`~80–150 MB/s` of JSON serialization work** under normal combat/hotbar activity, saturating a single Node.js vCPU before simulation even runs.
- **Proposed Fix**:
  1. **Never call `broadcastTickSnapshots` inside `dispatchMessage`!** Let `WorldSim` process incoming actions into authoritative state and emit snapshots strictly on the `20 Hz` (`50 ms`) tick timer (`setInterval` in `wsServer.ts:235`).
  2. **Pre-round `PlayerSnapshot`, `WorldEntitySnapshot`, and `ProjectileSnapshot` once per tick** and index entities/players/chests/loot into a **chunk/spatial hash grid** so `filterSnapshotForPlayer` gathers only the `3×3` AOI grid cells around `(px, py)` in `O(N_local)` instead of `O(N_global)` — and AOI-cull `players` (or send coarse 1 Hz map coordinates separately if party/global pins are desired).
  3. Replace `inventorySignature(inv)` (`JSON.stringify`) with an integer `p.inventoryRev++` incremented on actual inventory mutations (plus `nearCampfire` boolean). (Cross-ref `05-SCALABILITY-AND-MODULE-ORGANIZATION.md` for delta-encoded binary/schema protocol evolution.)

---

#### `PERF-22` · High — Permanent Registration of Untouched POI Chests & Full-World `worldDeltas` Broadcast/Remount Storm on Every Resource Chop
- **Subsystem**: Server Loot / World Delta Synchronization (`LootManager`, `WorldDeltaOverlay`, `ChunkRenderer`)
- **Locations**:
  - [packages/game-server/src/sim/wildlife/worldEcology.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/worldEcology.ts#L55-L56)
  - [packages/game-server/src/sim/wildlife/lootManager.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/lootManager.ts#L28-L36), [lines 49, 222–227](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/lootManager.ts#L222-L227)
  - [packages/game-server/src/net/wsServer.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/net/wsServer.ts#L82-L83), [lines 97, 108](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/net/wsServer.ts#L97)
  - [packages/engine/src/survival/worldDeltas.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/survival/worldDeltas.ts#L174-L204)
  - [packages/client/src/render/world/chunkRenderer.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/chunkRenderer.ts#L80)
- **Evidence & Quantified Impact**:
  1. **Unbounded Untouched POI Chest Accumulation**: Every time any player walks within 1 chunk of a POI (`ensureAroundPlayers`), `spawnPoiEncounter` calls `loot.registerPoiChest(poi)`, rolling and permanently storing a 27-slot `StoredChest` in `LootManager.chests` (and persisting it to `world-save.json`) **even if no player ever interacts with it**. On **every 50 ms tick**, `LootManager.snapshot()` (`lootManager.ts:224`) iterates *every* chest ever registered in world history, calling `toChestSnapshot` (`c.slots.map(...)` cloning 27 slots + `countLitBraziersForChest`) *before* AOI filtering!
  2. **Global `worldDeltas` Broadcast + Client Chunk Remount Storm**: Whenever *any* player anywhere in the world chops 1 tree, mines 1 ore vein, lights 1 brazier, places 1 camp structure, or 1 tree regrows (`cache.deltaRevision()` increments), `makeTickBroadcastData` (`wsServer.ts:108`) clones the **entire world's `depleted`, `structures`, and `litBraziers` arrays** and transmits the full `worldDeltas` payload to **every connected client**.
  3. **Client-Side All-Chunk Invalidation Bug**: When a client receives `msg.worldDeltas`, `WorldDeltaOverlay.replaceFromSnapshot` (`worldDeltas.ts:174-186`) calls `collectExistingDirtyChunks` + `applyReplacedDepletedAndBraziers` and **increments `chunkRevs` for EVERY chunk that has ANY delta** (not just chunks whose deltas actually changed!). As a result, `ChunkRenderer.syncChunkRow` (`chunkRenderer.ts:80`) **unmounts, destroys, and re-bakes every modified chunk near Player A** (including all its tilemaps, props, and cliff strips!) whenever Player B chops a tree `5,000` tiles away!
  - **At 10× Scale**: `1,100` explored POIs = **`594,000` chest slot clones/sec** on the server; `5,000` player-built camp walls + `1,000` depleted trees with `50` players chopping/building = **`50 × 6,000` delta records serialized every second** + constant client frame stutters from spurious chunk remounts.
- **Proposed Fix**:
  1. **Lazy POI Chest Materialization**: Deterministically seed untouched POI chest contents from `(worldSeed, poi.id)` on first `openChest` (or synthesize lightweight unopened `WorldChestSnapshot` headers directly from `cache.poisNear(px, py)` without `27`-slot arrays — which also stops leaking unopened chest contents to clients!). Persist in `LootManager.chests` **only** chests that have been opened or player-placed, indexed by `chunkKey`.
  2. **Incremental / Chunk-Scoped World Deltas**: Emit incremental `worldDeltaOps` (`upsertDepleted`, `restoreProp`, `upsertStructure`, `removeStructure`, `lightBrazier`) to nearby clients (sending full chunk deltas only on chunk subscription), and in `replaceFromSnapshot` diff old vs. new per-chunk state so `bumpKey(this.chunkRevs, k)` fires **only** for chunks whose effective delta set actually changed.

---

#### `PERF-23` · High — `O(E²)` Wildlife AI Pairwise Scans, Uncached 9-Chunk Obstacle Queries, & Uncapped POI Guard Accumulation
- **Subsystem**: Server Wildlife Ecology & AI (`WorldEcology`, `factionTargeting`, `creatureBehaviors`, `creatureNavigation`)
- **Locations**:
  - [packages/game-server/src/sim/wildlife/worldEcology.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/worldEcology.ts#L55-L77), [lines 90, 208–216, 257–267](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/worldEcology.ts#L257-L267)
  - [packages/game-server/src/sim/wildlife/factionTargeting.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/factionTargeting.ts#L139-L159), [lines 228–244](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/factionTargeting.ts#L228-L244)
  - [packages/game-server/src/sim/wildlife/creatureBehaviors.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/creatureBehaviors.ts#L22-L49)
  - [packages/game-server/src/sim/wildlife/creatureNavigation.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/creatureNavigation.ts#L256-L275)
  - [packages/engine/src/world/collision.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/collision.ts#L76-L91)
- **Evidence & Quantified Impact**:
  - `WorldEcology.list` is a flat unindexed array. On **every 50 ms tick**, for each living entity `e` in `this.list`:
    1. `scanAlliesAndCorpses` (`factionTargeting.ts:243`) scans **all `allEntities` up to twice** (`noticeBuddy` + `noticeCorpse`, firing `hasElevationLineOfSight` tile raycasts).
    2. `findBestHostileTarget` → `findBestEntityTarget` (`lines 139-150`) scans **all `allEntities` again** (firing `canSeeCandidate` LOS raycasts against every hostile-faction entity within `maxDist`).
    3. `combineSepCohesion` (`creatureAi.ts:75-79`) scans **all `allEntities` twice more** (`computeSeparation` + `computeSlimeCohesion`).
    4. Every moving creature calls `computeObstacleAvoidance` (`creatureNavigation.ts:263` → `cache.blockingObstaclesNear(e.x, e.y)`, allocating & concatenating 9 chunks' obstacle arrays) **and then immediately calls `resolveMovement`** (`collision.ts:240` → `cache.blockingObstaclesNear(e.x, e.y)` allocating & concatenating the exact same 9 chunks' obstacle arrays a second time!).
  - Additionally, `spawnPoiEncounter` (`worldEcology.ts:55-77`) **ignores `AI_TUNING.maxActiveWildlife`**, so spread-out players near POIs can spawn unbounded numbers of POI guards/elites.
  - **At 10× Scale**: `600` active creatures across overworld + dungeon instances = **`5 × 600² = 1,800,000` entity pair checks + `1,200` 9-chunk obstacle array concatenations + thousands of LOS raycasts every 50 ms (`36M` pair checks/sec)**, consuming `20–45 ms` per tick.
- **Proposed Fix**:
  - Maintain a **per-tick `SpatialHashGrid<WildlifeEntity>` (cell size `16` tiles)** rebuilt in `O(E)` at the start of `WorldEcology.step`: `scanAlliesAndCorpses` (`r ≤ 9`), `findBestEntityTarget` (`r ≤ visionRange`), `computeSeparation` (`r < 1`), and `computeSlimeCohesion` (`r < 7.5`) then query only `1–4` local cells (`O(E × k_local)` with `k_local ≈ 4–10` instead of `O(E²)`).
  - Pass a shared `obstaclesNear` slice (or query a chunk-level `4×4`-tile sub-grid on `WorldChunk`) into both `computeObstacleAvoidance` and `resolveMovement`, and hibernate idle/unaggroed AI ticks (`5 Hz` perception/patrol when `>36` tiles from any player).

---

#### `PERF-24` · Medium — `WorldWebNetwork` Calls `cache.propsNear` (9 Chunks) per Web Strand Every Tick & Leaks Disconnected `prevPos` Entries
- **Subsystem**: Server Cobweb Cloth Simulation (`WorldWebNetwork`)
- **Locations**:
  - [packages/game-server/src/sim/webs/webNetwork.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/webs/webNetwork.ts#L14), [lines 133–159](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/webs/webNetwork.ts#L133-L159), [lines 192–204](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/webs/webNetwork.ts#L192-L204)
- **Evidence & Quantified Impact**:
  - Whenever any spider web exists (`up to 96` nodes / `~192` strands), `stepFirePropagation` (`webNetwork.ts:149-150`) calls `igniteStrandIfWarm` → `hasHeatSourceNear` → **`opts.cache.propsNear(mx, my)` on every unlit strand every 50 ms tick**.
  - Each `propsNear` allocates a new array concatenating **9 chunks' `ChunkProp[]` (`~500–1,500` props)** = up to **`192` array allocations and `~190,000` prop distance checks per tick (`3.8M/sec`)** just to check if a static campfire is within `2.4` tiles of a stationary web strand!
  - Additionally, `this.prevPos` (`Map<string, { x: number; y: number }>`, line `14`) inserts `{ x: p.x, y: p.y }` every tick per player (`line 197`) and **never deletes disconnected player IDs**.
  - **At 10× Scale**: Raising `MAX_WEB_NODES` for spider lair dungeons (`Phase 9–10`, e.g., `1,000+` strands) turns `stepFirePropagation` into a **`3–8 ms/tick` CPU hog** doing `2M` static prop scans per tick.
- **Proposed Fix**:
  - Cache `nearStaticCampfire: boolean` on each `WebStrand` when created (rechecking only if `cache.deltaRevision()` changes!), or collect active campfires near web clusters once per tick; mutate `prevPos` coordinates in place (`prev.x = p.x; prev.y = p.y`) and add `removePlayer(id)` called from `CombatWorld.removePlayer`.

---

#### `PERF-25` · Medium — Synchronous Full-World `JSON.stringify` on Main Event Loop in `WorldPersistenceStore.maybeFlush` & Unbounded `savedProfiles` RAM
- **Subsystem**: Server Persistence (`WorldPersistenceStore`, `WorldSim`)
- **Locations**:
  - [packages/game-server/src/sim/survival/persistenceStore.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/survival/persistenceStore.ts#L89-L97)
  - [packages/game-server/src/sim/survival/worldPersistenceSync.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/survival/worldPersistenceSync.ts#L36-L60)
  - [packages/game-server/src/sim/worldSim.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/worldSim.ts#L42), [lines 102, 207–208](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/worldSim.ts#L207-L208)
- **Evidence & Quantified Impact**:
  - Every `10 s` when `dirty === true` (which is **continuous** whenever any player moves/loots/crafts or resources deplete), `WorldSim.step` calls `persistence.maybeFlush`, which runs `buildFullWorldSaveSnapshot()` (cloning every `savedProfiles` entry ever created, every registered chest, every structure, and every depleted node) and **`JSON.stringify(...)` synchronously inside the 20 Hz tick** before handing the string to `fs/promises.writeFile`.
  - Furthermore, `WorldSim.savedProfiles` (`Map<string, PersistedPlayerRecord>`) keeps **every historical player profile in Node.js heap RAM forever**, re-cloning and re-serializing all inactive historical players on every 10-second flush!
  - **At 10× Scale**: `10,000` registered player profiles (each with 36 slots + hundreds of `discoveredPoiIds`) + `5,000` chests + `20,000` camp structures produce a `30–80 MB` JSON object whose synchronous `buildSnapshot()` + `JSON.stringify()` **blocks the Node.js event loop for `150–450 ms` every `10 s`**, causing periodic server-wide rubberbanding spikes (and `writeFile` `.tmp` rewrites wear container/volume IOPS).
- **Proposed Fix**:
  - Migrate world & player persistence to **SQLite (`better-sqlite3` / `node:sqlite` in WAL mode)** with per-entity dirty-row upserts (`players`, `chests`, `structures`, `depleted_props`) so only modified records are written per flush in `<1 ms`, and evict offline `savedProfiles` from heap RAM after persisting on `removePlayer`. (See `05-SCALABILITY-AND-MODULE-ORGANIZATION.md` for target persistence schema.)

---

#### `PERF-26` · Low — Per-Tick Linear `ecology.list` & `9`-Chunk `propsNear` Scans in `ProjectileSim` and Duplicate Campfire Scan in `ScentTrail`
- **Subsystem**: Server Projectiles & Scent Simulation
- **Locations**:
  - [packages/game-server/src/sim/wildlife/projectileSim.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/projectileSim.ts#L115-L128), [lines 197–200, 224](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/projectileSim.ts#L224)
  - [packages/game-server/src/sim/wildlife/scentTrail.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/scentTrail.ts#L67-L72), [line 168](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/scentTrail.ts#L168)
  - [packages/game-server/src/sim/worldSim.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/worldSim.ts#L218)
- **Evidence & Quantified Impact**:
  - Every arrow/pebble in flight linearly scans `ecology.list` (`hitWildlife`) and calls `cache.propsNear(pr.x, pr.y)` (allocating a 9-chunk `ChunkProp[]` array on line `224`) every tick instead of checking only the `1–2` chunks intersected by segment `(x0, y0) → (pr.x, pr.y)`.
  - `ScentTrail.sampleSinglePlayer` (`scentTrail.ts:168`) calls `hasNearbyCampfire` → `cache.propsNear(p.x, p.y)` (9 chunks) for every player outside Sanctuary every tick — even when `computeCrumbProfile` won't emit a crumb yet (`moveTimer < 0.45 && dist < 0.9`) AND even though `WorldSim.stepPlayer` (`worldSim.ts:218`) **already computed `isPlayerNearCampfire(this.cache, p.x, p.y)`** earlier in the exact same tick!
  - **At 10× Scale**: Ranger/archer volleys + projectile traps/spells (`50–100` active projectiles) and `100` players add `150–200` redundant 9-chunk `ChunkProp[]` array allocations (`~150,000` prop iterations) every 50 ms tick.
- **Proposed Fix**:
  - In `stepArrowProjectile`, query `cache.getChunk(cx, cy).props` only for the `1–2` chunks touched by the swept ray segment and query the `SpatialHashGrid` (`PERF-23`) for `hitWildlife`.
  - In `ScentTrail.sampleSinglePlayer`, evaluate `ready` (`dist >= 0.9 || moveTimer >= 0.45` / `stillTimer >= 1.2`) *before* `hasNearbyCampfire`, or pass the already-computed `nearCampfire` boolean from `WorldSim.stepPlayer`.

---

## Prioritized Remediation Roadmap

1. **Immediate Zero-Risk Wins (1–2 Hours)**:
   - Delete/relocate `packages/client/public/assets/packs/**` (`-40.06 MB`) + orphaned public files, minify `player-rig.json` (drop dead `sockets`) & `sprite-manifest.json` (`-297 KB` JSON), and gate `sourcemap` + `soundStudio` in `vite.config.ts` (`PERF-01`, `PERF-02`, `PERF-03`).
   - Fix `WaterSurfaceEffect` / `FoliageWindEffect` `filter.enabled = false` bypass and skip empty chunk water meshes (`PERF-08`).
   - Cache `canvas` rect via `ResizeObserver` (`PERF-13`), remove `elementFromPoint` from canvas `pointermove` (`PERF-14`), split `VitalsBar` stealth SVG fingerprint (`PERF-15`), and attach `detachAudioNodesOnEnded` + voice cap in `vocalSynth.ts` / `AudioEngine` (`PERF-17`, `PERF-18`).
   - Remove out-of-tick `BROADCAST_ACTIONS` snapshot amplification + AOI-filter `players` + replace `JSON.stringify(inv)` with `inventoryRev` (`PERF-21`).
2. **Pre-Phase-8 Engine & Renderer Foundations (1–2 Days)**:
   - Pre-sample `1,024` tiles + 2D prefix sum in `generateChunk` / `findChunkPoi` (`65×` faster) and raise server `WorldChunkCache` capacity (`PERF-19`), plus dedicated `MinimapTileCache` thumbnails (`PERF-16`).
   - Rasterize `grid.props` into a `side × side` A* cost grid (`>130×` faster pathfinding, `PERF-20`) and add `SpatialHashGrid` for `WorldEcology` (`PERF-23`).
   - Lazy-materialize POI chests + emit incremental chunk-diffed `worldDeltas` (`PERF-22`).
3. **10× Content & Population Scale Architecture (Phases 8–12)**:
   - Tight-pack `.webp` hero layers at bake time, lazy-load equipment layers on demand, move hero recolor/sel-out off the main thread (`BufferImageSource` / GPU shader / Worker), and pin active `PlayerView` sprite sets (`PERF-04`, `PERF-05`).
   - Pack all procedural props & cliff tiles into shared GPU atlases + frustum-cull `ChunkRenderer` + lazy `EntityView` sub-nodes (`PERF-06`, `PERF-07`, `PERF-09`, `PERF-10`).
   - Move server persistence from monolithic `JSON.stringify` rewrite to SQLite WAL (`PERF-25`).
