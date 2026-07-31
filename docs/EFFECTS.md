# Effects System Design

The effects engine is the foundation the whole game—and especially AI
crafting—stands on. Its job is to make what an item or effect does expressible
as validated content wherever the current game supports that safely, while
keeping world authority and physics in the systems that own them.

This document has two deliberate halves:

- **Implemented contract** describes the APIs and content formats that exist
  today and are safe for game code and content authors to use.
- **Planned extensions** preserves the larger design: more composable
  primitives, richer AI-authored effects, and more vertical interactions.
  These ideas are not production capabilities until they move into the first
  section and acquire code, validation, and tests.

## Implemented contract

### Authoritative model

Effects are simulated on the game server as part of the authoritative tick
(see [ARCHITECTURE.md](ARCHITECTURE.md)). The engine mutates authoritative
entities and emits a small set of outcome events—health changes, status
changes, deaths, entity destruction, and area spawns. The server realizes
world-level events and replicates the result. Clients render snapshots and
events; they do not decide whether damage, debuffs, or area reactions happen.

The engine has no direct world-mutation authority. For example,
`spawn_area` emits an event and the server's effects integration places the
area through the authoritative `AreaSystem`.

### Three implemented layers

1. **Effect primitives** — a closed vocabulary implemented in code.
2. **Statuses and areas** — validated content definitions that compose those
   primitives with durations, tags, stacking, channels, and source data.
3. **Interaction rules** — validated content reactions between status tags or
   compound area layers.

The registry parses JSON into typed definitions and cross-checks references
before the simulation starts. Unknown status, area, item, enemy, recipe, or
reaction references are content errors, not runtime surprises.

### Effect primitives

The current primitive catalog is intentionally small:

| Primitive | Parameters | Example use |
| --- | --- | --- |
| `modify_health` | `amount` | bleeding damage, healing, instant damage |
| `modify_stat` | `stat: "speed"`, `mult` | slowed, oiled, wet movement |
| `apply_status` | `status`, optional `chance` | poison blade, fire contact |
| `remove_status` | status tag | remove fire, wet, or oil statuses |
| `spawn_area` | `area`, `radius` | create fire, wet, poison, or smoke |
| `destroy_entity` | no additional parameters | destroy a burned item |

The primitive schema lives in
`packages/engine/src/effects/primitives.ts`. Primitive execution is
deliberately not presented as a pure `(state, params) → state` function: it
uses explicit callbacks to mutate authoritative state and append outcome
events. That keeps the engine decoupled from the server while preserving one
authoritative result.

`modify_stat` is currently a continuous speed multiplier and is evaluated while
its owning status is active. It is not yet a general arbitrary-stat system.
Area spreading, item burning, fall damage, and entity transformation are
implemented by their owning systems around this primitive vocabulary rather
than pretending to be primitives that the schema cannot execute.

### Status effects

Status definitions are data in
`packages/content/src/data/statuses.json` and are validated by
`packages/engine/src/effects/content/statuses.ts`.

The current schema is:

```jsonc
{
  "id": "bleeding",
  "name": "Bleeding",
  "kind": "debuff",
  "tags": ["bleed", "physical"],
  "duration": 8,
  "tickEvery": 2,
  "stacking": "refresh",
  "onTick": [
    { "primitive": "modify_health", "amount": -2 }
  ]
}
```

Supported lifecycle hooks are `onApply`, `onRefresh`, `onTick`, and
`onExpire`. `whileActive` currently accepts continuous stat modifiers.
Statuses may add tags with `appliesTags`, and use `refresh`, `stack`, or
`ignore` stacking behavior with a bounded `maxStacks` where applicable.

The live status set is:

- `bleeding`, `poisoned`, `on-fire`, `slowed`, `oiled`, and `wet`
- `healing` and `regenerating`
- `feather-fall` and `sticky-feet`

Status application checks dead entities, sanctuary, spawn protection or other
target invulnerability, and immunity tags. Damage can also be scaled by source
tags through the server-provided target context. A general content-authored
resistance object is not part of the current status schema.

### Compound area effects

Areas are authoritative tile cells. A cell may contain one layer in each
explicit channel:

- `surface`: water and oil
- `flame`: fire and short-lived flame attacks
- `gas`: poison, smoke, and steam

Each layer retains duration, spread progress, channel priority, and optional
source attribution. Different channels compose, so burning oil is represented
as oil plus fire. Competing layers in the same channel are resolved by
priority. Area placement requires a walkable tile, and hostile areas are
blocked in sanctuary.

The current area definitions are `area-fire`, `area-enemy-flame`, `area-wet`,
`area-oil`, `area-poison`, `area-smoke`, and `area-steam`.

```jsonc
{
  "id": "area-fire",
  "tags": ["fire", "hostile"],
  "channel": "flame",
  "priority": 20,
  "buoyancy": 0,
  "duration": 12,
  "onEnterStatus": "on-fire",
  "spread": {
    "chance": 0.5,
    "ontoAreaTag": "flammable",
    "maxSteps": 6
  },
  "sprite": "fire"
}
```

Spread is cardinal, bounded by `maxSteps`, and checked against walkability,
height, buoyancy, and any required destination tag. The area engine can carry
multiple channel layers, but it does not currently model arbitrary fluid
simulation or continuous slopes.

### Interaction rules

Area reactions live in
`packages/content/src/data/areaReactions.json`. They use tags rather than
hard-coded item IDs and are validated, priority-sorted, and resolved through a
bounded transition process. Current examples include:

- fire consumes oil at an authored rate, allowing oil to remain visible while
  it burns;
- fire and wet become steam;
- steam removes fire.

Area transition actions currently support `remove`, `add`, `transform`, and
`rate_consume`. Runtime transitions are bounded and repeated compound states
are rejected during validation.

Entity status interactions are a related but separate mechanism. They use the
content rules in `packages/content/src/data/rules.json`, currently applying
simple tag matches such as burning plus wet removing fire and wet. Those rules
run to a bounded fixpoint in authored order; they do not yet have the area
reaction system's explicit priority and stable-ID ordering.

### Sanctuary and safe rooms

Safe rooms are protected by the authoritative effects boundaries, but they are
not represented by one universal data rule. The server supplies sanctuary and
spawn-protection context to health, status, and area placement checks:

- hostile health damage is suppressed;
- hostile debuffs are suppressed;
- hostile area placement and spread are rejected;
- healing and beneficial effects continue to work.

This split is intentional: sanctuary is a world/gameplay predicate, while the
effects engine owns the consistent enforcement points.

### Verticality currently in production

Height is already an input to several systems, but vertical gameplay is not
yet entirely authored through effects data:

- `airborne` is a derived entity tag while a body is not grounded;
- grounded area contact skips airborne entities;
- fall damage is calculated by the server movement system from landing height;
- water cancels fall damage through the server landing rule;
- `feather-fall` suppresses fall damage and `sticky-feet` affects movement and
  knockback behavior;
- area buoyancy constrains cardinal spreading by neighboring tile height.

Melee reach, jumping, collision, and landing physics remain geometry and
movement concerns. The current engine does not provide data-defined flying,
buoyancy simulation, or arbitrary height transitions for every effect.

### AI crafting boundary

The current invention pipeline accepts one proposed item and one proposed
recipe. The proposal may reference existing item vocabulary and existing
primitive, status, area, and reaction references through the validated content
schemas. Proposals are staged as `pending_review`, remain non-craftable, and
require moderation, balance, and economy review.

The current pipeline cannot activate generated content and cannot introduce a
new primitive, status, area, or reaction definition by itself. See
[AI_CRAFTING.md](AI_CRAFTING.md) and
`packages/engine/src/effects/content/inventions.ts`.

## Planned extensions

The following preserves the original design direction. It is a target model,
not a description of current runtime behavior.

### A larger closed primitive vocabulary

Add carefully bounded primitives for capabilities that are currently owned by
server systems:

- `add_tags` and `remove_tags` for explicit temporary tags;
- general stat modifiers beyond movement speed;
- `spread` as a reusable authored operation rather than area-engine behavior;
- `transform_entity` for exposure-driven item and actor transformations;
- `spawn_entity` for bounded content-driven spawns;
- `emit_event` for typed quest, audio, and presentation hooks.

Each addition needs a server execution contract, validation bounds, source
attribution rules, and focused tests before it belongs in the implemented
catalog.

### Richer content-authored verticality

The long-term goal is for fall damage, water cancellation, flying, feather
fall, sticky feet, gas movement, and other height interactions to compose from
the same validated vocabulary. The implementation still needs explicit rules
for collision ownership, target height, line of sight, and server physics so
that “data-driven” does not mean “physics hidden in content JSON.”

### AI-composed effects

AI should eventually be able to propose combinations of approved base
statuses, areas, tags, channels, and reaction operations. Any future expansion
must retain:

- no executable code in proposals;
- reference validation against the active registry;
- numeric, duration, spread, and layer-count budgets;
- cycle and termination checks;
- moderation, balance, economy, rollback, and audit history;
- an explicit activation step after review.

New base primitives remain developer-owned. AI may compose approved behavior,
but it should not silently create an unbounded new simulation language.

### Presentation and compound-state visuals

Mechanics and presentation should continue to share IDs and source data, but
the client may use specialized renderers for fire, liquids, poison gas, status
overlays, particles, lighting, and connected-area shapes. A data definition
does not automatically produce a complete visual effect today. Future content
work should specify both the authoritative behavior and the client presentation
contract, with performance budgets for mobile and slow hardware.

The guiding principle remains the same: if two effects visibly and
mechanically coexist—such as oil beneath fire—the replicated compound state
should preserve both layers, and the renderer should present them as one
coherent phenomenon.

### Documentation rule

When a planned extension ships, move its description into **Implemented
contract**, add the relevant schema and source links, and add tests before
describing it as available to content authors or AI proposals.
