# Overworld Wildlife & Ecological POIs (`packages/game-server/src/sim/wildlife`)

Authoritative simulation of living forest wildlife, cognitive AI states, and deterministic POI landmarks:
- **`creatureSpecs.ts`**: Archetype combat/sensory/territorial definitions (`wolf`, `bear`, `spider`, `boar`, `slime`, `goblin`, `orc`, `skeleton`, `golem`) and `WildlifeEntity` state contract.
- **`scentTrail.ts`**: Timed scent-crumb buffer dropped by active or bleeding players outside Sanctuary.
- **`creatureBehaviors.ts`**: Specialized steering, ally separation (`computeSeparation`), combat stand-off spacing, calm idle-pause patrol rhythms with clear waypoint sampling (`golem` holds stationary sentry idle), and attack behaviors (Wolf pack flank ring, Bear scavenging/feeding, Boar charge + tusk gore, Spider ambush in forest cover/nighttime).
- **`creatureNavigation.ts`**: Bounded A* pathfinding cache (`findTilePath`) with 1-tile platform jumping, tangential + radial `BlockingObstacle` avoidance (chests, campfires, dual-circle tents, props), `isClearSpot` spawn/patrol validation, velocity-aligned facing sync, and damped knockback velocity physics.
- **`creatureAi.ts`**: Shared perception pipeline (elevation-aware LOS, vision cone, hearing), outrun disengage for roaming enemies vs territorial chest-guard leashing for `orc` & `golem` (both re-engaging immediately when players re-enter range/territory), unreachable-ledge `2.5s` disengage, and Sanctuary safety.
- **`worldEcology.ts`**: Validated POI guard & wildlife spawning (verifying obstacle clearance and reachable courtyard exits), `debugSpawnNearPlayer`, chest interactions & magnetic enemy loot collection, and alert propagation.
