"""Reusable Rig_Slime squash-and-stretch animation library (Idle, Walk, Run, Attack, Corpse)."""

import math
import bpy
from mathutils import Euler, Vector

ALL_SLIME_BONES = ("Base", "Body", "Crest")


def bind_action_for_edit(arm_obj, action):
    """Assign an Action and its primary slot safely across Blender 4.x and 5.x."""
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    arm_obj.animation_data.action = action
    if hasattr(arm_obj.animation_data, "action_slot"):
        slots = getattr(action, "slots", None)
        arm_obj.animation_data.action_slot = slots[0] if slots and len(slots) > 0 else None


def reset_pose_bones(arm_obj):
    """Zero out location, rotation, and scale on all Slime pose bones."""
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "XYZ"
        pb.location = Vector((0.0, 0.0, 0.0))
        pb.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
        pb.scale = Vector((1.0, 1.0, 1.0))


def set_world_rot(pb, rx_deg, ry_deg, rz_deg):
    """Apply world-space XYZ Euler rotation relative to a bone's rest orientation."""
    rest = pb.bone.matrix_local.to_3x3()
    world_m = Euler((math.radians(rx_deg), math.radians(ry_deg), math.radians(rz_deg)), "XYZ").to_matrix()
    pb.rotation_euler = (rest.inverted() @ world_m @ rest).to_euler("XYZ")


def set_world_loc(pb, wx, wy, wz):
    """Apply world-space translation relative to a bone's rest orientation."""
    rest = pb.bone.matrix_local.to_3x3()
    pb.location = rest.inverted() @ Vector((wx, wy, wz))


def prepare_clean_action(name, fps, loop_start=None, loop_end=None):
    """Create a fake-user Action carrying optional custom playback metadata."""
    existing = bpy.data.actions.get(name)
    if existing:
        bpy.data.actions.remove(existing)
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    action["fps"] = int(fps)
    if loop_start is not None:
        action["loopStart"] = int(loop_start)
    if loop_end is not None:
        action["loopEnd"] = int(loop_end)
    return action


def key_slime_bones(arm_obj, frame):
    """Insert location, rotation, and scale keyframes across all Slime bones."""
    pb = arm_obj.pose.bones
    for bone_name in ALL_SLIME_BONES:
        if bone_name in pb:
            pb[bone_name].keyframe_insert(data_path="location", frame=frame)
            pb[bone_name].keyframe_insert(data_path="rotation_euler", frame=frame)
            pb[bone_name].keyframe_insert(data_path="scale", frame=frame)


def build_idle_action(arm_obj, prefix, frames=6):
    """Build 6-frame breathing gelatin squash-and-stretch Idle."""
    action = prepare_clean_action(f"{prefix}_Idle", fps=6)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, frames + 1):
        phase = (2.0 * math.pi * (f - 1)) / float(frames)
        sy = 1.0 + 0.11 * math.sin(phase)
        sxz = 1.0 / math.sqrt(sy)
        # Body bone points +Z (local +Y = world +Z)
        pb["Body"].scale = Vector((sxz, sy, sxz))
        set_world_rot(pb["Crest"], 8.0 * math.cos(phase), 0.0, 10.0 * math.sin(phase))
        set_world_loc(pb["Crest"], 0.0, 0.0, 0.03 * math.sin(phase))
        pb["Base"].scale = Vector((1.0 + 0.04 * (sxz - 1.0), 1.0, 1.0 + 0.04 * (sxz - 1.0)))
        key_slime_bones(arm_obj, f)
    return action


def build_hop_action(arm_obj, name, fps, params):
    """Build 6-frame bouncy ooze hop cycle (Walk or Run)."""
    action = prepare_clean_action(name, fps=fps)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, 7):
        # f=1 squashed contact -> f=3 peak air stretch -> f=5-6 landing squash
        t = (f - 1) / 5.0
        air = max(0.0, math.sin(math.pi * max(0.0, (t - 0.12) / 0.72)))
        squash = math.cos(t * 2.0 * math.pi)
        lift = air * params["hop_z"]
        sy = 1.0 + (0.24 * air - 0.16 * max(0.0, squash)) * params["stretch"]
        sxz = 1.0 / math.sqrt(max(0.55, sy))

        set_world_loc(pb["Base"], 0.0, -params["stride_y"] * math.sin(t * 2.0 * math.pi), 0.0)
        set_world_loc(pb["Body"], 0.0, 0.0, lift)
        pb["Body"].scale = Vector((sxz, sy, sxz))
        set_world_rot(pb["Body"], params["lean_deg"] * (air - 0.25), 0.0, 0.0)
        set_world_rot(pb["Crest"], -params["lean_deg"] * 1.4 * air + 8.0 * squash, 0.0, 0.0)
        key_slime_bones(arm_obj, f)
    return action


def build_attack_action(arm_obj, prefix):
    """Build 6-frame coil-squash (F1-3) -> explosive body-slam lunge (F4-5) -> settle (F6)."""
    action = prepare_clean_action(f"{prefix}_Attack", fps=11, loop_start=3, loop_end=5)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    # (by, bz, sy, pitch_deg)
    poses = (
        (0.04, -0.02, 0.86, -8.0),
        (0.08, -0.03, 0.74, -14.0),
        (0.10, -0.04, 0.68, -18.0),
        (-0.22, 0.14, 1.24, 28.0),
        (-0.14, 0.04, 1.04, 14.0),
        (-0.02, 0.00, 0.90, 4.0),
    )

    for f, (by, bz, sy, pitch) in enumerate(poses, start=1):
        sxz = 1.0 / math.sqrt(sy)
        set_world_loc(pb["Body"], 0.0, by, bz)
        set_world_rot(pb["Body"], pitch, 0.0, 0.0)
        pb["Body"].scale = Vector((sxz, sy, sxz))
        set_world_rot(pb["Crest"], -pitch * 0.7, 0.0, 0.0)
        key_slime_bones(arm_obj, f)
    return action


def build_corpse_action(arm_obj, prefix):
    """Build 1-frame melted emerald puddle pose at z=0.0."""
    action = prepare_clean_action(f"{prefix}_Corpse", fps=1)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    set_world_loc(pb["Body"], 0.0, 0.0, -0.06)
    pb["Body"].scale = Vector((1.35, 0.24, 1.32))
    set_world_rot(pb["Crest"], 0.0, 0.0, 24.0)
    pb["Crest"].scale = Vector((1.25, 0.35, 1.25))
    key_slime_bones(arm_obj, 1)
    return action


def apply_slime_actions(prefix="Slime", arm_name="Rig_Slime"):
    """Attach Idle, Walk, Run, Attack, and Corpse Actions onto Rig_Slime."""
    arm_obj = bpy.data.objects.get(arm_name)
    if not arm_obj or arm_obj.type != "ARMATURE":
        raise ValueError(f"Missing slime armature: {arm_name}")

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.objects.active = arm_obj

    idle = build_idle_action(arm_obj, prefix)
    walk = build_hop_action(arm_obj, f"{prefix}_Walk", fps=9, params={"hop_z": 0.14, "stride_y": 0.06, "stretch": 0.9, "lean_deg": 12.0})
    run = build_hop_action(arm_obj, f"{prefix}_Run", fps=13, params={"hop_z": 0.26, "stride_y": 0.10, "stretch": 1.25, "lean_deg": 20.0})
    attack = build_attack_action(arm_obj, prefix)
    corpse = build_corpse_action(arm_obj, prefix)

    reset_pose_bones(arm_obj)
    bind_action_for_edit(arm_obj, idle)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 6
    bpy.context.scene.frame_set(1)
    return [a.name for a in (idle, walk, run, attack, corpse)]
