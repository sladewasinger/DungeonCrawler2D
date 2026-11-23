"""Reusable Rig_OrcBrute battleaxe warrior animation library (Idle, Walk, Run, Attack, Corpse)."""

import math
import bpy
from mathutils import Euler, Vector

ALL_ORC_BONES = (
    "Pelvis", "Torso", "Neck", "Head",
    "UpperArm_L", "Forearm_L", "Hand_L",
    "UpperArm_R", "Forearm_R", "Hand_R",
    "Thigh_L", "Shin_L", "Foot_L",
    "Thigh_R", "Shin_R", "Foot_R",
)


def bind_action_for_edit(arm_obj, action):
    """Assign an Action and its primary slot safely across Blender 4.x and 5.x."""
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    arm_obj.animation_data.action = action
    if hasattr(arm_obj.animation_data, "action_slot"):
        slots = getattr(action, "slots", None)
        arm_obj.animation_data.action_slot = slots[0] if slots and len(slots) > 0 else None


def reset_pose_bones(arm_obj):
    """Zero out all Orc rig pose bone transforms cleanly."""
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


def key_pose_bones(arm_obj, frame):
    """Insert location and rotation keyframes across all Orc rig bones."""
    pb = arm_obj.pose.bones
    for bone_name in ALL_ORC_BONES:
        if bone_name in pb:
            pb[bone_name].keyframe_insert(data_path="location", frame=frame)
            pb[bone_name].keyframe_insert(data_path="rotation_euler", frame=frame)


def build_idle_action(arm_obj, prefix="Orc", frames=6):
    """Build 6-frame menacing hulking Idle hefting the battleaxe."""
    action = prepare_clean_action(f"{prefix}_Idle", fps=6)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, frames + 1):
        phase = (2.0 * math.pi * (f - 1)) / float(frames)
        heave = 0.5 * (1.0 - math.cos(phase))
        sway = math.sin(phase)

        set_world_loc(pb["Pelvis"], 0.0, 0.0, -0.03 * heave)
        set_world_rot(pb["Torso"], 4.0 * heave, 0.0, 3.0 * sway)
        set_world_rot(pb["Head"], -6.0 - 3.0 * heave, 0.0, 4.0 * sway)

        set_world_rot(pb["UpperArm_L"], -14.0 + 4.0 * heave, -12.0, 0.0)
        set_world_rot(pb["Forearm_L"], -28.0 - 5.0 * heave, 0.0, 10.0)
        set_world_rot(pb["UpperArm_R"], -24.0 + 6.0 * heave, 12.0, -10.0)
        set_world_rot(pb["Forearm_R"], -36.0 - 6.0 * heave, 0.0, -14.0)
        set_world_rot(pb["Hand_R"], -18.0, 0.0, 12.0)

        for sign, side in ((-1.0, "L"), (1.0, "R")):
            set_world_rot(pb[f"Thigh_{side}"], -6.0 * heave, sign * 5.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 12.0 * heave, 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], -6.0 * heave, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_gait_action(arm_obj, name, fps, params):
    """Build 6-frame heavy warrior march or forward war charge."""
    action = prepare_clean_action(name, fps=fps)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, 7):
        phase = (2.0 * math.pi * (f - 0.5)) / 6.0
        s = math.sin(phase)
        c = math.cos(phase)
        bounce = abs(c) * params["bounce"] - params["bounce"] * 0.45

        set_world_loc(pb["Pelvis"], 0.0, params["py"], bounce)
        set_world_rot(pb["Pelvis"], params["pel_rx"], -4.0 * s, 6.0 * s)
        set_world_rot(pb["Torso"], params["lean"] + 3.0 * abs(s), 4.0 * s, -9.0 * s)
        set_world_rot(pb["Head"], -params["lean"] * 0.55, 0.0, 4.0 * s)

        set_world_rot(pb["UpperArm_L"], 24.0 * s - 12.0, -10.0, 0.0)
        set_world_rot(pb["Forearm_L"], -30.0 - 12.0 * max(0.0, -s), 0.0, 8.0)
        set_world_rot(pb["UpperArm_R"], -16.0 * s - 22.0, 12.0, -8.0)
        set_world_rot(pb["Forearm_R"], -40.0, 0.0, -14.0)
        set_world_rot(pb["Hand_R"], -16.0, 0.0, 12.0)

        for sign, side, ls in ((-1.0, "L", s), (1.0, "R", -s)):
            lift = max(0.0, -sign * c)
            set_world_rot(pb[f"Thigh_{side}"], params["stride"] * ls - 6.0 * lift, sign * 5.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], params["knee"] * lift + max(0.0, -14.0 * ls), 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], -12.0 * ls, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_attack_action(arm_obj, prefix="Orc"):
    """Build 6-frame battleaxe cleave: F1-3 high windup -> F4-5 diagonal smash -> F6 recoil."""
    action = prepare_clean_action(f"{prefix}_Attack", fps=10, loop_start=3, loop_end=5)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    # (py, pz, tor_rx, tor_rz, ua_r_rx, ua_r_ry, fa_r_rx, hand_r_rx)
    poses = (
        (0.02, -0.02, -4.0, -14.0, -56.0, 22.0, -40.0, -8.0),
        (0.04, 0.00, -8.0, -24.0, -104.0, 30.0, -42.0, 14.0),
        (0.05, 0.02, -12.0, -30.0, -118.0, 34.0, -46.0, 22.0),
        (-0.08, -0.04, 18.0, 22.0, -64.0, -6.0, -24.0, 12.0),
        (-0.06, -0.03, 14.0, 26.0, -44.0, -6.0, -28.0, 8.0),
        (-0.02, -0.01, 6.0, 10.0, -24.0, 10.0, -34.0, -10.0),
    )

    for f, p in enumerate(poses, start=1):
        py, pz, t_rx, t_rz, ua_rx, ua_ry, fa_rx, h_rx = p
        set_world_loc(pb["Pelvis"], 0.0, py, pz)
        set_world_rot(pb["Torso"], t_rx, 0.0, t_rz)
        set_world_rot(pb["Head"], -t_rx * 0.45 - 6.0, 0.0, -t_rz * 0.4)
        set_world_rot(pb["UpperArm_R"], ua_rx, ua_ry, -12.0)
        set_world_rot(pb["Forearm_R"], fa_rx, 0.0, -12.0)
        hand_rz = -18.0 if f in (2, 3) else (32.0 if f in (4, 5) else 14.0)
        set_world_rot(pb["Hand_R"], h_rx, 0.0, hand_rz)
        set_world_rot(pb["UpperArm_L"], 18.0 if f <= 3 else -24.0, -16.0, 0.0)
        set_world_rot(pb["Forearm_L"], -32.0, 0.0, 12.0)
        for sign, side in ((-1.0, "L"), (1.0, "R")):
            set_world_rot(pb[f"Thigh_{side}"], -12.0 if f >= 4 else -6.0, sign * 6.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 18.0 if f >= 4 else 10.0, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_corpse_action(arm_obj, prefix="Orc"):
    """Build 1-frame collapsed Orc brute fallen on side/back with battleaxe."""
    action = prepare_clean_action(f"{prefix}_Corpse", fps=1)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    set_world_loc(pb["Pelvis"], 0.0, 0.10, -0.60)
    set_world_rot(pb["Pelvis"], -76.0, 26.0, -48.0)
    set_world_rot(pb["Torso"], 12.0, -8.0, 14.0)
    set_world_rot(pb["Head"], 16.0, -14.0, 24.0)
    set_world_rot(pb["UpperArm_L"], -24.0, -56.0, 14.0)
    set_world_rot(pb["Forearm_L"], -16.0, 0.0, 18.0)
    set_world_rot(pb["UpperArm_R"], -72.0, 48.0, -12.0)
    set_world_rot(pb["Forearm_R"], -24.0, 0.0, -20.0)
    set_world_rot(pb["Hand_R"], 10.0, 0.0, 18.0)
    for sign, side in ((-1.0, "L"), (1.0, "R")):
        set_world_rot(pb[f"Thigh_{side}"], 14.0, sign * 20.0, 0.0)
        set_world_rot(pb[f"Shin_{side}"], 22.0, 0.0, 0.0)
    key_pose_bones(arm_obj, 1)
    return action


def apply_orc_actions(prefix="Orc", arm_name="Rig_OrcBrute"):
    """Attach Idle, Walk, Run, Attack, and Corpse Actions onto Rig_OrcBrute."""
    arm_obj = bpy.data.objects.get(arm_name)
    if not arm_obj or arm_obj.type != "ARMATURE":
        raise ValueError(f"Missing orc armature: {arm_name}")

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.objects.active = arm_obj

    idle = build_idle_action(arm_obj, prefix)
    walk = build_gait_action(
        arm_obj, f"{prefix}_Walk", fps=8,
        params={"py": 0.0, "pel_rx": 2.0, "lean": 8.0, "stride": 30.0, "knee": 32.0, "bounce": 0.045},
    )
    run = build_gait_action(
        arm_obj, f"{prefix}_Run", fps=11,
        params={"py": -0.03, "pel_rx": 6.0, "lean": 18.0, "stride": 40.0, "knee": 42.0, "bounce": 0.072},
    )
    attack = build_attack_action(arm_obj, prefix)
    corpse = build_corpse_action(arm_obj, prefix)

    reset_pose_bones(arm_obj)
    bind_action_for_edit(arm_obj, idle)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 6
    bpy.context.scene.frame_set(1)
    return [a.name for a in (idle, walk, run, attack, corpse)]
