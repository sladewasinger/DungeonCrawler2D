# Dungeon Crawler 2D — v2

A browser-based, top-down 2D **real-time PvPvE multiplayer** dungeon crawler with a
full height axis, tonally inspired by the Dungeon Crawler Carl series. Players spawn
apart in a vast shared floor-world, fight monsters — and each other, or fistbump
instead — racing for the one-way stairway down. Safety exists only in safe rooms.
The signature system: a fully data-driven effects engine whose closed vocabulary of
primitives, tags, and interaction rules lets an **AI crafting system** invent
brand-new items at runtime, validated like any other content.

This is the **v2 rebuild** of the original prototype (frozen in [reference/](reference/README.md)):
same design, same server-authoritative architecture, rebuilt to a real visual and
engineering bar.

## Documents

| Doc | Purpose |
| --- | --- |
| [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md) | **The constitution.** Hard limits, structure rules, definition of done |
| [docs/VISUAL_DIRECTION.md](docs/VISUAL_DIRECTION.md) | **The beauty bar.** Palette, lighting, motion, UI language, acceptance criteria |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | World & floor lifecycle, verticality, PvPvE rules, safe/stretch rooms, social systems |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Tech stack, package layout, networking model, simulation |
| [docs/EFFECTS.md](docs/EFFECTS.md) | The generic effect model: primitives, statuses, areas, interactions |
| [docs/AI_CRAFTING.md](docs/AI_CRAFTING.md) | AI crafting pipeline: prompt → proposal → validation → shared registry |
| [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | AWS serverless architecture, Terraform layout, cost model |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Epics and release sequencing |

## Getting started

```bash
npm install
npm run dev        # Vite client + local game server together
npm run test       # headless engine + protocol tests (vitest)
npm run typecheck  # strict TS across all packages
npm run lint       # standards enforcement (200-line cap, boundaries)
```

## Status

**v2 core slice in progress:** worldgen, multiplayer, movement/combat, effects
engine, items, and safe rooms at the new visual bar. Parties/chat/AI crafting are
architected (see docs) and land next.
