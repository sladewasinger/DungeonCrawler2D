# 3D-to-Pixel Sprite Studio (`tools/sprite-studio`)

Repeatable Blender EEVEE -> Cainos-style pixel art pipeline generating cleanly shaded, 4-direction (`south`, `side` mirrored for West, `north`) animated creature and character spritesheets at locked `32 art px / meter` (`scale = 0.50` in-game).

## Pipeline Architecture
- `studio_core.py`: Locked `38°` orthographic `StudioCam` (`ortho_scale = cell_px / 32`), upper-left `StudioSun`, `Standard` color management (`0.01px` filter, transparent RGBA), `make_toon_material()` (`Diffuse BSDF -> ShaderToRGB -> Constant 3-stop ColorRamp -> Emission`), linear depth pass (`StudioDepthMat`), and `render_turntable_clip()` (`CharacterRoot` turntable rotation keeps upper-left key lighting consistent across all directions).
- `build_goblin.py` / `goblin.blend`: Reusable `Rig_ChibiHumanoid` bone hierarchy (with `Socket_Hand_R`, `Socket_Hand_L`, `Socket_Head`, `Socket_Back` attachment empties) and stylized bare Goblin prototype with a 6-frame `Goblin_Idle` breathing action (`24x30` art px outlined).
- `pngCodec.mjs`: Pure Node 8-bit PNG decoder and encoder.
- `pixelPost.mjs`: Binary alpha cleanup, internal depth-crease separation (using the rendered linear depth pass), hue-shifted colored outer outlines ("sel-out"), horizontal centering, and foot grounding.
- `bakeSpriteSheet.mjs`: CLI baker assembling `<creature>-sheet.png`, static fallback `<creature>.png`, and a 4x zoomed before/after contact sheet for visual QA.

## Typical Usage
1. In Blender (or via MCP), build and render turntable frames:
   ```python
   import sys
   sys.path.insert(0, r"d:\repos\dungeoncrawler2D\tools\sprite-studio")
   import studio_core, build_goblin
   build_goblin.build_goblin_scene(r"d:\repos\dungeoncrawler2D\tools\sprite-studio\goblin.blend")
   studio_core.render_turntable_clip(raw_dir, "idle", range(1, 7))
   ```
2. Run the Node pixel baker:
   ```bash
   node tools/sprite-studio/bakeSpriteSheet.mjs --creature goblin --clip idle --rawDir <raw_dir> --frames 6 --groundY 52
   ```
