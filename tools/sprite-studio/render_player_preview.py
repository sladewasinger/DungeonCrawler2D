"""Renders color+depth frames from player.blend across variants, 8-dir angles, hairs, and all 6 clips."""

import math
import os
import sys
import bpy
from mathutils import Euler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import studio_core  # noqa: E402

DIRS_5 = (("south", 0.0), ("se", 45.0), ("side", 90.0), ("ne", 135.0), ("north", 180.0))

TOGGLEABLE_COLLECTIONS = (
    "Body_Male_Core",
    "Body_Male_Arms",
    "Body_Female_Core",
    "Body_Female_Arms",
    "Hair_Short",
    "Hair_Long",
    "Hair_Spiky",
    "Hair_Ponytail",
    "Armor_Head_LeatherHood",
    "Armor_Chest_LeatherTunic_Male",
    "Armor_Chest_LeatherTunic_Female",
    "Armor_Chest_Sleeves_Male",
    "Armor_Chest_Sleeves_Female",
    "Armor_Legs_LeatherLeggings_Male",
    "Armor_Legs_LeatherLeggings_Female",
    "Armor_Feet_LeatherBoots",
)


def parse_out_dir(argv):
    args = argv[argv.index("--") + 1 :] if "--" in argv else []
    for i in range(0, len(args) - 1, 2):
        if args[i] == "--out":
            return args[i + 1]
    raise ValueError("Missing --out")


def set_only_collections(active_names):
    active = set(active_names)
    for name in TOGGLEABLE_COLLECTIONS:
        col = bpy.data.collections.get(name)
        if col:
            vis = name in active
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


def render_frame(out_dir, tag, yaw_deg, frame):
    scene = bpy.context.scene
    root = bpy.data.objects["CharacterRoot"]
    depth_mat = bpy.data.materials["StudioDepthMat"]
    view_layer = scene.view_layers[0]
    root.rotation_euler = Euler((0.0, 0.0, math.radians(yaw_deg)), "XYZ")
    scene.frame_set(frame)
    view_layer.material_override = None
    scene.render.filepath = os.path.join(out_dir, f"{tag}.png")
    bpy.ops.render.render(write_still=True)
    view_layer.material_override = depth_mat
    scene.render.filepath = os.path.join(out_dir, f"{tag}_depth.png")
    bpy.ops.render.render(write_still=True)
    view_layer.material_override = None
    root.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")


def main():
    out_dir = parse_out_dir(sys.argv)
    os.makedirs(out_dir, exist_ok=True)
    scene = bpy.context.scene
    studio_core.configure_color_and_render(scene, 144)
    cam = bpy.data.objects["StudioCam"]
    dist = cam.location.length
    studio_core.make_depth_override_material(near_dist=dist - 1.75, far_dist=dist + 1.75)

    arm_obj = bpy.data.objects["Rig_Hero"]
    bind_action(arm_obj, "Hero_Idle")

    variants = (
        ("male_base", ("Body_Male_Core", "Body_Male_Arms", "Hair_Short")),
        ("fem_base", ("Body_Female_Core", "Body_Female_Arms", "Hair_Long")),
        (
            "male_armored",
            (
                "Body_Male_Core",
                "Armor_Head_LeatherHood",
                "Armor_Chest_LeatherTunic_Male",
                "Armor_Chest_Sleeves_Male",
                "Armor_Legs_LeatherLeggings_Male",
                "Armor_Feet_LeatherBoots",
            ),
        ),
        (
            "fem_armored",
            (
                "Body_Female_Core",
                "Hair_Ponytail",
                "Armor_Chest_LeatherTunic_Female",
                "Armor_Chest_Sleeves_Female",
                "Armor_Legs_LeatherLeggings_Female",
                "Armor_Feet_LeatherBoots",
            ),
        ),
    )

    for vname, cols in variants:
        set_only_collections(cols)
        for dname, yaw in DIRS_5:
            render_frame(out_dir, f"{vname}_{dname}", yaw, 1)

    hairs = (
        ("hair_short", ("Body_Male_Core", "Body_Male_Arms", "Hair_Short")),
        ("hair_long", ("Body_Female_Core", "Body_Female_Arms", "Hair_Long")),
        ("hair_spiky", ("Body_Male_Core", "Body_Male_Arms", "Hair_Spiky")),
        ("hair_pony", ("Body_Female_Core", "Body_Female_Arms", "Hair_Ponytail")),
        ("hair_bald", ("Body_Male_Core", "Body_Male_Arms")),
    )
    for hname, cols in hairs:
        set_only_collections(cols)
        render_frame(out_dir, hname, 45.0, 1)

    # Render animations for male armored/base mix
    set_only_collections(("Body_Male_Core", "Body_Male_Arms", "Hair_Short"))
    # Anchor idle in south, se, side so jump/dodge stay properly floor-relative
    for dname, yaw in (("south", 0.0), ("se", 45.0), ("side", 90.0)):
        render_frame(out_dir, f"anim_ref_{dname}", yaw, 1)

    clips = (
        ("Hero_Idle", "idle", (("se", 45.0),), 4),
        ("Hero_Run", "run", (("se", 45.0),), 6),
        ("Hero_Jump", "jump", (("se", 45.0),), 2),
        ("Hero_Fall", "fall", (("se", 45.0),), 2),
        ("Hero_Dodge", "dodge", (("side", 90.0), ("se", 45.0), ("south", 0.0)), 6),
        ("Hero_Downed", "downed", (("se", 45.0),), 2),
    )
    for act_name, cname, dirs, count in clips:
        bind_action(arm_obj, act_name)
        for dname, yaw in dirs:
            for f in range(1, count + 1):
                render_frame(out_dir, f"anim_{cname}_{dname}_f{f}", yaw, f)

    print(f"Rendered preview frames to {out_dir}")


if __name__ == "__main__":
    main()
