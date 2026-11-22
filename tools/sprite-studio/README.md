# 3D-to-Pixel Sprite Studio (`tools/sprite-studio`)

Repeatable Blender EEVEE -> Cainos-style pixel art pipeline generating cleanly shaded, 4-direction (`south`, `side` mirrored for West, `north`) animated creature and character spritesheets at locked `32 art px / meter` (`scale = 0.50` in-game).

## Fast Iteration Workflow
1. Edit or animate your model in Blender (`tools/sprite-studio/<creature>.blend`) and save (`Ctrl+S`).
2. Run one command from repo root:
   ```bash
   npm run sprite:bake -- goblin
   ```
   This runs headless Blender (`export_blend.py`), discovers every matching Action (`idle`, `walk`, `run`, `attack`, `corpse`), renders color + depth turntable frames (`South`, `Side`, `North`), applies Cainos hue-shifted sel-out post-processing (`bakeSpriteSheet.mjs`), writes `<creature>-sheet.png` + `<creature>.png`, and updates `sprite-manifest.json`.
3. Refresh `http://localhost:5174/?sandbox=1` to preview live.

## Pipeline Modules
- `studio_core.py`: Locked `38°` orthographic `StudioCam`, upper-left `StudioSun`, `Standard` color management (`0.01px` filter, transparent RGBA), 3-band flat `make_toon_material()` EEVEE cel shader, `StudioDepthMat` linear depth pass, and `render_turntable_clip()`.
- `build_goblin.py` / `goblin.blend`: Reusable `Rig_ChibiHumanoid` armature (`Socket_Hand_R`, `Socket_Hand_L`, `Socket_Head`, `Socket_Back` sockets) and bare Goblin model.
- `humanoid_actions.py`: Reusable `Rig_ChibiHumanoid` Actions (`Walk`, `Run`, `Attack`, `Corpse`) runnable without altering custom sculpted meshes (`align_ears_to_bones()`, `apply_humanoid_actions()`).
- `export_blend.py`: Headless Blender CLI script rendering all canonical Actions cleanly without modifying `.blend`.
- `pngCodec.mjs`: Pure Node 8-bit PNG decoder and encoder.
- `pixelPost.mjs`: Binary alpha cleanup, internal depth-crease separation, hue-shifted colored outlines (`sel-out`), horizontal centering, and foot grounding.
- `bakeSpriteSheet.mjs` & `manifestSync.mjs`: Multi-clip spritesheet packer and `sprite-manifest.json` updater.
- `runBake.mjs`: Cross-platform wrapper backing `npm run sprite:bake -- <creature> [reviewPath]`.
