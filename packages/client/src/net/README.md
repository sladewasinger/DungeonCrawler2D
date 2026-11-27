# Client Networking & Prediction (`packages/client/src/net`)

Client WebSocket transport, local movement/swing prediction, entity interpolation, and offline fallback simulation:

- `worldClient.ts` & `worldClientHelpers.ts`: Authoritative server sync with seamless automatic offline preview fallback (`Local` mode) and server delta patching.
- `socket/` (`worldClientSocket.ts`, etc.): Reconnecting WebSocket wrapper with persisted local session credentials and latency ping measurement.
- `worldPrediction.ts`: Client-side movement reconciliation against server sequence acks (`lastAckSeq`).
- `localSwingTracker.ts`: Responsive 3-phase melee windup/active/recovery prediction synced with weapon movesets.
- `clientInventory.ts`, `actionGate.ts`, `remoteInterp.ts`, `characterPrefs.ts`: Optimistic inventory UI gating (`PendingGate`), snapshot interpolation for remote actors, and persisted hero preferences.
