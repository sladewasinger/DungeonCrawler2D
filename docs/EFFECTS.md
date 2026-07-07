# Effects System Design

The effects engine is the foundation the whole game — and especially AI crafting — stands on. Its job: make "what an item/effect *does*" expressible entirely as data, so new effects (including AI-proposed ones) require zero new code.

**Multiplayer note:** effects are simulated exclusively on the game server as part of the authoritative tick (see [ARCHITECTURE.md](ARCHITECTURE.md)). Clients receive effect events (`EffectApplied`, `AreaSpawned`, `EntityTransformed`…) within their area of interest and render them — they never compute outcomes. Every observer sees the same fire spread identically, and no client can cheat a debuff away — which matters double in PvP.

**Safe rooms are this system, not a special case:** safe-room tiles carry a `sanctuary` zone tag ([GAME_DESIGN.md](GAME_DESIGN.md)), and one interaction rule suppresses hostile primitives (negative `modify_health`, debuff `apply_status`, hostile `spawn_area`/`spread`) for anything inside — fire dies at the threshold, PvP damage zeroes out, healing still works.

## Three layers

1. **Effect primitives** — the only layer implemented in code. Small, orthogonal, heavily tested verbs.
2. **Status effects & area effects** — data files composing primitives with parameters, duration, stacking, and tags.
3. **Interaction rules** — data-declared reactions between tags (`fire` + `wet` ⇒ extinguish).

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

Same schema shape, but bound to tile regions instead of entities, plus spread/decay:

```jsonc
// content/effects/area-fire.json
{
  "id": "area-fire",
  "tags": ["fire"],
  "onEnter": [{ "primitive": "apply_status", "status": "on-fire", "chance": 1.0 }],
  "perTick": [{ "primitive": "spread", "chance": 0.15, "mediumTags": ["flammable"], "consumesFuel": true }],
  "decay": { "afterSeconds": 8, "leavesTile": "charred" }
}
```

Wet ground, poison clouds, oil slicks, smoke: same model, different data. Clouds get a `drift` param; liquids get `flow`.

## Layer 3 — Interaction rules (data)

Declarative, tag-based, order-independent rules evaluated when statuses/areas/tags coexist:

```jsonc
[
  { "when": ["fire", "wet"],       "then": { "remove": "fire",  "spawn": "area-steam" } },
  { "when": ["fire", "flammable"], "then": { "apply": "on-fire" } },
  { "when": ["fire", "explosive"], "then": { "trigger": "explode" } },
  { "when": ["poison", "fire"],    "then": { "remove": "poison" } },   // burn off the cloud
  { "when": ["water", "electric"], "then": { "conduct": true } }        // future
]
```

Rules reference **tags, never item ids**. This is the multiplier: every new tagged thing (hand-made or AI-made) automatically participates in every existing rule. Content growth is combinatorial, code growth is zero.

## Stacking, resistance, immunity

- Stacking rule lives on the status (`refresh`, `stack` with max, `ignore`)
- Entities can declare `immunities: ["bleed"]` (a slime) and `resistances: { "fire": 0.5 }`
- Immunity/resistance are checked in `apply_status`, one place, so all content respects them

## What the AI is allowed to do (preview of AI_CRAFTING.md)

An AI item proposal may only:
- reference **existing** primitives, statuses, areas, and tags by id
- optionally define a new status/area **composed of existing primitives**, within numeric bounds (max DoT, max radius, max duration — the "balance budget")

The validator rejects unknown primitives/tags, out-of-budget numbers, and self-referencing loops. A rejected proposal costs the player nothing but the attempt.

## Launch status set (v0.2–v0.3)

Debuffs: `bleeding`, `poisoned`, `on-fire`, `slowed`, `wet` (contextual), `blinded` (smoke)
Buffs: `healing`, `regenerating`, `haste`, `resist-fire`, `well-fed`
Areas: `area-fire`, `area-wet`, `area-poison-cloud`, `area-oil`, `area-smoke`, `area-steam`
