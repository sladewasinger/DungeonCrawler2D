# Game Design — World, PvPvE & Social

The multiplayer fantasy: you spawn alone somewhere in a vast dungeon floor. You fight what the dungeon throws at you. Eventually you stumble on another player — and that moment is charged, because they *can* hurt you, but they might fistbump you instead. Safety is real but scarce: the safe rooms, same for everyone, no exceptions. (Tonal reference: the Dungeon Crawler Carl series.)

## World structure

- **Floors are vast.** Each floor is one procedurally generated map, far larger than a screen or a session — generated lazily in **chunks**, each chunk deterministic from `(worldSeed, floor, chunkCoord)` so clients regenerate geometry locally from coordinates alone (see [ARCHITECTURE.md](ARCHITECTURE.md)).
- **Shared, not instanced.** Everyone on a floor shard inhabits the same world: the fire you started is the fire they walk into. World deltas (looted items, burned tiles, opened doors) persist while the floor is live.
- **Descent.** Stairs/exits lead down; difficulty scales with depth. Safe rooms and stairways are fixed features of each floor's generation — identical locations for every player.
- **Spawning:** new arrivals spawn at a random valid location on the floor (biased away from other players and enemy clusters), with brief **spawn protection** (can't deal or take PvP damage until it expires or they act aggressively).

## PvPvE rules

Everyone can hurt everyone, except where consent or sanctuary says otherwise:

| Context | Player-vs-player damage & hostile effects | Enforced by |
| --- | --- | --- |
| Open world, unaffiliated players | **Allowed** — but never required; you can also just… not | — |
| Same party | **Off** (friendly fire toggle per party, default off) | Server checks party membership |
| Safe rooms (and rooms off them) | **Suppressed for everyone** — no damage, no hostile statuses, no hostile area effects; fire dies at the threshold | Server: `sanctuary` zone tag suppresses hostile effect primitives (see [EFFECTS.md](EFFECTS.md)) |

Indirect griefing (kiting a horde into someone, laying fire at a safe-room exit) is deliberately possible — emergent dungeon cruelty is part of the fantasy — but spawn protection, sanctuary thresholds, and death economics keep it survivable. PvE death rules apply to PvP death too: drop carried items (the killer can loot them), keep your stash. Severity is an open tuning question.

## Safe rooms & stretch rooms

Safe rooms are generated map features, **identical for all players**, and absolutely safe — the dungeon's social hubs.

The clever bit is that they **stretch**: the room manifests extra doors per visitor, leading to instanced spaces that don't exist in the shared map geometry.

```
        VAST SHARED FLOOR
        ┌────────────────────┐
        │     SAFE ROOM      │   ← fixed map feature, sanctuary rules,
        │                    │     everyone sees the same room
        │  [your door]───────┼──▶ YOUR PERSONAL ROOM (instanced, per player)
        │                    │      stash, crafting table, decorations
        │  [party door]──────┼──▶ PARTY COMMON ROOM (instanced, per party)
        │                    │      shared area + one inner door per member
        └────────────────────┘      leading to their individual room
```

- **Your door** appears in *every* safe room and always leads to the same personal room — your base travels with you. Contains your stash and **crafting table** (the AI crafting site — see [AI_CRAFTING.md](AI_CRAFTING.md)).
- **Party door** appears when you're in a party: a shared common room for hanging out/planning, with individual member rooms off it.
- Others see their own doors, not yours. Implementation-wise these are small instanced sub-maps attached by portal, not part of floor geometry.

## Parties

- Formed by **mutual consent only** — an invite/accept flow (natural gateway: the fistbump).
- Party members: friendly fire off (default), shared party chat, party door in safe rooms, see each other on the floor (position pings even outside view range — they're your people).
- Leaving/disbanding is unilateral and instant. Loot sharing rules: open question (default: free-for-all pickup, party etiquette is social, not mechanical).

## Social fabric

The loop: *see a stranger → tense standoff → fistbump → friends*.

- **Fistbump:** both players use the fistbump emote within close proximity and a short window → mutual handshake → you're added to each other's contacts. Unlocks DMs and quick party invites. (No one-sided friending; consent is the theme everywhere.)
- **Chat channels:** global (everyone), party, DM (contacts only), plus local/proximity chat as the default open channel. All rendered in one chat widget with per-channel tabs/filters.
- **Everything toggleable / mutable.** Per player, persisted:
  - mute global chat entirely; mute any individual; block (blocks DMs, fistbumps, invites from that player)
  - DMs: contacts-only (default) / everyone / nobody
  - toggle profanity filter; toggle chat visibility entirely (pure-gameplay mode)
- Server enforces mute/block lists (a muted player's messages never reach your client — not client-side hiding, so blocks are real).

## Editable HUD

Full HUD customization ships late (v0.8), but the **architecture is a day-one constraint** so nothing needs rewriting:

- Every HUD element — health, hotbar, buff icons, chat, party frames, minimap, ping/status — is a **widget**: a self-contained component registered with an id, default anchor/offset/scale, and visibility flag.
- The HUD renders from a **layout config** (JSON), shipped with defaults, persisted per user (localStorage → account save in v0.8).
- The eventual editor is then just UI over the config: drag, resize, toggle, reset-to-default. Hiding any widget (including chat) is the same mechanism as muting — the toggleable-everything principle applied to screen space.

New HUD work in any epic must be built as a widget from the start; PRs adding fixed-position UI get bounced.

## Open questions

1. **Shard capacity & lifecycle:** target concurrent players per floor shard (tuning: 20–50 to start?); what happens when a floor empties — hibernate and persist deltas for how long? Seasonal world resets (very DCC) or eternal worlds?
2. **PvP death severity:** full loot drop vs partial; any protection for fresh spawns beyond the initial shield?
3. **Global chat scope:** truly global (all floors/shards, one big tavern) vs per-floor? Leaning truly global for community feel.
4. **Party friendly-fire toggle:** keep it, or is it a griefing vector inside consent?
5. **Moderation:** global chat at any scale needs report/mute tooling and probably lightweight automated filtering by launch — scope for v1.0.
6. **Proximity voice?** Out of scope through v1.0; text only.
