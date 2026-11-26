# Client Networking & Prediction (`packages/client/src/net`)

Client WebSocket transport, local movement/swing prediction, entity interpolation, and offline fallback simulation:

- `worldClient.ts` & `worldClientHelpers.ts`: Authoritative server sync with seamless automatic offline preview fallback ([`offline/`](./offline/README.md)) and server delta patching.
- `hubClientBridge.ts`: Synchronizes Fog-of-War bitset deltas (`selfFogDelta`), Gold, Sanctuary Stash (`27` slots), Bounties, Quests, and NPC UI callbacks across server and offline modes.
- `offlinePersistence.ts`: Seed-keyed `localStorage` offline snapshots (`dc2d_offline_world_v1_<seed>`) with 5s throttled saves and synchronous `beforeunload` flush.
- `socket/` (`worldClientSocket.ts`, etc.): Reconnecting WebSocket wrapper with persisted local session credentials and latency ping measurement.
- `worldPrediction.ts`: Client-side movement reconciliation against server sequence acks (`lastAckSeq`).
- `localSwingTracker.ts`: Responsive 3-phase melee windup/active/recovery prediction synced with weapon movesets.
- `clientInventory.ts`, `actionGate.ts`, `remoteInterp.ts`, `characterPrefs.ts`: Optimistic inventory UI gating (`PendingGate`), snapshot interpolation for remote actors, and persisted hero preferences.
