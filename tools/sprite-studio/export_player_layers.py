"""Headless Blender exporter for palette-indexed Holdout-masked 8-dir Player layers & shoulder sockets."""

import json
import math
import os
import sys
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import studio_core  # noqa: E402

CELL_PX = 192
DIRS_5 = (("south", 0.0), ("se", 45.0), ("side", 90.0), ("ne", 135.0), ("north", 180.0))

CLIPS = (
    ("Hero_Idle", "idle", 4, 6, False),
    ("Hero_Walk", "walk", 6, 7, False),
    ("Hero_Run", "run", 6, 11, False),
    ("Hero_Jump", "jump", 2, 8, False),
    ("Hero_Fall", "fall", 2, 8, False),
    ("Hero_Dodge", "dodge", 6, 16, True),
    ("Hero_Downed", "downed", 2, 4, True),
    ("Hero_Swim", "swim", 4, 6, False),
)

ALL_LAYER_COLLECTIONS = (
    "Body_Male_Core", "Body_Male_Arms",
    "Body_Female_Core", "Body_Female_Arms",
    "Hair_Short", "Hair_Long", "Hair_Spiky", "Hair_Ponytail",
    "Armor_Head_LeatherHood",
    "Armor_Chest_LeatherTunic_Male", "Armor_Chest_LeatherTunic_Female",
    "Armor_Chest_Sleeves_Male", "Armor_Chest_Sleeves_Female",
    "Armor_Legs_LeatherLeggings_Male", "Armor_Legs_LeatherLeggings_Female",
    "Armor_Feet_LeatherBoots",
)


def parse_cli_opts(argv):
    args = argv[argv.index("--") + 1 :] if "--" in argv else []
    opts = {}
    for i in range(0, len(args) - 1, 2):
        opts[args[i]] = args[i + 1]
    if "--out" not in opts:
        raise ValueError("Missing --out")
    only_layers = set(opts["--layers"].split(",")) if "--layers" in opts else None
    return {"out": opts["--out"], "only_layers": only_layers}


def make_holdout_material():
    """Create a pure Holdout shader punching clean alpha holes where body occludes overlays."""
    mat = bpy.data.materials.get("StudioHoldoutMat")
    if mat:
        bpy.data.materials.remove(mat)
    mat = bpy.data.materials.new("StudioHoldoutMat")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    hold = nt.nodes.new("ShaderNodeHoldout")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(hold.outputs["Holdout"], out.inputs["Surface"])
    return mat


def install_sentinel_materials():
    """Replace customizable toon ramps with high-chroma sentinel colors for runtime palette swap."""
    specs = {
        "Hero_Skin": ("#a00050", "#d2006e", "#ff008c", 0.25, 0.70),
        "Hero_EyeIris": ("#008ca0", "#00c8dc", "#00ffff", 0.24, 0.70),
        "Hero_Hair": ("#28a000", "#46d200", "#6eff00", 0.26, 0.68),
    }
    for name, (s, b, h, tm, th) in specs.items():
        old = bpy.data.materials.get(name)
        repl = studio_core.make_toon_material(f"{name}_Sentinel", s, b, h, t_mid=tm, t_hi=th)
        for obj in bpy.data.objects:
            if obj.type != "MESH":
                continue
            for idx, m in enumerate(obj.data.materials):
                if m == old:
                    obj.data.materials[idx] = repl


def capture_original_materials(col_names):
    saved = []
    for cname in col_names:
        col = bpy.data.collections.get(cname)
        if not col:
            continue
        for obj in col.objects:
            if obj.type == "MESH":
                saved.append((obj, list(obj.data.materials)))
    return saved


def assign_holdout(saved_pairs, holdout_mat):
    for obj, mats in saved_pairs:
        for i in range(len(mats)):
            obj.data.materials[i] = holdout_mat


def restore_materials(saved_pairs):
    for obj, mats in saved_pairs:
        for i, m in enumerate(mats):
            obj.data.materials[i] = m


def set_visible_collections(names):
    active = set(names)
    for cname in ALL_LAYER_COLLECTIONS:
        col = bpy.data.collections.get(cname)
        if col:
            vis = cname in active
            col.hide_viewport = not vis
            col.hide_render = not vis


def bind_action(arm_obj, action_name):
    action = bpy.data.actions[action_name]
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    arm_obj.animation_data.action = action
    if hasattr(arm_obj.animation_data, "action_slot"):
        slots = getattr(action, "slots", None)
        arm_obj.animation_data.action_slot = slots[0] if slots and len(slots) > 0 else None


def render_frame_pair(out_dir, layer_id, cname, dname, f):
    scene = bpy.context.scene
    view_layer = scene.view_layers[0]
    depth_mat = bpy.data.materials["StudioDepthMat"]
    layer_dir = os.path.join(out_dir, layer_id)
    os.makedirs(layer_dir, exist_ok=True)
    color_path = os.path.join(layer_dir, f"{cname}_{dname}_f{f}.png")
    depth_path = os.path.join(layer_dir, f"{cname}_{dname}_f{f}_depth.png")
    view_layer.material_override = None
    scene.render.filepath = color_path
    bpy.ops.render.render(write_still=True)
    view_layer.material_override = depth_mat
    scene.render.filepath = depth_path
    bpy.ops.render.render(write_still=True)
    view_layer.material_override = None


def render_layer(out_dir, layer_spec, holdout_mat):
    """Render all clips × 5 dirs + portrait frame for a single modular body/hair/armor layer."""
    arm_obj = bpy.data.objects["Rig_Hero"]
    root = bpy.data.objects["CharacterRoot"]
    layer_id = layer_spec["id"]
    hold_saved = capture_original_materials(layer_spec["holdoutCols"])
    if hold_saved:
        assign_holdout(hold_saved, holdout_mat)
    try:
        for act_name, cname, count, _fps, full_arms in CLIPS:
            active_cols = layer_spec["armlessCols"] if not full_arms else layer_spec["fullArmCols"]
            if not active_cols:
                continue
            bind_action(arm_obj, act_name)
            set_visible_collections(active_cols + layer_spec["holdoutCols"])
            for dname, yaw in DIRS_5:
                root.rotation_euler = Euler((0.0, 0.0, math.radians(yaw)), "XYZ")
                for f in range(1, count + 1):
                    bpy.context.scene.frame_set(f)
                    bpy.context.view_layer.update()
                    render_frame_pair(out_dir, layer_id, cname, dname, f)
        if not layer_spec.get("skipPortrait", False):
            bind_action(arm_obj, "Hero_Idle")
            set_visible_collections(layer_spec["fullArmCols"] + layer_spec["holdoutCols"])
            root.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
            bpy.context.scene.frame_set(1)
            bpy.context.view_layer.update()
            render_frame_pair(out_dir, layer_id, "portrait", "south", 1)
    finally:
        root.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
        if hold_saved:
            restore_materials(hold_saved)


def project_px(scene, cam, pt):
    co = world_to_camera_view(scene, cam, pt)
    return [float(co.x * CELL_PX), float((1.0 - co.y) * CELL_PX), float(co.z)]


def hand_entry(scene, cam, elbow_world, hand_world, spine_xy):
    pe = project_px(scene, cam, elbow_world)
    ph = project_px(scene, cam, hand_world)
    spine_same_z = project_px(scene, cam, Vector((spine_xy.x, spine_xy.y, hand_world.z)))
    return {
        "px": ph[0],
        "py": ph[1],
        "angle": round(math.atan2(ph[1] - pe[1], ph[0] - pe[0]), 4),
        "behind": ph[2] > spine_same_z[2] + 0.01,
    }


def export_shoulder_sockets(out_dir):
    """Project male and female shoulder & hand 2D sockets and torso depth across clips."""
    scene = bpy.context.scene
    cam = bpy.data.objects["StudioCam"]
    root = bpy.data.objects["CharacterRoot"]
    arm_obj = bpy.data.objects["Rig_Hero"]
    sock_l = bpy.data.objects["Socket_Shoulder_L"]
    sock_r = bpy.data.objects["Socket_Shoulder_R"]
    hand_l = bpy.data.objects["Socket_Hand_L"]
    hand_r = bpy.data.objects["Socket_Hand_R"]
    sockets = {"male": {}, "female": {}}
    hands = {"male": {}, "female": {}}
    try:
        for act_name, cname, count, _fps, full_arms in CLIPS:
            if full_arms:
                continue
            bind_action(arm_obj, act_name)
            for gender in ("male", "female"):
                sockets[gender].setdefault(cname, {})
                hands[gender].setdefault(cname, {})
            for dname, yaw in DIRS_5:
                root.rotation_euler = Euler((0.0, 0.0, math.radians(yaw)), "XYZ")
                for g in ("male", "female"):
                    sockets[g][cname][dname] = []
                    hands[g][cname][dname] = []
                for f in range(1, count + 1):
                    scene.frame_set(f)
                    bpy.context.view_layer.update()
                    pt_l = sock_l.matrix_world.translation.copy()
                    pt_r = sock_r.matrix_world.translation.copy()
                    mid = (pt_l + pt_r) * 0.5
                    torso_p = project_px(scene, cam, mid)
                    lr_span = pt_l - pt_r
                    lr_axis = lr_span.normalized() if lr_span.length > 1e-4 else Vector((1.0, 0.0, 0.0))
                    hl_base = hand_l.matrix_world.translation.copy()
                    hr_base = hand_r.matrix_world.translation.copy()
                    el_l = arm_obj.matrix_world @ arm_obj.pose.bones["Forearm_L"].head
                    el_r = arm_obj.matrix_world @ arm_obj.pose.bones["Forearm_R"].head
                    for gender, width_scale, z_off, hand_in in (("male", 1.0, 0.0, 0.0), ("female", 0.86, -0.01, 0.025)):
                        wl = mid + (pt_l - mid) * width_scale + Vector((0.0, 0.0, z_off))
                        wr = mid + (pt_r - mid) * width_scale + Vector((0.0, 0.0, z_off))
                        pl = project_px(scene, cam, wl)
                        pr = project_px(scene, cam, wr)
                        sockets[gender][cname][dname].append({
                            "left": {"px": pl[0], "py": pl[1], "behind": pl[2] > torso_p[2] + 0.01},
                            "right": {"px": pr[0], "py": pr[1], "behind": pr[2] > torso_p[2] + 0.01},
                        })
                        hl_pos = hl_base - lr_axis * hand_in + Vector((0.0, 0.0, z_off))
                        hr_pos = hr_base + lr_axis * hand_in + Vector((0.0, 0.0, z_off))
                        hands[gender][cname][dname].append({
                            "left": hand_entry(scene, cam, el_l - lr_axis * hand_in, hl_pos, mid),
                            "right": hand_entry(scene, cam, el_r + lr_axis * hand_in, hr_pos, mid),
                        })
    finally:
        root.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
    with open(os.path.join(out_dir, "raw_sockets.json"), "w", encoding="utf-8") as fh:
        json.dump({**sockets, "handSockets": hands}, fh, indent=2)


def layer_specs():
    """Return modular player layers paired with Core-only Holdout occluders (fixing side clipping)."""
    fem_core_hold = ["Body_Female_Core"]
    male_core_hold = ["Body_Male_Core"]
    return [
        {"id": "body-male", "armlessCols": ["Body_Male_Core"], "fullArmCols": ["Body_Male_Core", "Body_Male_Arms"], "holdoutCols": []},
        {"id": "body-female", "armlessCols": ["Body_Female_Core"], "fullArmCols": ["Body_Female_Core", "Body_Female_Arms"], "holdoutCols": []},
        {"id": "body-male-arms", "armlessCols": ["Body_Male_Arms"], "fullArmCols": [], "holdoutCols": male_core_hold, "skipPortrait": True},
        {"id": "body-female-arms", "armlessCols": ["Body_Female_Arms"], "fullArmCols": [], "holdoutCols": fem_core_hold, "skipPortrait": True},
        {"id": "hair-short", "armlessCols": ["Hair_Short"], "fullArmCols": ["Hair_Short"], "holdoutCols": fem_core_hold},
        {"id": "hair-long", "armlessCols": ["Hair_Long"], "fullArmCols": ["Hair_Long"], "holdoutCols": fem_core_hold},
        {"id": "hair-spiky", "armlessCols": ["Hair_Spiky"], "fullArmCols": ["Hair_Spiky"], "holdoutCols": fem_core_hold},
        {"id": "hair-ponytail", "armlessCols": ["Hair_Ponytail"], "fullArmCols": ["Hair_Ponytail"], "holdoutCols": fem_core_hold},
        {"id": "armor-head-leather-hood", "armlessCols": ["Armor_Head_LeatherHood"], "fullArmCols": ["Armor_Head_LeatherHood"], "holdoutCols": fem_core_hold},
        {"id": "armor-chest-leather-tunic-male", "armlessCols": ["Armor_Chest_LeatherTunic_Male"], "fullArmCols": ["Armor_Chest_LeatherTunic_Male", "Armor_Chest_Sleeves_Male"], "holdoutCols": male_core_hold},
        {"id": "armor-chest-leather-tunic-female", "armlessCols": ["Armor_Chest_LeatherTunic_Female"], "fullArmCols": ["Armor_Chest_LeatherTunic_Female", "Armor_Chest_Sleeves_Female"], "holdoutCols": fem_core_hold},
        {"id": "armor-chest-sleeves-male", "armlessCols": ["Armor_Chest_Sleeves_Male"], "fullArmCols": [], "holdoutCols": ["Body_Male_Core", "Armor_Chest_LeatherTunic_Male"], "skipPortrait": True},
        {"id": "armor-chest-sleeves-female", "armlessCols": ["Armor_Chest_Sleeves_Female"], "fullArmCols": [], "holdoutCols": ["Body_Female_Core", "Armor_Chest_LeatherTunic_Female"], "skipPortrait": True},
        {"id": "armor-legs-leather-leggings-male", "armlessCols": ["Armor_Legs_LeatherLeggings_Male"], "fullArmCols": ["Armor_Legs_LeatherLeggings_Male"], "holdoutCols": male_core_hold},
        {"id": "armor-legs-leather-leggings-female", "armlessCols": ["Armor_Legs_LeatherLeggings_Female"], "fullArmCols": ["Armor_Legs_LeatherLeggings_Female"], "holdoutCols": fem_core_hold},
        {"id": "armor-feet-leather-boots", "armlessCols": ["Armor_Feet_LeatherBoots"], "fullArmCols": ["Armor_Feet_LeatherBoots"], "holdoutCols": fem_core_hold},
    ]


def main():
    cli = parse_cli_opts(sys.argv)
    out_dir = cli["out"]
    only_layers = cli["only_layers"]
    os.makedirs(out_dir, exist_ok=True)
    scene = bpy.context.scene
    studio_core.configure_color_and_render(scene, CELL_PX)
    if "--sockets-only" in sys.argv:
        export_shoulder_sockets(out_dir)
        print(f"Exported shoulder sockets only to {out_dir}")
        return
    cam = bpy.data.objects["StudioCam"]
    dist = cam.location.length
    studio_core.make_depth_override_material(near_dist=dist - 1.75, far_dist=dist + 1.75)

    if only_layers is None:
        export_shoulder_sockets(out_dir)
    install_sentinel_materials()
    holdout_mat = make_holdout_material()
    specs = [s for s in layer_specs() if only_layers is None or s["id"] in only_layers]
    for spec in specs:
        render_layer(out_dir, spec, holdout_mat)

    print(f"Exported {len(specs)} player layers to {out_dir}")


if __name__ == "__main__":
    main()
