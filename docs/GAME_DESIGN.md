# Game Design — World, PvPvE & Social

The multiplayer fantasy: you spawn alone somewhere in a vast dungeon floor. You fight what the dungeon throws at you. Eventually you stumble on another player — and that moment is charged, because they *can* hurt you, but they might fistbump you instead. Safety is real but scarce: the safe rooms, same for everyone, no exceptions. (Tonal reference: the Dungeon Crawler Carl series.)

## World structure

- **Floors are vast, and floors are worlds.** Each floor ("level" — the terms are loose) is one procedurally generated map, far larger than a screen — generated lazily in **chunks**, each chunk deterministic from `(worldSeed, floor, chunkCoord)` so clients regenerate geometry locally from coordinates alone (see [ARCHITECTURE.md](ARCHITECTURE.md)). Each floor runs as its own isolated shard: **players on different floors never interact** — no shared space, no cross-floor effects (at least for now). Floors differ in difficulty, biome, and character — one floor might be flooded caves, another a sky realm of cloud cities.
- **Shared, not instanced.** Everyone on a floor inhabits the same world: the fire you started is the fire they walk into. World deltas (looted items, burned tiles, charred terrain) persist while the floor is live.
- **The objective is the stairway down.** Getting to (and through) the stairway is the game. Stairways are fixed, identical-for-everyone features of the floor, and they're **one-way** — descent is commitment. Early descenders start the next floor immediately while the rest keep fighting to survive above. No sleep-pods here (unlike the books) — going down early just means you're first to the next world.
- **Floors run forever — for now.** One global world: new players join on floor 1 and work their way down; stairways are simply open. The endgame vision is **Seasons** (a late, post-v1.0 epic, recorded so we design toward it): parallel game instances run as timed seasons — floor 1 open for ~1 week, floor 2 ~9 days, subsequent floors ~2 weeks — with stairways sealed until late in each floor's window; once a season's floor 1 closes, that season stops accepting new players and newcomers start on a fresh season/world.
- **Spawning:** new arrivals spawn at a random valid location on the floor, **far from other players** (and enemy clusters). There is no spawn-protection shield — the dungeon is vast, and distance *is* the protection.

## Verticality

Top-down with a real, **continuous height axis** (CrossCode-style) — not discrete layers:

- **Terrain is heightmapped.** Chunks carry a continuous height field: terraces, cliffs, plateaus, chasms. Entities live at `(x, y, z)`. (Sky-scale set pieces — a DCC-style **floating castle** that crawlers must figure out how to reach via rope, flight, teleportation, maybe someday a vehicle — are deferred post-v1.0, but the height model is built to allow them.)
- **Rendering:** an entity's shadow blob anchors its ground position; the sprite offsets upward by z. The shadow is what makes height readable in top-down — players parse it instantly. Elevation-readable cliff tiles are a first-class art requirement.
- **Movement:** jumping, falling (**fall damage** scales with the drop), knockback off ledges (fall damage is a weapon), updrafts, and **flight** — z above terrain, shadow gliding over the chasm below.
- **Effects obey height** (see [EFFECTS.md](EFFECTS.md)): heavy gases sink into pits and low ground, smoke rises, liquids flow downhill, ground-bound areas can't touch airborne entities. Poison poured off a high ledge rains onto the terraces below — within the same floor.
- **Movement capabilities are data:** `flying`, `feather-fall`, `sticky-feet` (cliff traversal, ledge-grip, knockback immunity) are statuses composed from primitives — which makes them **AI-craftable**. Glue + boots = something.

## PvPvE rules

Everyone can hurt everyone, except where consent or sanctuary says otherwise:

| Context | Player-vs-player damage & hostile effects | Enforced by |
| --- | --- | --- |
| Open world, unaffiliated players | **Allowed** — but never required; you can also just… not | — |
| Same party | **On — always. No toggle.** Watch your swings; melee gets a targeting aid (below), but AoE, throwables, and areas hit everyone | — |
| Safe rooms (and rooms off them) | **Suppressed for everyone** — no damage, no hostile statuses, no hostile area effects; fire dies at the threshold | Server: `sanctuary` zone tag suppresses hostile effect primitives (see [EFFECTS.md](EFFECTS.md)) |

Indirect griefing (kiting a horde into someone, laying fire at a safe-room exit) is deliberately possible — emergent dungeon cruelty is part of the fantasy — and distance-based spawning, sanctuary thresholds, and death economics keep it survivable. Death is the same everywhere, PvE or PvP: **full loot drop** — everything carried falls where you died (your killer may loot it), your stash is safe.

**Melee targeting aid (because friendly fire never turns off):** a melee swing resolves against the *best* target in its arc, with hostiles preferred over party members — fighting shoulder-to-shoulder against a monster won't clip your friend. But a swing with no hostile in the arc hits whatever's there, friends included, and AoE/throwables/areas make no distinction ever. Positioning still matters; molotovs stay honest.

## Safe rooms & stretch rooms

Safe rooms are behind **doors** on the shared floor — a wall kiosk with a portal door, placed identically for all players every few chunks. Everything past the door is absolutely safe: the dungeon's social hubs.

Every layer is the same portal mechanic ("stretch rooms"): rooms manifest as instanced spaces that don't exist in the shared floor geometry, entered by door.

```
        VAST SHARED FLOOR
        ┌──────────────┐
        │ [safe-room   │
        │  door kiosk]─┼──▶ SAFE ROOM (instanced, shared per region)
        └──────────────┘    sanctuary rules; same door → same room for everyone
                            │
                            ├─[your door]───▶ YOUR PERSONAL ROOM (per player)
                            │                   stash, crafting table, decorations
                            ├─[party door]──▶ PARTY COMMON ROOM (per party)
                            │                   shared area + a personal door inside
                            └─[exit door]───▶ back to where you entered from
```

- **The safe-room door** leads everyone in a region to the *same* shared safe room — meeting space, communal stash + crafting table.
- **Your door** appears in *every* safe room and always leads to the same personal room — your base travels with you. Contains your stash and **crafting table** (the AI crafting site — see [AI_CRAFTING.md](AI_CRAFTING.md)).
- **Party door** appears when you're in a party: a shared common room for hanging out/planning, with individual member rooms off it.
- Doors are shared geometry with per-player destinations; exits unwind the way you came (personal room → safe room → floor). Implementation: instanced sub-maps in a reserved chunk band, entered by server teleport.

## Parties

- Formed by **mutual consent only** — an invite/accept flow (natural gateway: the fistbump).
- Party members: shared party chat, party door in safe rooms, see each other on the floor (position pings even outside view range — they're your people). **Friendly fire stays on** — partying up is trust, not immunity; the melee targeting aid keeps accidents rare.
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

## Resolved decisions (2026-07-06)

1. **Floor lifecycle:** floors run forever for now. **Seasons** are the endgame vision (post-v1.0): parallel timed game instances — floor 1 ~1 week, floor 2 ~9 days, later floors ~2 weeks; joins close when a season's floor 1 ends; newcomers start a fresh season.
2. **One global world** for now; new players join on floor 1 and work down.
3. **Stairs are one-way.**
4. **Sky set pieces deferred:** no cloud cities yet; the floating-castle concept (multiple access routes — rope, flight, teleport, maybe a vehicle) waits, but the height model supports it.
5. **Shard capacity:** target **20 concurrent players** per floor shard to start.
6. **Death is full loot drop; no spawn shield** — distance-based spawn placement is the protection.
7. **Global chat is truly global** (all floors — the only cross-floor connective tissue).
8. **Party friendly fire is always on, no toggle** — mitigated by the hostile-preferring melee targeting aid.
9. **Moderation is in scope for v1.0** (report/mute tooling + lightweight automated filtering).
10. **No voice.** Text chat only.

## Remaining open questions

1. **Seasons detail** (when that epic arrives): exact end-of-floor handling for stragglers — forced descent vs DCC-style collapse; season cadence and overlap.
2. **Party loot etiquette:** free-for-all pickup assumed; revisit if playtests turn sour.
3. **Floating-castle access design:** which capabilities gate it, and how many routes — deferred with the feature.
