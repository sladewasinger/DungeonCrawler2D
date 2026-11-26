# Sanctuary Hubs, Economy & Bounties (`packages/game-server/src/sim/hubs`)

Server-authoritative Sanctuary Hub services shared across `WorldSim` and `wsSession`:

- `stashManager.ts`: Per-account `27`-slot Sanctuary Stash container manager with atomic cross-container transfers and strict player isolation (`[REQ-P9-06]`).
- `bountyTracker.ts`: Seeded rotating `3`-Bounty Board & `>= 4` Floor Guide side-quests with live kill/discovery/chest/waystone counters and atomic reward claiming (`[REQ-P9-12]`, `[REQ-P9-13]`).
- `npcManager.ts`: Proximity-validated Merchant buy/sell (`[REQ-P9-08]`, `[REQ-P9-09]`) and Blacksmith prefix reforge & `+1..+3` upgrade execution (`[REQ-P9-10]`, `[REQ-P9-11]`).
