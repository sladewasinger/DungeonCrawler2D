# reference/ — the v1 codebase, frozen

This folder is the **read-only carcass of the v1 implementation** (engine, game-server,
client, content JSON, e2e specs). It is not built, not imported, not linted, and never
edited. It exists for exactly one purpose: when rebuilding a system, consult the v1
version for **proven logic and hard-won invariants** — then write a cleaner version from
scratch in `packages/`.

Load-bearing ideas that must survive the rebuild (do not lose these):

- **The effects layer system** (`engine/effects/`, `engine/areas/`, `content/`):
  effect *primitives* (modify_health, apply_status, spawn_area, …) composed into
  data-defined statuses (bleeding, on-fire, wet, …), tag-driven *interaction rules*
  (fire + wet ⇒ steam) run to a bounded fixpoint, and tile-region *area effects* with
  height-aware spread. Nothing is a special case; "sanctuary" is a zone tag plus one
  rule. This is what lets an LLM invent brand-new items at runtime — new content is
  data validated against the same schemas, never new code.
- **Determinism** (`engine/world/`): chunk geometry byte-identical from
  `(worldSeed, floor, chunkCoord)` on every machine — a networking invariant, tested.
- **Layout first, height second** (`engine/world/`): the dungeon generates flat;
  height is only added by deliberate features (walls +2, platforms, terraces).
- **Netcode shape** (`client/net/`, `game-server/`): intents up, events down,
  prediction only for your own body, AOI replication, zod-validate everything.

Rules:

1. **Never import from `reference/`.** No tsconfig path, no relative import, nothing.
2. **Never edit files here.** If v1 had a bug, fix it in the new code only.
3. **Copy ideas, not files.** New modules must meet `docs/ENGINEERING_STANDARDS.md`
   (v1 predates the 200-line cap and will fail it).
