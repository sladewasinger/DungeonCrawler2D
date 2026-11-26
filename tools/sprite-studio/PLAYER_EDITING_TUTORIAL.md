# Editing & Sculpting the 3D Player Model (`player.blend`)

This tutorial walks through everything you need to know to sculpt, tweak armor/hair, adjust sockets, and re-bake sprites from [`player.blend`](player.blend).

> [!IMPORTANT]
> - **Save a working copy (or edit `player.blend` directly), and never run `build_player.py` afterward**—running `build_player.py` regenerates `player.blend` from scratch and overwrites any manual Blender edits.

---

## 1. Scene Layout: Collections & Objects

`export_player_layers.py` discovers each baked sprite sheet strictly by **Blender Collection name** and uses `ShaderNodeHoldout` occluders (e.g., hair/hood masks out behind the skull, boots mask out feet/ankles) automatically.

| Collection | Main Deformed / Sculpted Meshes | Rigid Bone-Parented Parts (`Parent Type: Bone`) | Target Layer ID |
| :--- | :--- | :--- | :--- |
| `Core_Rig` | — | `CharacterRoot`, `Rig_Hero`, `StudioCam`, `StudioSun`, `Socket_Shoulder_L/R`, `Socket_Hand_L/R`, `Socket_Head`, `Socket_Back` | — |
| `Body_Male_Core` | `Male_Body_Sculpt` | `Male_EyeW_L/R`, `Male_EyeIris_L/R`, `Male_EyePupil_L/R`, `Male_EyeSpec_L/R`, `Male_Brow_L/R` → `Head` | `body-male` |
| `Body_Female_Core` | `Female_Body_Sculpt` | `Fem_EyeW_L/R`, `Fem_EyeIris_L/R`, `Fem_EyePupil_L/R`, `Fem_EyeSpec_L/R`, `Fem_Brow_L/R`, `Fem_Lash_L/R` → `Head` | `body-female` |
| `Body_Male_Arms`, `Body_Female_Arms` | *(empty compatibility collections)* | — | `body-male-arms`, `body-female-arms` |
| `Hair_Short` | `Hair_Short_Sculpt` → `Head` | — | `hair-short` |
| `Hair_Long` | `Hair_Long_Sculpt` → `Head` | — | `hair-long` |
| `Hair_Spiky` | `Hair_Spiky_Sculpt` → `Head` | — | `hair-spiky` |
| `Hair_Ponytail` | `Hair_Ponytail_Sculpt` → `Head` | `HairPony_Band` (`Hero_AccentGold`) → `Head` | `hair-ponytail` |
| `Armor_Head_LeatherHood` | — | `Hood_Crown`, `Hood_Peak`, `Hood_Brim` → `Head`; `Hood_Cowl`, `Hood_Clasp` → `Torso` | `armor-head-leather-hood` |
| `Armor_Chest_LeatherTunic_Male` | `Tunic_Male_Sculpt` | `Tunic_Male_Belt`, `Tunic_Male_Buckle` → `Pelvis`; `Tunic_Male_Pauldron_L/R` → `Torso` | `armor-chest-leather-tunic-male` |
| `Armor_Chest_LeatherTunic_Female` | `Tunic_Female_Sculpt` | `Tunic_Female_Belt`, `Tunic_Female_Buckle` → `Pelvis`; `Tunic_Female_Pauldron_L/R` → `Torso` | `armor-chest-leather-tunic-female` |
| `Armor_Chest_Sleeves_Male`, `_Female` | *(empty compatibility collections)* | — | `armor-chest-sleeves-*` |
| `Armor_Legs_LeatherLeggings_Male` | `Leggings_Male_Sculpt` | `Leggings_Male_Knee_L/R` → `Shin_L/R` | `armor-legs-leather-leggings-male` |
| `Armor_Legs_LeatherLeggings_Female` | `Leggings_Female_Sculpt` | `Leggings_Female_Knee_L/R` → `Shin_L/R` | `armor-legs-leather-leggings-female` |
| `Armor_Feet_LeatherBoots` | `Boot_L_Sculpt`, `Boot_R_Sculpt` | `Boot_Cuff_L/R` → `Shin_L/R` | `armor-feet-leather-boots` |

> [!TIP]
> Why are `Body_*_Arms` and `Armor_Chest_Sleeves_*` empty? In `player.blend`, arms are sculpted continuously onto `*_Body_Sculpt` and sleeves are sculpted onto `Tunic_*_Sculpt`. Those four empty collections stay present so `bakePlayerAssets.mjs` keeps producing tiny `0.6 kB` transparent WebP sheets cleanly alongside older `player_v2.blend` exports without changing any game compositor code.

---

## 2. Step-by-Step Sculpting Workflow

### Step A: Switch `Rig_Hero` to **Rest Position** Before Sculpting

`player.blend` opens in **Pose Position** (arms rotated down against the hips at `Hero_Idle` frame 1). Sculpting in Pose Position pulls symmetry off-center and risks merging sleeves into the torso.

1. Select **`Rig_Hero`** in the Outliner (`Core_Rig`).
2. Open **Object Data Properties** (the green stick-figure icon) → **Pose** panel.
3. Click **`Rest Position`**.
   - The character snaps into the clean **A-pose**, where `X`-mirror symmetry aligns accurately and arms sit clear of the torso.
4. Unhide whichever collection you want to sculpt in the Outliner (`Hair_*`, `Body_Female_Core`, `Armor_Chest_LeatherTunic_Male`, etc.).
5. When you are done sculpting, click **`Pose Position`** back on before saving (`Ctrl+S`) or baking.

### Step B: Which Brushes Keep Weights vs. Wipe Weights

- **Safe without re-rigging (`Grab`, `Clay Strips`, `Inflate`, `Smooth`, `Crease`, `Pinch`, `Flatten`, Proportional Editing in Edit Mode):**
  - These only move existing vertices, so all Automatic Weights (`ARMATURE_AUTO`) and multi-material face assignments (underwear, tunic collar/cuffs) stay **100% intact**.
  - Turn on **X Symmetry** (`X` icon in the top-right Sculpt header) on symmetrical body, tunic, leggings, and boot parts.
  - Keep `StudioCam` visibility in mind (`192×192` at `80 px/m` = ~`1.25 cm` per pixel): bold planes and crisp `Crease` lines read much better in-game than micro-surface texture.

- **If you Voxel Remesh (`Ctrl+R`) or enable `Dyntopo`:**
  - Remeshing replaces the topology, which wipes vertex weights and collapses multi-material zones to a single material slot. Follow Section 3 below for the mesh type you remeshed.

### Step C: Sculpting Hair (`Hair_Short`, `Hair_Long`, `Hair_Spiky`, `Hair_Ponytail`)

Each hairstyle is a single sculpted mesh (`Hair_*_Sculpt`, voxel-fused from curved almond-ridge locks) **rigidly parented to the `Head` bone**—there are **zero vertex weights** on hair, so you can `Voxel Remesh` (`Ctrl+R`), `Snake Hook`, `Clay Strips`, and `Crease` freely:

1. Switch `Rig_Hero` to **Rest Position** and unhide both the target `Hair_*` collection and a body (`Body_Male_Core` or `Body_Female_Core`) for reference.
2. Sculpt away (try `Snake Hook` for pulling new tips/spiky blades, `Crease` with `Pinch` for crisp anime lock grooves, and `Smooth` gently to blend roots into the scalp).
3. If you `Ctrl+R` Voxel Remesh hair (recommended voxel size `~0.008 m`):
   - Make sure its `Material` is still **`Hero_Hair`** (and **`HairPony_Band`** stays **`Hero_AccentGold`**).
   - Check `Object Properties → Relations`: **`Parent: Rig_Hero`**, **`Parent Type: Bone`**, **`Parent Bone: Head`**.
4. **Stay inside framing bounds**: Keep hair tips below `z = 1.62 m` (above crown), above `z = 0.86 m`, and `y <= +0.34 m` (behind head), and keep `Hair_Long` back locks around `y >= +0.16 m` so they clear the upper back of the leather tunic.

### Step D: Sculpting Bodies (`Male_Body_Sculpt`, `Female_Body_Sculpt`)

1. If you only reshaped proportions with **`Grab` / `Clay Strips` / `Smooth`**, check `Male_Eye*` / `Fem_Eye*` / `Brow*` objects in Object Mode and nudge them so whites/irises stay flush with your new face curvature (never bury eyes inside the skull or pull them far out in SE view).
2. If you changed chest/hip/thigh silhouette noticeably, also unhide the matching **`Tunic_*_Sculpt`** and **`Leggings_*_Sculpt`** and pull them out gently with **`Grab`** (~`2 cm` clearance over skin, preserving the armpit gap below `z = 0.88 m`).
3. Put **`Rig_Hero` back into `Pose Position`** and scrub through **`Hero_Idle`**, **`Hero_Run`**, **`Hero_Attack`** (especially frame 2 forward torso twist), and **`Hero_Bow`** to verify zero skin pokes through clothing and feet rest cleanly at `z >= 0`.

### Step E: Sculpting Fitted Armor (`Tunic_*_Sculpt`, `Leggings_*_Sculpt`, `Boot_*_Sculpt`, `Hood_*`)

- **Leather Tunic (`Tunic_*_Sculpt`)**: Keep the ~`2–3 cm` air gap between the inner sleeve and waist (`z <= 0.88 m`) so upper arms don't visually fuse into the ribs. If you adjust waist/belt width significantly, nudge `Tunic_*_Belt`, `Tunic_*_Buckle`, or `Tunic_*_Pauldron_*` in **Object Mode** (keeping their `Bone` parent intact).
- **Boots (`Boot_L_Sculpt`, `Boot_R_Sculpt`)**: Keep boot soles flat at `z >= 0.002 m` so feet don't clip underground, and nudge `Boot_Cuff_L/R` if you widen the shin cuff.
- **Hood (`Armor_Head_LeatherHood`)**: If you expand a hairstyle significantly, unhide `Armor_Head_LeatherHood` against `Body_Male_Core` / `Body_Female_Core` (`Hood` hides hair in-game, so fit `Hood_Crown` / `Hood_Brim` comfortably around the skull + eyes).

---

## 3. Re-Rigging After a Destructive Remesh (`Ctrl+R` / `Dyntopo`)

Use this only if you destroyed topology with `Ctrl+R` Voxel Remesh or `Dyntopo` on a **deforming mesh** (`Body_*_Sculpt`, `Tunic_*_Sculpt`, `Leggings_*_Sculpt`, or `Boot_*_Sculpt`):

1. Ensure **`Rig_Hero`** is in **Rest Position** (`Object Data → Pose → Rest Position`).
2. **Body meshes only — re-assign underwear material faces:**
   - Assign `Hero_Skin`, `Hero_UnderPants`, and `Hero_UnderShirt` (Female) to the mesh material slots, switch to **Edit Mode (`Tab`) → Face Select (`3`)**, select the briefs/bandeau faces, and click **Assign**.
3. **Tunic meshes only — re-assign collar & cuff trim:**
   - Assign `Hero_LeatherTunic`, `Hero_LeatherHood` (dark collar band), and `Hero_LeatherBoots` (forearm cuffs) via **Edit Mode → Face Select → Assign**.
4. **Parent with Automatic Weights:**
   - In **Object Mode**, make sure the mesh's transforms are applied (`Ctrl+A` → `All Transforms`) and `Rig_Hero` is visible.
   - Select your remeshed object, **`Ctrl`-click** `Rig_Hero` in the Outliner, and press **`Ctrl+P` → `With Automatic Weights`**.
   - Select your mesh → **Modifiers** (blue wrench icon) → open the **`Armature`** modifier → check **`Preserve Volume`** (prevents joint candy-wrapper shrinking).
5. **Prevent waist clipping on Tunic / Leggings (recommended):**
   - Because Tunic/Leggings sit slightly outside Body, `With Automatic Weights` alone can sometimes pick up slightly different shoulder/hip ratios. To copy exact body weights cleanly:
     - Select `Tunic_Male_Sculpt` (or `Leggings_Male_Sculpt`), add a **`Data Transfer`** modifier **above** `Armature`, set **Source** = `Male_Body_Sculpt` (or `Female_Body_Sculpt`), check **Vertex Data → `Vertex Groups`**, set **Mapping** = `Nearest Face Interpolated`, **Layers** = `All Layers` → `By Name`, click **Apply**, and scrub `Hero_Attack` to verify clean deformation.

---

## 4. Protected Pipeline Hooks (Do Not Break)

Do **not** rename or delete any of the following—`export_player_layers.py` and the in-game `playerRecolor.ts` shader pipeline depend on exact names:

1. **Exact Collection Names** (`Core_Rig`, `Body_Male_Core`, `Body_Female_Core`, `Hair_Short`, `Hair_Long`, `Hair_Spiky`, `Hair_Ponytail`, `Armor_Head_LeatherHood`, `Armor_Chest_LeatherTunic_Male`, `Armor_Chest_LeatherTunic_Female`, `Armor_Legs_LeatherLeggings_Male`, `Armor_Legs_LeatherLeggings_Female`, `Armor_Feet_LeatherBoots`, plus empty `Body_*_Arms` and `Armor_Chest_Sleeves_*`).
2. **Everything inside `Core_Rig`**: `CharacterRoot`, `Rig_Hero`, `StudioCam`, `StudioSun`, and `Socket_Shoulder_L`, `Socket_Shoulder_R`, `Socket_Hand_L`, `Socket_Hand_R`, `Socket_Head`, `Socket_Back`.
3. **The 3 Runtime Palette-Swapped Materials**:
   - **`Hero_Skin`** (sentinel magenta ramp -> swapped to player skin tone at runtime)
   - **`Hero_EyeIris`** (sentinel blue ramp -> swapped to eye color)
   - **`Hero_Hair`** (sentinel lime-green ramp -> swapped to hair color)
   - Keep eye whites on **`Hero_EyeWhite`** and pupils on **`Hero_EyePupil`**. Do not use Blender Sculpt Vertex Paint (`Studio` toon materials ignore vertex color attributes).
4. **Return `Rig_Hero` to `Pose Position`** before `Ctrl+S` saving.

---

## 5. Moving Sockets & Re-Baking to the Game

If you lengthen/shorten arms or shift shoulder/hand pose, nudge **`Socket_Hand_L`**, **`Socket_Hand_R`**, **`Socket_Shoulder_L/R`**, **`Socket_Head`**, or **`Socket_Back`** (`Bone`-parented empties inside `Core_Rig`) so held swords, torches, bows, and shields line up cleanly with the palm/grip.

### Fast Re-Bake Commands (Run from Repo Root)

```powershell
# Bake all 16 layers + weapon-bow + sockets from player.blend (~5.5 min)
npm run player:bake

# Fast iteration: bake ONLY edited hair styles (~20–25s per layer)
npm run player:bake -- player.blend hair-short hair-long hair-spiky hair-ponytail

# Bake ONLY edited female body + update hair/hood holdout masks against new head shape
npm run player:bake -- player.blend body-female hair-short hair-long hair-spiky hair-ponytail armor-head-leather-hood

# Bake ONLY edited male chest tunic + boots
npm run player:bake -- player.blend armor-chest-leather-tunic-male armor-feet-leather-boots

# Re-export ONLY socket transforms (instant, ~2s) when only Socket_* empties moved
npm run player:bake -- player.blend sockets-only

# Re-export ONLY the 3D 8-direction held bow overlay
npm run player:bake -- player.blend bow-only
```

All exported WebP sprites land in [`packages/client/public/assets/player/`](../../packages/client/public/assets/player/) and update `bakeVersion` in [`player-rig.json`](../../packages/client/public/assets/player/player-rig.json) automatically. Run `npm run dev` (or press **`F5`** if already running) to inspect live in-game and in the Title Screen SE portrait preview.

---

## 6. Quick Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Sculpted mesh exploded / stretched weirdly in game | `Rig_Hero` was saved in **Rest Position**, or object scale wasn't applied | Switch `Rig_Hero` to **Pose Position**, or apply scale (`Ctrl+A` → `Scale`) in Rest Position |
| Hair / skin didn't recolor in-game (stayed brown/white) | Wrong material name or Vertex Paint used | Assign exact `Hero_Hair` / `Hero_Skin` / `Hero_EyeIris` material slot |
| Top of ponytail or spiky hair clipped flat at top of portrait | Geometry exceeded `z ≈ 1.63 m` camera ceiling | Lower tips slightly in Rest Position (`z <= 1.62 m`) |
| Skin pokes through tunic during attack swing | Body silhouette wider than tunic or tunic lost weights | Push tunic outward ~2 cm or re-sync weights via `Data Transfer` from `Body_Sculpt` |
| Held sword/shield floats off the hand | Arm proportions changed without moving hand sockets | Select `Socket_Hand_L/R`, nudge to center of fist, run `npm run player:bake -- player.blend sockets-only` |
