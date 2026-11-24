# Engineering Lessons & Pitfalls

Concise, durable technical gotchas discovered in this repository. Keep architecture and module docs in the `README.md` nearest the code instead of adding feature docs here.

## TypeScript & Contracts

- **Respect `exactOptionalPropertyTypes`**: Omit optional properties when values are `undefined` instead of passing `{ key: undefined }`; preserve explicit `null` only where `null` is part of the contract.
- **Keep domain classifiers shared**: Put terrain material, surface, and semantic precedence in pure shared helpers (e.g. `terrainMaterialRoles.ts`) and consume them from both gameplay and admin/spectator renderers so visual views never drift.
- **Separate canonical and legacy contracts**: Validate canonical finite floors through `finiteFloor.ts` / `sliceGeneratedFloorChunk`, and keep explicit legacy assertions isolated to compatibility wrappers like `generateChunk()`.

## World Generation & Terrain Rendering

- **Never reuse room region IDs in later passes**: When placing or repairing regions, start subsequent ID allocation strictly past the maximum assigned room region ID.
- **Validate admitted rooms, not candidates**: Room entrance registration can drop candidates; enforce admitted counts after entrance registration.
- **Do not pre-union disconnected maze crossings**: Only merge topology regions when physical walkable connections are carved and validated.
- **Survive room-isolation chunks & atlas transitions**: Always admit room-isolation chunks outside finite bounds, and invalidate active terrain roots when atlas readiness changes.
- **Keep worldgen and folder-size rules clean**: `scripts/check-folder-size.mjs` caps new directories at 12 direct source files (and blocks growing legacy folders past their baseline), and `eslint.config.js` caps files at 250 lines and functions at 35 lines.

## Async Loading, Editor & Testing

- **Cancel superseded floor loads**: When a newer floor load begins, cancel/dispose the prior in-flight worker rather than only ignoring its callback.
- **Reset preview state atomically**: Clear prior generation preview state before starting/failing a generation attempt, and recompute stationary hover metadata whenever preview stages switch.
- **Test invariants, not magic tuning literals or coordinates**: Assert behavioral invariants (reachability, feature counts, bounds) with fixture configs instead of hard-coding tuning constants or world cell coordinates.
- **Watch sibling workspace sources in Vite**: Add `packages/engine/src` and `packages/content/src` to `server.watcher` (with `optimizeDeps.exclude` and `server.fs.allow`) in [vite.config.ts](file:///d:/repos/dungeoncrawler2D/packages/client/vite.config.ts) so edits to shared workspace exports invalidate `/@fs/...` HMR modules reliably.

## Rendering & PixiJS v8

- **Call `.beginPath()` before standalone `.arc()` or `.moveTo()` subpaths on shared `Graphics`**: PixiJS v8 `GraphicsContext._initNextPathLocation()` reseeds `_activePath` with `moveTo(lastX, lastY)` after each `.stroke()`/`.fill()`, and primitives like `.circle()`, `.ellipse()`, and `.roundRect()` leave `(0, 0)` as the last subpath point. Calling `.arc()` without `.beginPath()` connects `(0, 0)` into the subsequent polygon.
- **Keep every uploaded WebGL2 texture `<= 4096 × 4096` (prefer tight-packed trimmed `<= 2048 × 2048` tiers)**: Mobile GPUs (including Pixel/Tensor PowerVR and older Mali/Adreno chips) cap `GL_MAX_TEXTURE_SIZE` at `8192` or `4096` while desktop GPUs allow `16384`. Uploading an oversized canvas (such as an unpacked `1152 × 11712` player spritesheet) silently fails with `GL_INVALID_VALUE` and renders an opaque black square in-game even when `192 × 192` Canvas2D portraits work; always skip empty grid cells, trim transparent frame margins per clip with PixiJS `orig`/`trim`, and split heavy sheets into tight-packed `<= 1536 × 1536` lazy tiers before `Texture.from(...)`.
