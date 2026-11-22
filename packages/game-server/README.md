# `@dc2d/game-server`

Authoritative 20 Hz multiplayer server built on Node + `ws`:
- Evaluates infinite deterministic terrain via `@dc2d/engine`
- Drives authoritative player movement, synced Day/Night clock, and action handling
- Broadcasts snapshots over WebSocket and bundles to `dist/main.cjs`
