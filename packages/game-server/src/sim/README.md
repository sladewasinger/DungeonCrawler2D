# Game Server Simulation (`packages/game-server/src/sim`)

Authoritative 20 Hz overworld simulation root coordinating player kinematics, combat, inventory, survival, webs, wildlife, and overworld exploration:

- `worldSim.ts` & [`zones/`](./zones/README.md): Core `WorldSim` tick-queued loop stepping active zones (`ZoneManager`/`ZoneInstance`), survival buffs, stealth exposure, chat, combat world, and world persistence flushes.
- `combatSim.ts` & `combatActions.ts`: Damage mitigation, dodge/parry resolution, status DoTs, chest/loot interactions, and sanctuary rules.
- `dummySim.ts`: Training/sparring dummies and respawn handling in the spawn glade.
- `playerInventory.ts`: Server-side 36-slot inventory validation, armor swaps, campfire/workbench crafting, and drop locking.
- **Subsystems**: [`admin/`](./admin/README.md), [`combat/`](./combat/), [`exploration/`](./exploration/README.md), [`persistence/`](./persistence/README.md), [`survival/`](./survival/README.md), [`webs/`](./webs/README.md), [`wildlife/`](./wildlife/README.md), [`zones/`](./zones/README.md), and `chat/` (`proximityChat.ts`).
