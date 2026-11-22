# Overworld Wildlife & Ecological POIs (`packages/game-server/src/sim/wildlife`)

Authoritative simulation of living forest wildlife, cognitive AI states, and deterministic POI landmarks:
- **`creatureSpecs.ts`**: Archetype combat/sensory definitions (`wolf`, `bear`, `spider`, `boar`, `slime`, `goblin`, `orc`, `skeleton`, `golem`) and `WildlifeEntity` state contract.
- **`scentTrail.ts`**: Timed scent-crumb buffer dropped by active or bleeding players outside Sanctuary.
- **`creatureBehaviors.ts`**: Specialized steering, ally separation (`computeSeparation`), combat stand-off spacing (`stopRadius` + close facing lock), and attack behaviors (Wolf pack flank ring, Grizzly Bear scavenging/feeding, Wild Boar mid-range telegraphed charge + close-range tusk gore melee + cooldown spacing, Forest Spider stealth ambush, Slime bounce, and POI guards).
- **`creatureAi.ts`**: Shared perception pipeline (elevation-aware LOS, vision cone, hearing, corner-peeking last-known-position investigation, Sanctuary safety leash, corpse decay).
- **`worldEcology.ts`**: Spawning around loaded chunks, `debugSpawnNearPlayer`, chest interactions & magnetic enemy loot collection, and alert propagation.
