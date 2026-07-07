# Dungeon Crawler 2D

A browser-based, top-down 2D dungeon crawler built with **Phaser 3 + TypeScript + Vite**.

The core hook: a fully data-driven effects engine (buffs, debuffs, area effects, item behaviors) that lets an **AI crafting system** invent brand-new items at runtime. The game never hard-codes a "molotov cocktail" — but if a player combines a rag and a vodka bottle at their crafting table, an AI API composes one from the engine's existing effect primitives, and the engine validates and accepts (or rejects) it. Accepted items become craftable for everyone.

Art style: minimal top-down pixel art ("pixel art +"), tonally in the direction of Don't Starve but far simpler.

## Documents

| Doc | Purpose |
| --- | --- |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Epics, goals, and release timeline from empty repo to v1.0 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Tech stack, code organization, core engine systems |
| [docs/EFFECTS.md](docs/EFFECTS.md) | The generic effect model: status effects, area effects, interactions |
| [docs/AI_CRAFTING.md](docs/AI_CRAFTING.md) | AI crafting pipeline: prompt → item proposal → validation → shared registry |

## Status

Pre-development. Planning docs are under review; implementation of Release v0.1 (engine scaffold + procedural dungeon generation) begins on approval.

## Getting started (once v0.1 lands)

```bash
npm install
npm run dev     # Vite dev server
npm run build   # production build
npm run test    # unit tests (vitest)
```
