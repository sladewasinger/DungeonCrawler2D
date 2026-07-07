# Dungeon Crawler 2D

A browser-based, top-down 2D **real-time co-op multiplayer** dungeon crawler (PvE parties of 1–4) built with **Phaser 3 + TypeScript + Vite** on the client and a server-authoritative Node simulation sharing the same pure engine code.

The core hook: a fully data-driven effects engine (buffs, debuffs, area effects, item behaviors) that lets an **AI crafting system** invent brand-new items at runtime. The game never hard-codes a "molotov cocktail" — but if a player combines a rag and a vodka bottle at their crafting table, an AI API composes one from the engine's existing effect primitives, and the engine validates and accepts (or rejects) it. Accepted items become craftable for everyone.

Art style: minimal top-down pixel art ("pixel art +"), tonally in the direction of Don't Starve but far simpler.

## Documents

| Doc | Purpose |
| --- | --- |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Epics, goals, and release timeline from empty repo to v1.0 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Tech stack, code organization, core engine systems |
| [docs/EFFECTS.md](docs/EFFECTS.md) | The generic effect model: status effects, area effects, interactions |
| [docs/AI_CRAFTING.md](docs/AI_CRAFTING.md) | AI crafting pipeline: prompt → item proposal → validation → shared registry |
| [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | AWS serverless architecture, Terraform layout, cost estimates |

## Status

Pre-development. Planning docs are under review; implementation of Release v0.1 (scaffold + procedural dungeon generation + real-time multiplayer core) begins on approval.

## Getting started (once v0.1 lands)

```bash
npm install
npm run dev     # Vite client + local game server together
npm run build   # production builds (client bundle + server bundle)
npm run test    # unit + headless protocol tests (vitest)
```
