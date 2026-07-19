# Assumptions Log — Epics 7.8–7.12

Every open question hit while writing [ROADMAP.md](ROADMAP.md)'s Epics 7.8–7.12, with the
default that ships absent a correction. Decisive, specific, reversible — per
[GAME_DESIGN.md](GAME_DESIGN.md)'s own tone. Fill in "Austin's answer" to override any row;
anything left blank ships as written.

| # | Assumption | My default | Where it lands | Austin's answer |
| --- | --- | --- | --- | --- |
| 1 | Which weapon auto-equips in the starter kit | The existing `sword` item def (Rusty Sword) — no new starter-tier item | Epic 7.8 | |
| 2 | When the starter kit is (re)granted | Once per persistent `clientId`, on first-ever join only — never re-granted on death/respawn/reconnect (dying can't be a gear-reroll button) | Epic 7.8 | |
| 3 | Does the starter kit touch the stash | No — it lands straight in inventory and the equipped slot; stash stays exactly as it was | Epic 7.8 | |
| 4 | What happens to a torch's existing throwable `onImpact` (today: `breakChance: 1` → spawns `area-fire`) | Retired for torches specifically — landing now plants a persistent placed-torch entity instead of breaking into fire. Molotov-style impact fire stays available via the vodka bottle | Epic 7.8 | |
| 5 | How the data model expresses "landing places an entity" | A new data-first field on `ItemDefinition`'s `throwable` schema, not a torch-only code special case | Epic 7.8 | |
| 6 | Does a planted torch ignite nearby flammable tiles/entities | No — light-only while planted, no `on-fire`/hazard tag. Its melee-hit fire-chance behavior is unchanged | Epic 7.8 | |
| 7 | Planted-torch burn duration | 3 minutes (180s) real time from placement to despawn | Epic 7.8 | |
| 8 | Does burn state affect what pickup restores | No — pickup always restores exactly 1 full inventory torch, no partial-durability tracking | Epic 7.8 | |
| 9 | Cap on concurrently placed torches per floor | 40 — placement past the cap fails with a toast ("too many torches burning nearby") rather than evicting the oldest | Epic 7.8 | |
| 10 | Mechanism for the placed torch's real light | A new one-time trigger of the existing deterministic BFS flood (`computeLightField` in `tileLight.ts`) on placement/pickup/burnout — not a new per-frame dynamic-light channel | Epic 7.8 | |
| 11 | Protocol version bump for the new chat channels | Bumps by 1 past today's `PROTOCOL_VERSION = 10` | Epic 7.9 | |
| 12 | Do `dungeon` and `sandbox` share one global chat / online count | No — each level scopes its own global channel and `/who` count, matching how AOI/party/spawn already partition per sim; sandbox stays a private test mode | Epic 7.9 | |
| 13 | What "fans out to all floors" means today | Every connected socket on the current game-server process (both sims `server.ts` runs) — true cross-floor pub/sub waits on Epic 11's multi-floor shard infrastructure, since only one floor runs per instance today | Epic 7.9 | |
| 14 | Does global chat need an unlock | No — works for everyone immediately, no level gate | Epic 7.9 | |
| 15 | What happens when you `/dm` a non-contact | A clear denial system message (e.g. "You haven't fistbumped So-and-so yet") — DMs require a mutual contact from Epic 7.10 | Epic 7.9 | |
| 16 | Chat rate limits (today: none exist on any channel) | Global: 5 msgs/10s. Local + party: a new 10 msgs/10s baseline introduced in the same pass, so global is deliberately tighter without leaving the others unbounded for the first time | Epic 7.9 | |
| 17 | Name-targeting rule for `/dm`, `/whisper`, `/r` | Case-insensitive exact match; more than one online match returns an ambiguity error — no fuzzy/partial matching | Epic 7.9 | |
| 18 | What `/r` replies to | The most recent DM thread in either direction (last sent OR last received), not just "last sent" | Epic 7.9 | |
| 19 | What happens on an unrecognized `/`-prefixed message | An "unknown command, try /help" system message — it is never sent as literal chat text | Epic 7.9 | |
| 20 | How hold-to-fistbump coexists with today's tap-F-to-invite-party | Hold-vs-tap split: a quick tap keeps today's existing party invite/accept behavior exactly as-is; a sustained hold (assumed 400ms) triggers the new fistbump gesture. Without this split, this epic would silently remove the only way to party up until Epic 8's explicit party menu ships | Epic 7.10 | |
| 21 | Fistbump contact range | 1.5 tiles (genuine physical contact) — deliberately tighter than the existing 6-tile `INVITE_RANGE_TILES` party-invite proximity gate in `social.ts` | Epic 7.10 | |
| 22 | Contact persistence mechanism | Server-side, file-backed via the existing `PlayerStore` pattern (same mechanism the stash already uses), keyed by `clientId`, survives restarts | Epic 7.10 | |
| 23 | Cap on contact list size / how names display | No cap (matches the unlimited-inventory philosophy elsewhere); display name resolves live for online contacts, falls back to last-known name for offline ones | Epic 7.10 | |
| 24 | Is block/mute in scope for 7.10 | No — explicitly deferred to Epic 8 proper, where mute/block/DM-policy already lives; noted in the epic so it isn't mistaken for in-scope | Epic 7.10 | |
| 25 | One test tool or two | DECISION: enhance the existing `?scene=editor` (currently terrain-paint-only) rather than build a second tool | Epic 7.11 | |
| 26 | How SIMULATE runs | Client-side only, no network, at the same fixed `TICK_RATE` the server uses; toggling off freezes state in place; a separate reset clears the canvas back to blank | Epic 7.11 | |
| 27 | What the "dummy" target is | A new client-only training-dummy entity with regenerating HP — not an engine-authoritative entity kind, so it needs no server plumbing | Epic 7.11 | |
| 28 | Does blood VFX have a gameplay effect | No — purely cosmetic (no slip, no visibility debuff); triggered off the existing `hit`/`death` `GameEvent`s already broadcast within AOI | Epic 7.11 | |
| 29 | Blood decal lifetime / volume | 10s fade, from a pooled cap, mirroring existing particle-pool patterns — so a long fight doesn't accumulate unbounded decals | Epic 7.11 | |
| 30 | How crafting-table and stash panels ship | As HUD-OS windows following the Phase 1 inventory-window pattern (HUD_OS.md), range-gated open/close like today's DOM `Panels` class, reading recipes straight from `packages/content` | Epic 7.12 | |
| 31 | Scope of the "run input" bullet in 7.12 | Unchanged from Epic 7.7's existing unchecked bullet — folded in as-is, just relocated into the wave plan, no new design | Epic 7.12 | |
| 32 | How party downed/revive status reaches the client | Extend `partySnapshotSchema` (today: `id`/`name`/`x`/`y` only) with `hp`/`downed` for off-AOI party frames, plus an on-screen revive prompt near a downed member | Epic 7.12 | |
| 33 | Scope of "reconnect UX polish" | The resume toast (`ReconnectToastWidget`) already exists — this is a verification pass only. The door-return stack does NOT exist today — it's new work: restore the same room nesting (personal → safe room → floor) on resume, not just x/y | Epic 7.12 | |
| 34 | How the e2e suite gets restored | New specs under `tests/e2e/` (today: empty), ported-not-copied from `reference/e2e/game.spec.ts`'s 16 scenarios per `reference/README.md`'s "copy ideas, not files" rule; covering join/move/jump, two-client AOI, combat, safe-room door round-trip | Epic 7.12 | |
| 35 | When production smoke expansion can actually run | Only once Epic 2's deployed playtest server exists (still unchecked/deferred as of this doc) — logged here so it isn't silently dropped from the wave | Epic 7.12 | |
| 36 | What else the v1-parity scan turned up | Two more one-line gaps: a dedicated title/mode-select screen (v1 had `titleScreen.ts`; v2 has a thin `scenes/title/background.ts` — needs an affordance audit) and confirming v1's `gameMenu.ts` session-menu scope is fully matched by Epic 7.7's already-shipped session menu rather than assuming parity | Epic 7.12 | |
| 37 | What happens to Epic 7.7 bullets this wave plan doesn't touch (crawler art rebuild, snappier jump ascent, safe-room hierarchy correction, conditional room replication) | They stay in Epic 7.7, unscheduled by this wave plan — assumed to land in a later wave (6+) not yet defined, not dropped | Epic 7.12 (note only) | |

## Also resolved during this pass (not open questions — recorded for context)

- **Enemy scale correction** was pulled OUT of Epic 7.12 per direct correction: current scaling is confirmed correct. The Epic 7.7 checkbox is now marked `[x]` with a dated note instead of being folded into 7.12.
| 38 | Chasm access: ONE primary-doorway ramp per rift (mirroring pit/dais), not one at each rift end — the two-staircase reading was ambiguous and riskier against bridge/pit geometry | one ramp per rift | Epic 7.12 / stairs redesign (shipped in deploy 1) | |
| 39 | Stair run length uses N+1 equal-slope segments (neither end tile flush with its flat neighbor) instead of literal ceil(dz/slope) — backward-compatible, probe-verified | equal-slope segments | stairs redesign (shipped in deploy 1) | |
