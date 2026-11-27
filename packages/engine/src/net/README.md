# Engine Network Protocol (`packages/engine/src/net`)

Authoritative Zod wire protocol schemas (`PROTOCOL_VERSION = 1`) and typed packet snapshots shared between `@dc2d/game-server` and `@dc2d/client`:

- `protocol.ts`: Core `ClientMessageSchema` / `ServerMessageSchema`, auth handshake (`ClientHelloSchema`), inputs, inventory, combat, and world snapshots.
- `worldDeltaSchemas.ts`: Seeded `PROP_KIND_VALUES` validation (`PropKindSchema`), `WorldDeltaSnapshotSchema`, placement, respawn-bed, and loot pickup schemas.
- `worldEventSchemas.ts`: `GoreStyleSchema`, `GoreSubstanceSchema`, `WorldEventSchema`, and creature vocalization cues.
- `chatSchemas.ts`: Proximity chat constants (`PROXIMITY_CHAT_RADIUS = 16`, `PROXIMITY_SHOUT_RADIUS = 34`, `MAX_CHAT_LENGTH`), bubble, and chat entry schemas.
- `discoverySchemas.ts`: Biome/POI discovery state and Waystone reveal beacon schemas.
- `sessionActionSchemas.ts`: Ping/pong, drop-item, and use-item schemas.
