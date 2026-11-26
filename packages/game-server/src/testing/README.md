# @dc2d/game-server — Deterministic Scenario Test Harness

Headless in-memory simulation harness (`SimScenario`) wrapping `WorldSim` with zero socket overhead and zero wall-clock sleeps.

## Modules
- [simScenario.ts](./simScenario.ts) — Fluent `SimScenario` API (`create`, `joinPlayer`, `sendInput`, `sendAction`, `tick`, `stepSeconds`, `rebootFromPersistence`, `dispose`).
- [simScenario.test.ts](./simScenario.test.ts) — Deterministic movement, crafting/equip actions, and persistence reboot continuity tests.
