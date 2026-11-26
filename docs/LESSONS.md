# Engineering Lessons & Pitfalls

Concise, durable technical gotchas discovered in this repository. Keep architecture and module docs in the `README.md` nearest the code instead of adding feature docs here.

## TypeScript & Contracts

- **Respect `exactOptionalPropertyTypes`**: Omit optional properties when values are `undefined` instead of passing `{ key: undefined }`; preserve explicit `null` only where `null` is part of the contract.
- **Keep domain contracts in `@dc2d/contracts` and declarative catalogs in `@dc2d/content`**: Put shared IDs, unions, `PROP_KIND_VALUES`, `ARMOR_SLOT_KEYS`, and `PROP_SPECS` in Tier 1/2 instead of duplicating `Set`/enum tables across `engine`, `game-server`, and `client`.
- **Use const-tuples instead of `export const enum` under `isolatedModules: true`**: `GroundKind` and `PropKind` are frozen `as const` objects backed by tuple arrays so `vite`, `esbuild`, and `zod` iterate them cleanly without unsafe casts.
- **Keep folder-size and complexity caps green**: `scripts/check-folder-size.mjs` caps non-test production files at `12` per folder (`<= 250` lines/file, `<= 35` lines/function, max nesting `3` in `eslint.config.js`) and requires colocated `README.md` files for feature directories.

## Async Loading & Testing

- **Test invariants, not magic tuning literals or coordinates**: Assert behavioral invariants (reachability, feature counts, conservation, finiteness) with seeded scenarios and `fast-check` properties instead of hard-coding tuning constants or world cell coordinates.
- **Watch sibling workspace sources in Vite**: Add `packages/contracts/src`, `packages/engine/src`, and `packages/content/src` to `server.watcher` (with `optimizeDeps.exclude` and `server.fs.allow`) in [vite.config.ts](../packages/client/vite.config.ts) so edits to shared workspace exports invalidate `/@fs/...` HMR modules reliably.

## Rendering & PixiJS v8

- **Call `.beginPath()` before standalone `.arc()` or `.moveTo()` subpaths on shared `Graphics`**: PixiJS v8 `GraphicsContext._initNextPathLocation()` reseeds `_activePath` with `moveTo(lastX, lastY)` after each `.stroke()`/`.fill()`, and primitives like `.circle()`, `.ellipse()`, and `.roundRect()` leave `(0, 0)` as the last subpath point. Calling `.arc()` without `.beginPath()` connects `(0, 0)` into the subsequent polygon.
- **Keep every uploaded WebGL2 texture `<= 4096 × 4096` (prefer tight-packed trimmed `<= 2048 × 2048` tiers)**: Mobile GPUs (including Pixel/Tensor PowerVR and older Mali/Adreno chips) cap `GL_MAX_TEXTURE_SIZE` at `8192` or `4096` while desktop GPUs allow `16384`. Always skip empty grid cells, trim transparent frame margins per clip with PixiJS `orig`/`trim`, and split heavy sheets into tight-packed `<= 1536 × 1536` lazy tiers before `Texture.from(...)`.
- **Pass `{ texture: true, textureSource: true }` when destroying dynamically baked PixiJS v8 sprites**: Calling `sprite.destroy({ texture: true })` leaves the underlying GPU `TextureSource` allocated in WebGL2 VRAM. For ephemeral procedural textures (such as elevated cliff strips in `ChunkRenderer.unmountChunk`), include `textureSource: true`, and pass `destroy(true)` on expired dynamic `Text` popups so text styles and canvases are freed together.

## UI, Inventory & Gameplay Gotchas

- **Guard per-frame `sync()` DOM builders with strict render fingerprints**: Never call `replaceChildren()` unconditionally inside a `requestAnimationFrame`-driven `sync()` (e.g. `ItemCardPopover`); rebuilding interactive buttons every ~8ms drops clicks before `click` fires.
- **Keep `PendingGate` resolution symmetrical across sparse snapshots**: When optional snapshot fields (like `selfInventory`) are omitted on server no-op acks, still resolve the matching gate on `actionAckSeq` so optimistic UI gates never wedge until timeout.
- **Lock dropped items against auto-magneting back to the dropper while looting chests**: Player drops near a chest spawn inside the `lootMagnetRadiusTiles` radius; keep `dropLockActive` on the dropper until they step out of magnet range or explicitly interact to pick it up.
- **Use shared category predicates (`isBowItem`, `isShieldItem`) instead of starter item IDs**: Hardcoding `"bow"` or `"wooden-shield"` breaks higher-tier frontier weapons and shields across input, prediction, combat, and visuals.
- **Never swallow server `interactQueued` when client `onInteract` also handles local UI**: Client-side interact hooks must return whether a modal/pickup consumed `[E]` and forward unhandled `[E]` presses to the server simulation for Shrines, Waystones, Braziers, Lore Signs, and Beds.
- **Cache Overworld Map POI scans & throttle redraws**: Scanning multi-chunk POI lists and blitting canvas terrain every `120Hz` frame tanks frame rate; memoize POI windows and redraw on tile change or throttled intervals.

## Tooling & CI Workflows

- **Pass `gh pr create` / `gh pr edit` descriptions via `--body-file` on Windows PowerShell**: Double-quoted `--body "..."` strings interpret PowerShell backtick escapes (e.g., `` `v `` becomes `\u000B` vertical tab in PR descriptions) and mangle markdown backticks; write UTF-8 markdown to a file and pass `--body-file`.
- **Back-merge `main` into `develop` after squash releases and verify `mergeable`**: After any squash-merged PR into `main`, `git merge-base origin/main origin/develop` lags behind `main` and triggers 3-way conflicts on the next PR touching shared files; sync `develop` with `origin/main` (or branch `hotfix/*` off `origin/main`) and check `gh pr view <num> --json mergeable,mergeStateStatus` immediately after creating a PR.
