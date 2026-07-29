# Effects System Design

The effects engine is the foundation the whole game — and especially AI crafting — stands on. Its job: make "what an item/effect *does*" expressible entirely as data, so new effects (including AI-proposed ones) require zero new code.

**Multiplayer note:** effects are simulated exclusively on the game server as part of the authoritative tick (see [ARCHITECTURE.md](ARCHITECTURE.md)). Clients receive effect events (`EffectApplied`, `AreaSpawned`, `EntityTransformed`…) within their area of interest and render them — they never compute outcomes. Every observer sees the same fire spread identically, and no client can cheat a debuff away — which matters double in PvP.

**Safe rooms are this system, not a special case:** safe-room tiles carry a `sanctuary` zone tag ([GAME_DESIGN.md](GAME_DESIGN.md)), and one interaction rule suppresses hostile primitives (negative `modify_health`, debuff `apply_status`, hostile `spawn_area`/`spread`) for anything inside — fire dies at the threshold, PvP damage zeroes out, healing still works.

## Three layers

1. **Effect primitives** — the only layer implemented in code. Small, orthogonal, heavily tested verbs.
2. **Status effects & area effects** — data files composing primitives with parameters, duration, stacking, channels, and tags.
3. **Interaction rules** — validated, deterministic reactions between tags (`fire` + `wet` ⇒ extinguish).

The AI (and human content authors) only ever touch layers 2–3 vocabulary; they cannot invent a primitive.

## Layer 1 — Effect primitives (code)

Initial catalog (expandable, but only by developers):

| Primitive | Parameters | Example use |
| --- | --- | --- |
| `modify_health` | amount, interval (per-tick or once) | bleeding (−2/2s), healing salve (+3/1s), instant damage |
| `modify_stat` | stat, amount/multiplier, while-active | slow (speed ×0.6), strength buff |
| `apply_status` | statusId, chance, target | poison blade: on-hit applies `poisoned` |
| `add_tags` / `remove_tags` | tags | `wet` status adds the `wet` tag; drying removes it |
| `spawn_area` | areaId, radius, at (self/impact) | molotov impact spawns `fire` area |
| `spread` | radius, chance/tick, medium tags | fire spreads to adjacent `flammable` entities/tiles |
| `transform_entity` | targetId, requires exposure time | raw meat + 10s fire exposure ⇒ cooked meat; 30s ⇒ char |
| `destroy_entity` | delay/condition | charred item crumbles; bottle breaks on impact |
| `spawn_entity` | entityId, count | breaking spawns shards; smoke spawns from fire |
| `emit_event` | eventId | hooks for quests/audio/VFX |

Each primitive is a pure function `(state, params, target, dt) → state changes`, unit-tested in isolation.

## Layer 2 — Statuses & areas (data)

### Status effect schema (sketch)

```jsonc
// content/effects/bleeding.json
{
  "id": "bleeding",
  "name": "Bleeding",
  "kind": "debuff",
  "tags": ["physical", "bleed"],
  "duration": 8,               // seconds; null = until removed
  "tick": 2,                   // run tick primitives every 2s
  "stacking": "refresh",       // refresh | stack(max) | ignore
  "onTick": [{ "primitive": "modify_health", "amount": -2 }],
  "removedBy": ["heal-wounds", "bandaged"]
}
```

```jsonc
// content/effects/on-fire.json
{
  "id": "on-fire",
  "name": "On Fire",
  "kind": "debuff",
  "tags": ["fire"],
  "duration": 6,
  "tick": 1,
  "stacking": "refresh",
  "appliesTags": ["burning"],
  "onTick": [
    { "primitive": "modify_health", "amount": -3 },
    { "primitive": "spread", "radius": 1, "chance": 0.25, "mediumTags": ["flammable"] }
  ],
  "exposure": [   // effects on the *bearer* accumulating over time
    { "afterSeconds": 10, "ifTags": ["organic", "item"], "primitive": "transform_entity", "to": "charred-remains" },
    { "afterSeconds": 6,  "ifTags": ["raw-food"],        "primitive": "transform_entity", "to": "{id}-cooked" }
  ]
}
```

### Area effects

Areas are authoritative tile cells. A cell may contain one layer in each
explicit channel:

- `surface`: water, oil, and other ground liquids
- `flame`: fire and short-lived flame attacks
- `gas`: poison, smoke, and steam

Each layer retains its own duration, spread state, and source attribution. An
incoming layer replaces a lower-priority layer in its channel, while equal or
lower priority conflicts are rejected. The complete cell is replicated
atomically, so burning oil remains oil plus fire—not a client-side illusion.

```jsonc
{
  "id": "area-fire",
  "tags": ["fire", "hostile"],
  "channel": "flame",
  "priority": 20,
  "duration": 8,
  "onEnterStatus": "on-fire",
  "spread": {
    "chance": 0.5,
    "ontoAreaTag": "flammable",
    "maxSteps": 6
  },
  "sprite": "fire"
}
```

Wet ground, poison clouds, oil slicks, smoke, and steam use the same bounded
model. Height-aware buoyancy and spread parameters determine how they move.

## Layer 3 — Interaction rules (data)

Area reactions live in `packages/content/src/data/areaReactions.json`. They are
declarative, tag-based, order-independent, and sorted by priority then stable
ID before evaluation:

```jsonc
[
  {
    "id": "fire-burns-oil",
    "priority": 20,
    "when": ["fire", "oil"],
    "actions": [
      { "op": "rate_consume", "tag": "oil", "perSecond": 3 }
    ]
  },
  {
    "id": "fire-and-wet-become-steam",
    "priority": 30,
    "when": ["fire", "wet"],
    "actions": [
      { "op": "remove", "tag": "fire" },
      { "op": "remove", "tag": "wet" },
      { "op": "add", "area": "area-steam", "sourceFromTag": "fire" }
    ]
  }
]
```

Transition actions are planned and applied atomically. Continuous consumption
uses an authored per-second rate, allowing oil to remain visible beneath fire
until its own fuel timer expires. Invalid references, duplicate IDs, unsafe
numeric bounds, and cyclic transitions are rejected during content loading.
Channel conflicts reject the incoming runtime placement deterministically; a
runtime transition cap remains a defense-in-depth guard.

Rules reference **tags, never item IDs**. Every new tagged thing
automatically participates in existing compatible rules.

## Stacking, resistance, immunity

- Stacking rule lives on the status (`refresh`, `stack` with max, `ignore`)
- Entities can declare `immunities: ["bleed"]` (a slime) and `resistances: { "fire": 0.5 }`
- Immunity/resistance are checked in `apply_status`, one place, so all content respects them

## What the AI is allowed to do (preview of AI_CRAFTING.md)

An AI item proposal may only:

- reference existing primitives, statuses, areas, tags, channels, and reaction
  operations by ID
- compose approved base effects within numeric and layer-count bounds
- submit declarative JSON; it cannot provide executable code or invent a new
  primitive

The validator rejects unknown references, duplicates, out-of-budget numbers,
channel conflicts, and transition loops. A rejected proposal costs the player
nothing but the attempt.

## Verticality

The world has a continuous height axis ([GAME_DESIGN.md](GAME_DESIGN.md) § Verticality). Height is an **input to the same machinery**, not a new system:

- **Fall damage** is `modify_health` scaled by drop distance — and an interaction rule cancels it on landing in water (the engine already thinks this way: fire + wet ⇒ extinguish)
- **`airborne`** is a tag set by jumping/flying; ground-bound area effects and melee simply don't match airborne targets — flying over your own burning oil slick is a legal play
- **Area effects carry a `buoyancy` param:** heavy gases sink into pits and low terrain, smoke rises, liquids flow downhill along the height field. Poison poured off a cloud-city ledge rains onto the terraces below.
- **Movement capabilities are statuses:** `flying`, `feather-fall`, `sticky-feet` (cliff traversal, ledge-grip, knockback immunity) compose from existing primitives — data, therefore AI-craftable

## Launch status set (v0.2–v0.3)

Debuffs: `bleeding`, `poisoned`, `on-fire`, `slowed`, `wet` (contextual), `blinded` (smoke)
Buffs: `healing`, `regenerating`, `haste`, `resist-fire`, `well-fed`, `feather-fall`, `flying` (rare), `sticky-feet`
Areas: `area-fire`, `area-wet`, `area-poison-cloud`, `area-oil`, `area-smoke`, `area-steam`

Bandage balance is authored once in the validated, versioned
`packages/content/src/data/liveTuning.json`. Its `bandaged` status is materialized
from those values, and refresh replays the immediate heal while restarting both its
five-second duration and one-second tick cadence. Authoritative snapshots include
remaining and total status time so renderer HUDs never fabricate buff progress.
