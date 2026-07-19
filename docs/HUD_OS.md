# HUD OS — The Crawler's Interface

Every crawler in Dungeon Crawler Carl gets a system: a HUD administered by the dungeon
itself, and it's *theirs* — they rearrange it, hack it, bolt on trackers the dungeon
never intended, hide the parts that get them killed. It's diegetic furniture that
happens to double as game UI. Our HUD should read the same way: not a settings menu
that happens to sit on top of the game, but a system the dungeon issued you on arrival,
open to inspection and rearrangement, with more installed than you'll ever turn on.

This doc specs that system end to end: the model, the editor, the catalog, and the four
phases that get us there. It builds directly on the `WidgetRegistry` foundation already
shipped (`packages/client/src/ui/widgets/`) — every currently-shipped widget is already
a window with fixed chrome; nothing here replaces that foundation, it grows it.

## 1. Vision & tone

- **The interface is diegetic.** In-fiction, the dungeon (or whatever administers it —
  undecided, not this doc's problem) hands every crawler a HUD on arrival. Customizing
  it isn't a meta "options menu" action, it's the crawler making the system their own —
  same energy as a DCC crawler duct-taping a jury-rigged tracker widget onto their
  interface between floors. We don't need voiceover or a tutorial NPC to sell this; the
  tone comes from the *design*, not from lore text: generous defaults-off catalog,
  reversible everything, a "window store" you browse rather than a checkbox list.
- **Scarcity is the wrong instinct.** The natural engineering move is to ship exactly
  the windows a player needs and nothing else. Resist it here. The DCC fantasy is an
  interface with more capability installed than any one crawler uses — "almost like an
  entire OS in their head" (the brief's words, kept verbatim because it's exactly
  right). A defaults-off catalog with two dozen entries, most speculative, is the
  point, not scope creep — see § 4.
- **Everything reversible, nothing destructive.** Move it, resize it, hide it, pin it —
  there is always a reset-to-default, per-window and global (§ 3). A crawler who
  wrecks their own layout mid-fight should be able to get back to sane in one keypress,
  not a support ticket.
- **This is still HUD, not a settings app.** Edit-HUD mode (§ 3) is a distinct, entered
  mode — you don't drag windows around mid-combat by accident. Outside that mode the
  HUD is exactly as inert to clicks as it is today (nothing here changes how the
  shipped widgets behave during normal play).

## 2. Core model: everything is a window

The existing widgets are not a different thing from what this doc proposes — they're
windows that happen to ship with fixed chrome (no visible frame, no drag handle, no
close button) and a fixed size. A **window** is the registry's unit of HUD real
estate, and every one of them carries:

| Property | Today (v1 registry) | This doc adds |
| --- | --- | --- |
| `id` | yes | — |
| `title` | no (chrome-less) | yes — only rendered when the window has a frame (edit-HUD mode, or a catalog listing) |
| `anchor` + `offset` | yes (9 anchors + px offset) | unchanged model, offset range stops being "small padding" and becomes truly free (§ 6) |
| `size` | fixed per-widget, hardcoded in its constructor | declared `defaultSize` + `minSize`/`maxSize`, resizable in edit-HUD mode, with a per-window content-reflow rule (§ 6) |
| `z-order` / pinning | one flat `WIDGET_DEPTH` for all widgets | a `z` field for ordering among windows, plus `pinned` (always-on-top of non-pinned windows) and an optional `clickThrough` (pinned windows can opt out of stealing pointer input — a pinned FPS counter shouldn't block a click to the game world under it) |
| `visibility` | yes (`defaultVisible` + override) | unchanged — but see § 4's catalog framing: for defaults-off windows, `visible: false` means "installed, not open," not "doesn't exist" |
| `opacity` | no | new `opacity` field (0–1), so a window can be present but unobtrusive (a pinned coordinate readout at 50% opacity) |
| per-window settings | no | a free-form `settings` map each window interprets for itself — active filter tab, tab order, whatever the window needs (§ 5) |

Layouts persist the same way GAME_DESIGN.md § Editable HUD already commits to:
**localStorage now, account save at v0.8** (Epic 11). Nothing in this doc changes that
timeline — it's the schema and the editor riding on top of it that are new.

## 3. Edit-HUD mode

A distinct mode, entered deliberately, exited deliberately — never a background state
during normal play.

- **Enter/exit:** a gear icon in the (always-on, non-hideable) System Tray window —
  the one window in the catalog that can't be turned off, since it's the only way back
  into the editor once everything else is hidden — plus a hotkey, **[H]**. Both are
  simple toggles; entering while already in edit mode exits it. Esc also exits (folds
  into the existing `InputPanels.closeAll` sweep, § 7 Phase 1 note on why that hook
  matters).
- **While active:** normal gameplay input (movement, attack, hotbar activation) is
  suspended — same posture as the inventory window taking focus (§ 7 Phase 1) or the
  chat input capturing keys today. The world keeps rendering underneath (unpaused,
  multiplayer never pauses) so you can see what your layout is covering.
- **Drag to move:** every window gets a drag handle (its title bar, rendered only in
  edit mode). Dragging updates `offset` live; releasing near a screen edge or center
  line shows **snap guides** (thin accent-colored lines, reusing `SELECTION_ACCENT`
  from `ui/panel.ts`) and **re-docks the anchor** — drag a window from `top-left` to
  the right half of the screen and it re-parents to `top-right`, offset recalculated
  from the new anchor so it stays sane across a resize. This is why anchor+offset
  stays the position model instead of switching to absolute x/y (§ 6) — re-docking is
  a first-class interaction, not a fallback.
- **Resize handles:** corner/edge handles on the window frame, dragging clamps to the
  window's declared `minSize`/`maxSize` and triggers its reflow rule live (§ 6) so you
  see the content adapt as you drag, not just after release.
- **Toggle catalog (the "window store"):** a scrollable list of every *registered*
  window, including every defaults-off one — this is where the "buttloads of windows
  ... that aren't even on by default" promise becomes browsable rather than
  theoretical. Each entry: icon/name, one-line description, a visibility toggle. No
  install/uninstall step — registration already happened at boot (§ 6); toggling here
  just flips `visible`.
- **Reset to default:** a reset control on each window's frame (per-window: drops that
  one window's override back to its shipped default) and one global "Reset All HUD"
  in the System Tray (drops the entire override layer — `WidgetRegistry.resetToDefault()`
  already implements exactly this today, unchanged).

## 4. Window catalog

Status legend: **exists** (shipped, registered today) · **planned** (an existing
roadmap epic covers it) · **speculative** (fits the vision, no epic scheduled — a v3+
catalog-filler candidate).

| Window | Status | Notes |
| --- | --- | --- |
| Health (`health`) | exists | `healthBar.ts` |
| Hotbar (`hotbar`) | exists | `hotbar.ts` |
| Buff/debuff chips (`buffs`) | exists | `buffChips.ts` |
| Equipped weapon (`weapon`) | exists | `weaponChip.ts` |
| Chat (`chat`) | exists | `chatPanel.ts` — local/party tabs today, channel set expands in Epic 8 (see below) |
| Connection status (`status`) | exists | `connectionStatus.ts` — ping dot + ms only today |
| Touch stick / touch buttons | exists | mobile-only, `touchStick.ts` / `touchButtons.ts` |
| **Inventory** | **planned — Phase 1, this doc** | see § 7; ships immediately, ahead of edit-HUD mode itself |
| Party frames | planned (Epic 8, v0.5) | layout slot (`party`) already reserved in `default-layout.json`; no widget class yet |
| Minimap | speculative | named in GAME_DESIGN.md § Editable HUD's illustrative list and already has a reserved `default-layout.json` slot, but no epic schedules the minimap *feature* itself (needs a data source — explored-chunk tracking — that doesn't exist yet) |
| Codex / discovered items | planned (Epic 10, v0.7) | Epic 10 already specs this almost verbatim: "Registry browser UI ('codex' of discovered items, credited to first crafter)" — this window IS that bullet |
| Chat channel tabs (global/party/DM/proximity) | planned (Epic 8, v0.5) | not a new window — the existing `chat` window's tab bar grows from 2 stub tabs to the full channel set; the concrete case study for § 5's tabs-as-primitive |
| Damage meter | speculative | no epic; also a real design question before it's scoped — a visible damage meter changes PvP social dynamics (target selection by parties, tryhard pressure) in ways worth a design pass first |
| Loot log | speculative | no epic; plausible once full-loot-drop death (GAME_DESIGN.md § PvPvE rules) makes "who looted what" a thing players ask about |
| Quest / objective tracker | speculative | no epic, and honestly no quest system in the current design — the objective is "reach the stairway" (GAME_DESIGN.md § World structure); this window needs content design before it needs a window |
| Enemy info / inspector | speculative | no epic; cheap once scoped since enemy stats/tags are already data (Epic 6) — a hover/target query away |
| Clock / floor timer | planned, partially (Epic 11, v0.8) | meaningless until floors carry timing; Epic 11 lands floor identity, but the countdown this window implies is really a **Seasons** feature (post-v1.0, GAME_DESIGN.md § Resolved decisions #1) — ship the window shell in Epic 11, the real countdown lands with Seasons |
| Debug / perf | planned, partial rewrite | Epic 1's checked "Debug overlay: seed/pos/chunk/ping/fps" bullet predates the widget registry and isn't fully ported into it today — only `status` (ping) is a real widget; folding the rest (fps, seed, chunk coord, entity counts) into a proper defaults-off `debug` window is exactly the kind of consolidation this system exists for, and it closes a live "no fixed-position UI, ever" gap in debug tooling |

Further speculative seeds worth keeping on the list without table entries of their own
(deliberately not scoped — this is the "buttloads" gesture, not a backlog): a keybind
cheat-sheet, a session combat log, a nameplate-density toggle, an AI-crafting job
status tray (once Epic 9 exists to feed it). None of these need design work now; they
need the catalog mechanism (§ 3) to exist so adding one later is a widget file, not an
architecture change.

## 5. Tabs & filters as a first-class primitive

Tab bars already exist twice in the codebase, both hand-built per widget:
`chatPanel.ts`'s channel tabs and reference/v1's inventory filter tabs. Neither is
reusable. This doc makes tabs a declared capability of a window definition instead of
bespoke per-widget code.

```ts
/** A window declares this when it hosts a tab bar; omitted entirely for tab-less windows. */
interface WindowTabsCapability {
  /** "fixed": the window defines a closed set (inventory's All/Weapons/Usables/Materials —
   *  users reorder and hide, never add/remove). "user-extensible": users can also add and
   *  remove tabs from a window-specific catalog (chat: add a filtered channel view). */
  mode: "fixed" | "user-extensible";
  /** The tabs available to add, for "user-extensible" windows — e.g. chat's per-channel
   *  views. Ignored for "fixed" windows (their tab set IS this list, unremovable). */
  catalog: ReadonlyArray<{ id: string; label: string }>;
}

/** Per-window persisted state (lives in that window's `settings` map, § 6). */
interface WindowTabsState {
  /** Which catalog entries are currently shown, in display order — reordering the
   *  array reorders the tab bar; removing an entry removes the tab (fixed-mode windows
   *  still allow removing FROM the visible set, just not adding new ones back in from
   *  nowhere — the catalog bounds what "back in" means). */
  activeTabIds: string[];
  /** Which of activeTabIds currently has focus. */
  selectedTabId: string;
}
```

- **Inventory (Phase 1, ships fixed-mode):** catalog = `All`, `Weapons`, `Usables`,
  `Materials` (v1's four, ported verbatim). Fixed mode in Phase 1 — reordering/hiding
  individual filter tabs is a Phase 3 upgrade once the generic tab-bar renderer exists;
  Phase 1 hardcodes the tab bar exactly like `chatPanel.ts` does today (see § 7).
- **Chat (Epic 8, user-extensible):** catalog = `global`, `party`, `dm`, `proximity` at
  minimum; user-extensible leaves room for a later "pin a second DM thread as its own
  tab" without a schema change.
- **Rendering contract:** one shared tab-bar component (new,
  `packages/client/src/ui/widgets/tabBar.ts`) that any window with a
  `WindowTabsCapability` composes — background cell + label + `drawSelectionAccent`
  per tab, exactly `chatPanel.ts`'s `buildTabs()` today, lifted out so it stops being
  reimplemented per window. Phase 3 is when this lift happens (§ 7); Phase 1 doesn't
  block on it.

## 6. Technical architecture

Everything below is additive to `packages/client/src/ui/widgets/` — no existing file's
public behavior changes, and the existing test suite (`layout.test.ts`,
`hudLayout.test.ts`, `touchLayout.test.ts`) keeps passing unmodified.

### Layout config schema v2

```ts
// state.ts additions — WidgetOverride grows into WindowOverride (name change is
// conceptual/doc-only; see "why the JSON key doesn't rename" below).
interface WindowOverride {
  anchor?: AnchorId;          // unchanged
  offset?: Offset;            // unchanged model — see "position" note below
  scale?: number;             // unchanged
  visible?: boolean;          // unchanged
  size?: { width: number; height: number };
  z?: number;                 // default 0; ordering among non-pinned windows
  pinned?: boolean;           // default false; always-on-top of unpinned windows
  clickThrough?: boolean;     // default false; only meaningful when pinned
  opacity?: number;           // default 1
  settings?: Record<string, unknown>; // window-interpreted; tabs state lives here (§ 5)
}

interface LayoutConfig {
  version: 2;                 // bumped from 1 — see migration note
  hudScale?: number;          // unchanged
  widgets: Record<string, WindowOverride>; // key name deliberately unchanged, see below
}
```

- **"Position becomes free-form with anchor fallback" is not a new coordinate
  system.** `anchor` + `offset` already supports arbitrary placement — the 9 anchors
  bound *which corner/edge offset is measured from*, not how big the offset can be.
  What's new is *how users set it* (drag anywhere in edit-HUD mode, not choose between
  9 anchor presets) and that the drag re-picks the nearest anchor on release (§ 3's
  re-docking). This is a refinement of the shipped model, not a replacement — resist
  the urge to add a parallel absolute-x/y field; it would immediately break on resize
  in exactly the way anchor-relative positioning was built to avoid.
- **The JSON key stays `widgets`, not `windows`.** The conceptual model is windows;
  the storage contract doesn't need to know that. Renaming the key buys nothing but a
  migration hazard for zero behavior change — a real, if boring, engineering call.
- **`minSize`/`maxSize` live on the window's `WidgetDefinition`, not the override.**
  They're a property of what the window's content can physically show (inventory
  can't usefully go narrower than one item row), not something a user config should
  be able to break. A window definition adds `defaultSize`, `minSize`, `maxSize`
  alongside today's `defaultAnchor`/`defaultOffset`/`defaultScale`/`defaultVisible`.
- **Depth resolution.** Today every widget shares one `WIDGET_DEPTH` constant
  (`container.ts`). v2 resolves `WIDGET_DEPTH + (pinned ? PINNED_BONUS : 0) + z` per
  window, so pinned windows always draw above unpinned ones regardless of `z`, and
  `z` only orders within the same pinned/unpinned tier. `clickThrough` windows skip
  `setInteractive()`/hit-test registration entirely rather than participating and
  no-op'ing — pointer events should reach whatever's underneath, not stop dead.
- **Content reflow.** Each resizable window type gets a pure `reflow(width, height)`
  function computing its own internal layout (grid columns, visible row count, line
  wrap) from a content box size — the same shape `hotbarSlots.ts`'s `hotbarSlotViews`
  already establishes (pure view-model function, no Phaser, unit-tested headlessly).
  Resize handles call this live during drag (§ 3); it's not a new architectural
  pattern, it's applying the existing one to a size input instead of a snapshot input.

### `hudScale` interaction

Unchanged mechanism, extended surface: `resolveLayout` (`layout.ts`) already scales
`offset` by `hudScale` and rounds the final `scale`. v2 additionally scales `size`
(both dimensions) by `hudScale` before clamping to `minSize`/`maxSize` — a window
sized for a 1080p display should occupy the same *relative* screen fraction at
`hudScale: 2` on a 4K display, not shrink to a postage stamp. `minSize`/`maxSize`
themselves are declared in the same unscaled unit as `defaultOffset` today (i.e.
pre-hudScale, matching every other definition field).

### Touch-layout overrides interaction

Unchanged mechanism: `applyTouchLayoutOverrides` (`ui/widgets/hud/index.ts`) already
applies a partial override via `registry.setOverride()` before widgets construct. v2
just gives it a bigger field surface to write into (a touch profile might force
certain defaults-off catalog windows to stay hidden, or shrink `size` instead of
`offset`) — same call, same merge semantics, no new mechanism.

**Open ordering question, not blocking any phase:** `loadPersisted()` exists and is
tested (`layout.test.ts`) but **is never actually called during boot today** —
`HudWidgets`'s constructor doesn't invoke it, so a saved layout currently has no
effect in the real game, only in tests that call it directly. Phase 2 needs to close
this gap as a prerequisite (call `registry.loadPersisted()` before widgets construct).
Once it's wired, the real question is precedence when both a persisted layout *and* a
touch profile want the same field: today's `applyTouchLayoutOverrides` runs at
construction time and would need to run *after* `loadPersisted()` to keep taking
precedence (current behavior, simplest) — meaning a touch session always overrides a
desktop-saved layout on the fields it touches, even if the user explicitly customized
that field on desktop. That's probably fine (different physical device, different
constraints) but is a real product decision, not an implementation detail — flag it
for whoever wires Phase 2, don't silently pick one.

### Migration story for `default-layout.json`

No breaking migration is required, because every v2 field is optional and additive:
a v1 override (`{anchor, offset, scale, visible}`) is already a structurally valid v2
override missing the new keys, and `storage.ts`'s loader already narrow-parses/drops
unknown shape rather than validating strictly — a persisted v1 blob loads under v2
without a conversion step. What *does* need doing:

1. Bump the shipped `default-layout.json`'s `"version"` to `2` (documentation of
   intent — `storage.ts` doesn't currently branch on `version` at all, see below).
2. Add `size`/`z`/`pinned`/`opacity` defaults for the currently-shipped windows (all
   inert no-ops until edit-HUD mode exists to act on them — `z: 0`, `pinned: false`,
   `opacity: 1`, `size` matching each widget's current hardcoded constants).
3. **Recommended alongside this work, not required by it:** `storage.ts`'s hand-rolled
   `parseConfig` narrow-parser should become a real zod schema once the shape gains
   nested `size`/`settings` objects — consistent with ENGINEERING_STANDARDS.md's "all
   input crosses a zod schema," and hand-written narrowing gets error-prone exactly
   at the nesting depth v2 introduces. Malformed/hand-edited localStorage still must
   not crash the client; zod's `.safeParse` gives that for free instead of by hand.

## 7. Phasing

Four phases. No dates — this doc's job is scope and order, ROADMAP.md carries
timing.

### Phase 1 — Inventory window (ships immediately, ahead of everything else here)

Scope tight enough to build from this section alone. The intent state to display and
mutate already exists on `Connection` (`packages/client/src/net/connection.ts`):
`inventory: InvStack[]`, `hotbar: Array<string | null>`, `weapon: string | null`,
and intent methods `assignSlot(slot, item)`, `equip(item | null)`, `drop(item)` — all
already implemented and network-wired. This phase is UI on top of state that's
already live, which is exactly why it doesn't wait for edit-HUD mode.

**What ships:**

- A new registry window, id `"inventory"`, `packages/client/src/ui/widgets/hud/inventoryWindow.ts`
  (split into `inventoryWindow.ts` render class + `inventoryRows.ts` pure view-model,
  mirroring the existing `hotbar.ts`/`hotbarSlots.ts` split — keeps both files under
  the 200-line cap). Default anchor `center`, offset `{0,0}`, a fixed ~340×300px
  (pre-hudScale) panel using `drawPanelBackground`/`PANEL_BORDER`/`spacing()` from
  `ui/panel.ts` — the same panel language every other widget uses. Not resizable yet
  (resizing is Phase 2); registered `defaultVisible: true` (the window itself is
  always "installed," matching every other widget's registry semantics today) with an
  internal `open` flag defaulting to `false`, toggled and rendered exactly like
  `chatPanel.ts`'s `open`/`panel.setVisible()` pattern.
- **Toggle:** both **[I]** and **[Tab]** open/close it. Add `I`/`TAB` to the key chord
  in `input/keys.ts` (`Keys` type + `addKeys()` string) and bind both in
  `input/index.ts`'s `bindKeys()` via a new `InputHooks.onToggleInventory()` — same
  shape as the existing `onToggleChat()` hook, wired in
  `scenes/dungeon/inputAdapters.ts`'s `createInputHooks()` to a new `HudScene`
  method `toggleInventory()` (forwards to `HudWidgets`, mirroring `toggleChat()`
  exactly). Phaser's `TAB` key does not `preventDefault()` browser focus-cycling by
  default — call `keyboard.addCapture('TAB')` (or `event.preventDefault()` in the
  handler) so opening inventory doesn't yank focus off the canvas.
- **Filter tabs:** `All` / `Weapons` / `Usables` / `Materials`, ported verbatim from
  `reference/client/ui/inventoryPanel.ts`'s `categoryOf()` — weapon → Weapons,
  consumable-or-throwable → Usables, else → Materials — rebuilt as a pure function
  (extend `packages/client/src/scenes/dungeon/contentQueries.ts`'s existing
  `ItemDef`/`itemById` map with `name`/`weapon`/`consumable` fields it doesn't
  currently read, rather than building a second content lookup). Rendered as its own
  small tab strip inside the window, hand-built same as `chatPanel.ts`'s `buildTabs()`
  — do **not** wait for § 5's shared `tabBar.ts` lift, that's Phase 3.
- **Item rows:** one row per `InvStack`, sorted by display name. Icon via the
  existing `createItemIcon(scene, itemId, size)` (`hud/itemIcon.ts` — already handles
  atlas-frame items and the generated-chip fallback, nothing new needed there), name +
  `×qty` text, a `[N]` tag when the item is bound to a hotbar slot (`hotbar.indexOf`).
  No scroll region in Phase 1 — cap visible rows to what the fixed panel height holds;
  a real scrollable list is Phase 3 territory once windows are generally resizable.
- **Click-to-bind:** clicking a row selects it (gold `drawSelectionAccent` outline,
  same visual language as the selected hotbar slot); pressing 1–9 while a row is
  selected binds it via `assignSlot(n-1, selectedItemId)`. This reuses
  `input/hotbar.ts`'s existing `onNumberKey` — its doc comment already says "numbers
  act on the open panel first ... then fall back to hotbar USE"; add inventory as a
  new first-checked branch (`panels.inventoryOpen && panels.selectedInventoryItem`)
  ahead of the existing craft/stash branches, calling `assignSlot` instead of falling
  through to `activateHotbar`. Extend `InputPanels` (`input/state.ts`) with
  `inventoryOpen: boolean` and `selectedInventoryItem: string | null`, and extend
  `InputConnection` with the three intent methods (`assignSlot`/`equip`/`drop`) it's
  currently missing. `scenes/dungeon/inputAdapters.ts`'s `createInputPanels()` is
  currently a hardcoded no-op stub (`// core slice — craft/stash panels aren't ported
  yet`) — this phase is what finally gives it real state, reading through to the new
  `HudScene` methods.
- **Equip/unequip, drop:** row-level buttons for weapons (`Equip`/`Equipped`) and
  every row (`Drop`), calling `conn.equip(itemId | null)` / `conn.drop(itemId)`
  through the same actions channel as bind. Each interactive element (tab, row,
  button) is a real Phaser interactive game object with its own `pointerdown`
  listener — **not** routed through the shared `HudWidgets.hitTest()` string-tag
  dispatch (`hitTest` stays reserved for the small fixed set where the fallback
  swing/throw logic in `input/pointer.ts` needs to check it first). Do extend
  `hitTest()` with one coarse check: when the inventory window is open, a click
  anywhere inside its panel bounds returns a claimed tag (e.g. `"window:inventory"`)
  that `handleUiHit` no-ops on — this is solely so `handlePointerDown`'s fallback
  swing-through-the-panel doesn't fire; the panel's own listeners already handled the
  specific element.
- **Actions plumbing:** `HudScene`'s `HudSceneData` gains an `actions` bundle
  (`{ assignSlot, equip, drop }`) alongside the existing `source` snapshot callback —
  `DungeonScene.buildInputController()`'s sibling, the `this.scene.launch("hud", ...)`
  call in `create()`, passes it bound to the real `Connection`. `HudFakeSnapshot`
  (`hud/fakeData.ts`) gains an `inventory: InventoryRowData[]` field (id, name, qty,
  category, boundSlot), built in `scenes/dungeon/hudSnapshot.ts` alongside the
  existing `hotbarSlots()` builder.
- **Explicitly deferred:** search (v1 had it; this pass doesn't — the four tabs are
  enough to navigate an early-game inventory, and search is trivial to add once the
  window exists). No drag-to-move, no resize, no pin, no opacity — those are Phase 2+.

### Phase 2 — Edit-HUD mode

Move/resize/toggle/reset over the windows that already exist by this point (the
Phase 1 shipped set + inventory). Scope: the entry/exit UX, drag+snap+re-dock, resize
handles + live reflow, and reset-to-default (§ 3) — implemented against the v2 schema
(§ 6), which is the point at which `size`/`z`/`pinned`/`opacity` stop being inert
default values and start being user-editable. Prerequisite housekeeping this phase
must close, not defer further: wiring `registry.loadPersisted()` into actual boot
(currently untested-in-production, § 6). The window catalog ("window store") browsing
UI can ship in this phase or slide into Phase 3 with the rest of the catalog — either
order works; what can't happen first is drag/resize without the schema fields to
persist them into.

### Phase 3 — Window catalog + settings + tabs-as-primitive

Populate § 4's defaults-off catalog (start with the ones marked **planned** — party
frames, codex, chat channel tabs, debug/perf — since those already have epics feeding
their data; leave **speculative** entries for whenever their own design work lands).
Lift `chatPanel.ts`'s hand-built tab bar and Phase 1's hand-built filter tabs into the
shared `tabBar.ts` component (§ 5), retrofit both existing windows onto it, and make
inventory's filter tabs user-reorderable/hideable (still fixed-mode — the catalog is
the four existing filters, not user-invented ones). This is also the natural point to
build the settings surface implied by "toggled in settings" — likely the System Tray
window's catalog view *is* that settings surface, not a separate menu; worth deciding
here rather than building two.

### Phase 4 — Pinning, opacity, per-window settings, account-synced layouts

The remaining v2 schema fields that don't need edit-HUD mode's drag/resize machinery
to be useful on their own: pin/click-through (a window can be marked always-on-top
without ever being resized), opacity, and each window's own `settings` map growing
past "which tab is active" into real per-window preferences (e.g. inventory
remembering its last filter tab across sessions). Account-synced layouts land here
too, but only because Epic 11 (v0.8) is where accounts themselves land
(GAME_DESIGN.md § Editable HUD's `localStorage → account save` commitment) — this
phase's account-sync piece is gated on that epic's account system existing, not on
anything else in this doc.

## Open questions

1. **System Tray window's exact contents.** It needs to hold the edit-HUD entry point
   and global reset at minimum (§ 3); whether it also becomes the general settings
   surface (chat mute/block toggles, profanity filter — GAME_DESIGN.md § Social
   fabric's "everything toggleable") or those stay a separate non-HUD settings screen
   is undecided. Revisit in Phase 3 when the catalog UI is actually being built.
2. **Persisted-layout vs. touch-profile precedence**, recorded in § 6 — needs a
   decision when Phase 2 wires `loadPersisted()` into boot, not before.
3. **Per-window settings versioning.** The `settings` map is free-form per window by
   design (§ 6) — if a window's settings shape changes later (e.g. inventory adds a
   sort-order preference), that window owns its own forward-compat parsing. Worth a
   one-line convention (ignore unknown keys, default missing ones) written down when
   the first window actually needs it, not speculatively now.
