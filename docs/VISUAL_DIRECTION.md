# Visual Direction — moody torchlit dungeon

v1's failure was presentation: muddy olive-grey tiles, random grass in a stone dungeon,
hooded-blob characters, zero lighting, programmer HUD. v2 exists to fix that. The bar:
**a screenshot of this game should look like a finished indie game you'd wishlist.**
Tonally: a deadly dungeon run as a twisted game show (Dungeon Crawler Carl energy) —
oppressive dark, warm islands of firelight, neon-vivid magic.

## The look in one paragraph

Dark, desaturated stone world lit by warm dynamic light. The dungeon floor sits in
near-black blues and greys; torches, braziers, effects, and portals carve pools of
orange, green, and teal light out of the darkness. Characters and monsters are crisp,
animated 16 px sprites with real silhouettes. Everything glows that should glow.
Everything moves that should move.

## Foundation rules

- **One tileset family, one resolution.** All world art is 16 px source, integer-scaled
  ×3 (48 px on screen) with `pixelArt: true`. Mixed source resolutions are forbidden —
  that's the #1 tell of asset soup. Primary pack: 0x72 DungeonTileset II (CC0) for
  terrain, props, heroes, monsters; anything added must match its scale and palette.
- **Palette discipline.** Base world: dark desaturated (stone `#2e2e3a`→`#494956`
  range, near-black `#14141c` voids). Accents are reserved and consistent:
  fire/torch `#ff9e3d`, poison `#7bd44a`, sanctuary/portal teal `#3dd6c3`,
  blood/damage `#e04a4a`, arcane `#8a6cff`, loot/gold `#ffd23d`. UI reuses these.
  No new hues without updating this doc.
- **Darkness is the canvas.** The world renders under a darkness layer; lights punch
  through it. Ambient ≈ 15–25% so unlit corridors read as genuinely dark. Every torch,
  fire area, projectile, portal, and crafting table is a light source with subtle
  flicker. Player carries a soft personal light so the game is never unplayably black.
- **Height reads through light and shadow**, not tint tables: elevated ground slightly
  brighter, pits darker, cliff faces in shadow, drop shadows under every airborne
  entity (the shadow blob stays glued to the ground — it's how players read z).

## Motion & juice (required, not polish-later)

- **Movement is 8-way; character animation is 4-way.** Input and simulation retain
  diagonal movement, while player visuals resolve facing to north/south/east/west
  to control animation scope and keep the sprite set coherent.

- **No static entities.** Everything alive has idle + run animations minimum (the 0x72
  pack ships them); attacks have windup/release/recover reads. Items on the ground
  bob and glint. Torches flicker. The portal swirls.
- **Hits feel like hits:** white hit-flash on the sprite, 2–3 px directional knockback
  visual, floating damage numbers in the accent palette, brief particle burst, tiny
  screen shake on your own hits/deaths only (never from others' actions — multiplayer
  courtesy).
- **Movement feel:** squash on landing, dust puffs on jump/land/turn, footstep
  particles on sprint. Camera eases; snaps only on teleport.
- **Effects are particles + light, not recolored rectangles:** fire areas are layered
  flame particles over embers with orange light; poison is drifting bubbles with a
  sickly green glow; steam billows and fades.

## UI

- **Pixel font everywhere** (m5x7 or equivalent CC0 bitmap font). Default browser
  fonts are forbidden in-game.
- **One panel language:** dark `#1a1a24` panels, 1 px `#494956` border, 4 px corner,
  consistent 8 px spacing grid, gold accents for selection. Every HUD element is a
  widget (id + anchor + offset + scale + visibility from a layout config) — no
  fixed-position UI, ever.
- Health/stamina bars are chunky, segmented, and readable at a glance; buffs/debuffs
  show as icon chips with duration pips; the hotbar shows item sprites, not text.
- Nameplates: small, dimmed until nearby; party members in teal, strangers in neutral
  grey — the palette carries the social information.

## Acceptance bar (checked with real screenshots each phase)

A 1280×720 screenshot at default zoom must show: (1) coherent single-resolution art,
(2) visible dynamic lighting with at least two light colors on screen, (3) an animated
character with a correct ground shadow, (4) zero default-font text, (5) the palette
above and nothing else. Any miss fails the phase — audits include the screenshot.

**The wall vertical-extent rule (user-decreed 2026-07-19, generator-enforced —
see ROADMAP):** a raised surface of height z must span at least **z + 1 tiles
north-to-south** — z rows of visible south face plus at least one walkable top
row. A 1-deep z1 wall is malformed (all face, no platform); z2 needs 3 deep.
Width is unconstrained (any width ≥ 1). This is a hard worldgen invariant, not a renderer
courtesy: the generator may never emit a raised region too shallow to show its
own top. Corollaries: safe-room kiosks are z2 terraces (not rock masses) deep
enough to carry their door in the face with an intact platform above; doors
render as the standalone leaf drawn over ordinary wall rows (no frame-post
pieces reading as half-walls, no masonry recolor, no suppression gap in the
top platform); pit rims carry ONE outline (the surrounding ground's), never
doubled by interior face side-closures.

Composed structures are atomic (added 2026-07-18 after review): doors/kiosks, chests,
fountains, and any multi-piece 0x72 structure render as their composed sprite unit —
frame pieces + leaf/body assembled the way the pack intends, punched INTO the wall
face — never assembled loosely from tiles, never interleaved with or overdrawn by
masonry rows. A door sliced by brick courses is an automatic audit fail. Wall grammar:
brick faces appear only on south-facing boundary rows; wall tops are dark stone caps;
deep solid rock is near-black mass — walls read as solid volume, not wallpapered face
texture. A projected south face owns the full lower visual cell and its collision span:
the underlying surface may still be floor, but grounded feet stop at the visible base.
Raised wall-top surfaces use their own height tint, never the lower neighbor's tint.
Door/portal cutouts are the only intentional holes in this rule. Terrain debugging must
show both the logical surface and any projected facade source/span at the cursor.
