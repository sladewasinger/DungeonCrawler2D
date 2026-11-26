# 3D-to-Pixel Sprite Studio (`tools/sprite-studio`)

Repeatable Blender EEVEE -> Cainos-style pixel art pipeline generating cleanly shaded, 8-direction (`south`, `se`, `side` mirrored for West, `ne`, `north`; `--dirs 8` default, or `4` with `--dirs 4`) animated creature spritesheets at default `48 art px / meter` (`scale = 0.3333` in-game: `96x96` Goblin & Slime, `120x120` Boar, Spider & Wolf, `144x144` Skeleton, `168x168` Bear & Orc, `192x192` Stone Golem).

## Fast Iteration Workflow
1. Edit or animate your model in Blender (`tools/sprite-studio/<creature>.blend`) and save (`Ctrl+S`).
2. Run one command from repo root:
   ```bash
   npm run sprite:bake -- goblin
   npm run sprite:bake -- boar
   npm run sprite:bake -- golem
   npm run sprite:bake -- spider
   npm run sprite:bake -- slime
   npm run sprite:bake -- wolf
   npm run sprite:bake -- bear
   npm run sprite:bake -- skeleton
   npm run sprite:bake -- orc
   npm run sprite:bake -- goblin --pxPerMeter 64
   ```
   This runs headless Blender (`export_blend.py`), scales cell resolution cleanly around `StudioCam.ortho_scale` at `48 px/m` by default (override with `--pxPerMeter <n>`), discovers every matching Action (`idle`, `walk`, `run`, `attack`, `corpse`) plus optional `fps` / `loopStart` / `loopEnd` custom properties, renders color + depth turntable frames (`South`, `Side`, `North`), applies Cainos hue-shifted sel-out post-processing (`bakeSpriteSheet.mjs`), writes lossless WebP `<creature>-sheet.webp` + `<creature>.webp`, and updates `sprite-manifest.json`.
3. Refresh `http://localhost:5173/?sandbox=1` (Vite increments port if `5173` is busy) to preview live.

## Editing & Re-Exporting the 3D Player (`player.blend`)

> **Canonical Sculpting & Rigging Guide:** See [PLAYER_EDITING_TUTORIAL.md](PLAYER_EDITING_TUTORIAL.md) for the complete `Rest Position` vs. `Pose Position`, `ARMATURE_AUTO` weight-transfer, `Core_Rig` / `Hero_Skin` protected hook checklist, and Blender editing workflow before modifying [`player.blend`](player.blend).
>
> **Important:** After making manual edits in Blender, **never run `build_player.py`**—it regenerates the scene from scratch and overwrites manual edits.

```powershell
npm run player:bake                              # Full bake (all 16 layers + sockets + player-rig.json)
npm run player:bake -- body-female body-female-arms  # Re-bake specific layers (~25s/layer)
npm run player:bake -- sockets-only              # Re-export shoulder/hand sockets only
npm run player:bake -- bow-only                  # Re-export 3D 8-direction bow overlay only
```

After baking completes, press **`F5`** in your browser (`bakeVersion` in `player-rig.json` cache-busts sheets). Keep the `Core_Rig` empties, Collection names, and `Hero_Skin` / `Hero_EyeIris` / `Hero_Hair` materials intact (see [PLAYER_EDITING_TUTORIAL.md](PLAYER_EDITING_TUTORIAL.md) for all `16` layer IDs).

## Pipeline Modules
- `studio_core.py`: Locked `38°` orthographic `StudioCam`, upper-left `StudioSun`, `Standard` color management (`0.01px` filter, transparent RGBA), 3-band flat `make_toon_material()` EEVEE cel shader, `StudioDepthMat` linear depth pass, and `render_turntable_clip()`.
- `build_goblin.py` / `goblin.blend`: Reusable `Rig_ChibiHumanoid` armature (`Socket_Hand_R`, `Socket_Hand_L`, `Socket_Head`, `Socket_Back` sockets) and bare Goblin model (`64px` base / `96x96` default export).
- `humanoid_actions.py`: Reusable `Rig_ChibiHumanoid` Actions (`Idle`, `Walk`, `Run`, `Attack`, `Corpse`) runnable without altering custom sculpted meshes (`align_ears_to_bones()`, `apply_humanoid_actions()`).
- `build_boar.py` / `boar.blend`: Reusable `Rig_Quadruped` armature (`Socket_Head`, `Socket_Back`, `Socket_Mouth` sockets) and sculpted wedge Wild Boar (`80px` base / `120x120` default export, `groundY = 96`, continuous thin dorsal mohawk, C-curved crescent tusks, snout ridges, jowl bristles, and hocked legs into cloven hooves).
- `quadruped_actions.py`: Reusable `Rig_Quadruped` Actions (`Idle`, `Walk`, `Run`, 8-frame `Attack` [F1-3 pawing windup, F4-6 charge loop, F7-8 braking outro], and `Corpse`).
- `build_golem.py` / `golem.blend`: `Rig_GolemTitan` giant chiseled Rune & Moss Stone Golem (`128px` base / `192x192` default export, `groundY = 168`, `ᚺᚦᛉᛟ` chest runes, V-taper torso, wide bent stance, oversized gauntlet forearms).
- `golem_actions.py`: `Rig_GolemTitan` Actions (`Idle`, `Walk`, `Run`, two-handed overhead smash `Attack`, ruined stone heap `Corpse`).
- `build_spider.py` / `spider.blend`: Reusable 8-legged `Rig_Arachnid` Widow Spider (`80px` base / `120x120` default export, `groundY = 96`, crimson widow chevrons, 6 ruby eyes, ivory fangs, 8 3-segment legs).
- `arachnid_actions.py`: Reusable `Rig_Arachnid` Actions (alternating-tetrapod `Idle`, `Walk`, `Run`, wide threat rear-up lunge `Attack`, inverted curled `Corpse`).
- `build_slime.py` / `slime_actions.py` / `slime.blend`: `Rig_Slime` hornless translucent Emerald Slime (`64px` base / `96x96` default export, `groundY = 78`, `sprite_body_alpha = 0.78`, sunken amber eyes, glossy gelatin dome, body-slam lunge `Attack`, melted puddle `Corpse`).
- `build_wolf.py` / `wolf.blend`: `Rig_Quadruped` Timber Wolf (`80px` base / `120x120` default export, `groundY = 96`, slate coat, pale chest ruff, pointed ears, bushy plume tail, snapping bite charge).
- `build_bear.py` / `bear.blend`: `Rig_Quadruped` continuous organic Grizzly Bear (`112px` base / `168x168` default export, `groundY = 138`, sculpted withers & tapered skinned legs, honey muzzle, shoulder X-scar, rearing claw swipe `Attack`).
- `build_skeleton.py` / `skeleton_actions.py` / `skeleton.blend`: `Rig_SkeletonHumanoid` bare creepy Skeleton (`96px` base / `144x144` default export, `groundY = 120`, hollow cranium/sockets, hinged jaw chatter, open ribcage, claw hands, collapsed bone-pile `Corpse`, zero weapons/cape/horns).
- `build_orc.py` / `orc_actions.py` / `orc.blend`: `Rig_OrcBrute` Orc Warrior (`112px` base / `168x168` default export, `groundY = 141`, olive musculature, spiked steel pauldron, leather baldric/war-belt, tusks, double-bladed steel battleaxe).
- `build_player.py` / `player_actions.py` / `export_player_layers.py` / `bakePlayerAssets.mjs` / `runPlayerBake.mjs` / `player.blend`: Stylized Chibi-Heroic Player (`Rig_Hero`, `192×192` at `80 px/m`, `scale = 0.20`, `groundY = 148`, `61` sheet rows, `portraitRow = 60` rendered at SE `45°` yaw, `Socket_Shoulder_L/R`, `Socket_Hand_L/R`, `Socket_Head`, `Socket_Back`) built in `player.blend` with solid voxel-sculpted `Male`/`Female` bodies and fitted leather armor bound via `ARMATURE_AUTO` (+ weight-transferred Tunic/Leggings), 4 hairs (`Short`, `Long`, `Spiky`, `Ponytail`), 4 leather armor slots (`LeatherHood`, `LeatherTunic`, `LeatherLeggings`, `LeatherBoots`), and 12 Actions (`Hero_Idle`, `Hero_Walk`, `Hero_Run`, `Hero_Jump`, `Hero_Fall`, 6-frame dive-roll `Hero_Dodge`, `Hero_Downed`, `Hero_Swim`, 3-frame `Hero_Bow`, `Hero_CrouchIdle`, `Hero_CrouchWalk`, and 3-frame `Hero_Attack`). Run `npm run player:bake` (or `npm run player:bake -- body-female body-female-arms` / `sockets-only`) after saving Blender edits to export `ShaderNodeHoldout`-masked 8-dir sheets and sync `packages/client/public/assets/player/player-rig.json` (`bakeVersion` cache-busting).
- `build_gear.py` / `bakeGearAssets.mjs`: Renders and packs `48 px/m` (`scale = 0.3333`) 3D weapons/gear (`sword`, `flint-dagger`, `wooden-spear`, `iron-greatsword`, `axe`, `pickaxe`, `bow`, `bow-drawn`, `wooden-shield`, `torch-0..3`, `lantern-0..1`) as lossless `.webp` into `packages/client/public/assets/gear/` and syncs `sprite-manifest.json`.
- `render_player_preview.py`: Renders quick turntable, animation contact sheet, and scale lineup previews from `player.blend`.
- `export_blend.py`: Headless Blender CLI script rendering all canonical Actions cleanly without modifying `.blend`, including optional scene `sprite_body_alpha` translucency metadata.
- `pngCodec.mjs`: Pure Node 8-bit PNG decoder/encoder and lossless WebP encoder (`encodeLosslessWebp` via `ffmpeg`).
- `pixelPost.mjs`: Binary alpha cleanup, internal depth-crease separation, hue-shifted opaque crisp solid outlines (`applyOuterSelOut`, default `radiusPx = 2.0`), optional translucent gelatin body alpha (`applyTranslucentBodyAlpha`), horizontal centering, and foot grounding.
- `bakeSpriteSheet.mjs` & `manifestSync.mjs`: Multi-clip spritesheet packer and `sprite-manifest.json` updater (`scale = 16 / pxPerMeter`).
- `runBake.mjs`: Cross-platform wrapper backing `npm run sprite:bake -- <creature> [reviewPath] [--pxPerMeter <n>]`.
