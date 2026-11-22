# `@dc2d/engine`

Platform-free, deterministic core simulation logic (`zod` only; zero Node built-ins and zero renderer imports):
- Seeded noise & deterministic infinite chunk generation (`src/math/`, `src/world/`)
- Time-of-day lighting & cast-shadow curve sampling (`src/time/`)
- True 36-slot inventory data structures (`src/inventory/`)
- Zod client/server WebSocket protocol schemas (`src/net/`)
