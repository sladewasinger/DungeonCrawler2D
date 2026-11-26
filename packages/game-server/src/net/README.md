# Game Server WebSocket & Auth (`packages/game-server/src/net`)

Authoritative WebSocket transport, authentication, origin/rate hardening, and AOI snapshot redaction:

- `wsServer.ts`: HTTP `/health` endpoint and `ws` server lifecycle enforcing 20 Hz tick coalescing (`TCP_NODELAY`), payload limits (`16 KiB`), and shutdown flushes.
- `wsSession.ts` & `hubSessionSync.ts`: Per-socket session state, `hello` authentication handshake, single-session eviction (`4001`), Fog-of-War delta streaming, Stash/Bounty/Quest sync, and client action routing.
- `wsSecurity.ts`: Origin validation, per-IP connection limits, sliding-window rate throttling, and structured sanitization helpers.
- `adminAuth.ts`: Constant-time SHA-256 + `timingSafeEqual` verification for `ADMIN_TOKEN`, per-IP lockout, and `ALLOW_OPEN_DEV_ADMIN` dev guard.
- `playerAuth.ts`: Account credential minting (`accountId` + `resumeToken`) and token hash verification (`scrypt`/`SHA-256`).
- `snapshotFilter.ts`: Area-of-interest culling, sealed/unopened POI chest content redaction, and private field stripping per viewer.
