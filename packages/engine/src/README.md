# `@dc2d/engine`

Platform-free TypeScript simulation core shared by `@dc2d/client` and
`@dc2d/game-server`. Must never import Node built-ins, `phaser`, `ws`, or other
`@dc2d/*` packages (enforced by `eslint.config.js`).

## Module Layout

- `core/` — Shared constants (`CHUNK_SIZE`, `STEP_UP`, `WALL_RISE`), deterministic
  PRNG (`rng.ts`), math/timing primitives.
- `world/` — Finite-floor world generation, chunk slicing (`32×32`), tile/terrain
  planes, stairs, room isolation, and line-of-sight perception. See
  [world/README.md](world/README.md).
- `entities/` — Player, enemy, pet, and item physics, movement, collision, and
  AI state.
- `combat/` — Melee/ranged hit detection, hurtboxes, cooldowns, and damage
  resolution.
- `effects/` — Data-driven effect primitives, status effects, area effects, and
  elemental interactions.
- `navigation/` — Grid transition checks and pathfinding across height changes
  and stairs.
- `net/` — Zod-validated client/server WebSocket protocol schemas and snapshots.
- `debug/` — Deterministic diagnostics and movement/trace utilities.
