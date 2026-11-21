# `@dc2d/game-server`

Authoritative Node + WebSocket (`ws`) multiplayer game server. Depends on
`@dc2d/engine` and `@dc2d/content` and stays headless (no Phaser or `@dc2d/client`).

## Module Layout

- `main.ts` — Process entry point, environment config parsing, startup wiring.
- `server/` — WebSocket transport, connection lifecycle, authentication/admin
  endpoints, operational event sinks, and spectator broadcast.
- `floors/` — Lazy floor registry (`registry/`), background worker preparation
  (`floorPreparationWorker*.ts`), and disk/memory floor artifacts.
- `runtime/` — Active server runtime orchestration across floors and rooms.
- `sim/` — Tick-driven authoritative simulation: player inputs, enemy AI,
  combat, loot/items, effects, status ticks, and companion pets.
- `store*.ts` — File-backed persistent player state (`STORE_FILE`), stashes,
  and versioned schemas.
