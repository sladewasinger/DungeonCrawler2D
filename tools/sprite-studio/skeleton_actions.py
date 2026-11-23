"""Reusable Rig_SkeletonHumanoid creepy bare skeleton animation library (5 clips)."""

import math
import bpy
from mathutils import Euler, Vector

ALL_SKELETON_BONES = (
    "Pelvis", "Spine", "Neck", "Head", "Jaw",
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
    """Zero out all skeleton pose bones cleanly."""
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
    """Insert location and rotation keyframes across all skeleton rig bones."""
    pb = arm_obj.pose.bones
    for bone_name in ALL_SKELETON_BONES:
        if bone_name in pb:
            pb[bone_name].keyframe_insert(data_path="location", frame=frame)
            pb[bone_name].keyframe_insert(data_path="rotation_euler", frame=frame)


def build_idle_action(arm_obj, prefix="Skeleton", frames=6):
    """Build 6-frame creepy hunched undead sway with subtle jaw chatter."""
    action = prepare_clean_action(f"{prefix}_Idle", fps=6)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, frames + 1):
        phase = (2.0 * math.pi * (f - 1)) / float(frames)
        sway = math.sin(phase)
        chatter = max(0.0, math.sin(phase * 2.0))
        bob = -0.025 * (1.0 - math.cos(phase)) * 0.5

        set_world_loc(pb["Pelvis"], 0.0, 0.0, bob)
        set_world_rot(pb["Pelvis"], 0.0, 3.0 * sway, 0.0)
        set_world_rot(pb["Spine"], 5.0 + 3.0 * math.cos(phase), -4.0 * sway, 5.0 * sway)
        set_world_rot(pb["Head"], -14.0 - 5.0 * math.cos(phase), 8.0 * sway, -6.0 * sway)
        set_world_rot(pb["Jaw"], 16.0 * chatter + 4.0, 0.0, 0.0)

        for sign, side in ((-1.0, "L"), (1.0, "R")):
            set_world_rot(pb[f"UpperArm_{side}"], -12.0 + 4.0 * sway * sign, sign * 10.0, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], -28.0 - 6.0 * math.cos(phase), 0.0, -sign * 8.0)
            set_world_rot(pb[f"Hand_{side}"], 14.0, 0.0, 0.0)
            set_world_rot(pb[f"Thigh_{side}"], -6.0 * math.sin(phase * 0.5), sign * 4.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 10.0 * abs(bob) * 20.0, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_gait_action(arm_obj, name, fps, params):
    """Build 6-frame clattering skeleton walk or frantic hunched sprint."""
    action = prepare_clean_action(name, fps=fps)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, 7):
        phase = (2.0 * math.pi * (f - 0.5)) / 6.0
        s = math.sin(phase)
        c = math.cos(phase)
        bounce = abs(c) * params["bounce"] - params["bounce"] * 0.45

        set_world_loc(pb["Pelvis"], 0.0, 0.0, bounce)
        set_world_rot(pb["Pelvis"], params["pel_rx"], 5.0 * s, 6.0 * s)
        set_world_rot(pb["Spine"], params["hunch"] + 4.0 * abs(s), -6.0 * s, -9.0 * s)
        set_world_rot(pb["Head"], -params["hunch"] * 0.85 - 10.0, 6.0 * s, 5.0 * s)
        set_world_rot(pb["Jaw"], 12.0 * abs(c) + 4.0, 0.0, 0.0)

        for sign, side, ls in ((-1.0, "L", s), (1.0, "R", -s)):
            lift = max(0.0, -sign * c)
            set_world_rot(pb[f"Thigh_{side}"], params["stride"] * ls - 8.0 * lift, sign * 4.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], params["knee"] * lift + max(0.0, -14.0 * ls), 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], -12.0 * ls, 0.0, 0.0)
            set_world_rot(pb[f"UpperArm_{side}"], -params["arm_swing"] * ls - params["arm_fwd"], sign * 12.0, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], -params["elbow"], 0.0, -sign * 8.0)
            set_world_rot(pb[f"Hand_{side}"], 10.0, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_attack_action(arm_obj, prefix="Skeleton"):
    """Build 6-frame bare-handed double-claw raking lunge."""
    action = prepare_clean_action(f"{prefix}_Attack", fps=11, loop_start=3, loop_end=5)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    # (py, pz, spine_rx, head_rx, jaw_rx, u_arm_rx, spread, fore_rx)
    poses = (
        (0.02, -0.02, -4.0, -14.0, 14.0, -48.0, 20.0, -44.0),
        (0.05, 0.00, -10.0, -18.0, 26.0, -104.0, 24.0, -32.0),
        (0.07, 0.01, -12.0, -20.0, 34.0, -124.0, 26.0, -26.0),
        (-0.14, -0.04, 18.0, -24.0, 26.0, -86.0, -28.0, -52.0),
        (-0.09, -0.03, 12.0, -18.0, 14.0, -64.0, -18.0, -44.0),
        (-0.02, -0.01, 6.0, -12.0, 6.0, -30.0, 4.0, -34.0),
    )

    for f, p in enumerate(poses, start=1):
        py, pz, sp_rx, hd_rx, j_rx, ua_rx, spr, fa_rx = p
        set_world_loc(pb["Pelvis"], 0.0, py, pz)
        set_world_rot(pb["Spine"], sp_rx, 0.0, 0.0)
        set_world_rot(pb["Head"], hd_rx, 0.0, 0.0)
        set_world_rot(pb["Jaw"], j_rx, 0.0, 0.0)
        for sign, side in ((-1.0, "L"), (1.0, "R")):
            set_world_rot(pb[f"UpperArm_{side}"], ua_rx, sign * spr, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], fa_rx, 0.0, sign * 12.0)
            set_world_rot(pb[f"Hand_{side}"], 22.0, 0.0, 0.0)
            set_world_rot(pb[f"Thigh_{side}"], -14.0 if f >= 4 else -6.0, sign * 6.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 20.0 if f >= 4 else 10.0, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_corpse_action(arm_obj, prefix="Skeleton"):
    """Build 1-frame collapsed splayed pile of bare bones."""
    action = prepare_clean_action(f"{prefix}_Corpse", fps=1)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    set_world_loc(pb["Pelvis"], 0.0, 0.14, -0.60)
    set_world_rot(pb["Pelvis"], -84.0, 8.0, -42.0)
    set_world_rot(pb["Spine"], 10.0, -10.0, 18.0)
    set_world_rot(pb["Head"], 18.0, -18.0, 32.0)
    set_world_rot(pb["Jaw"], 28.0, 0.0, -8.0)

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        set_world_rot(pb[f"UpperArm_{side}"], -78.0, sign * 58.0, -sign * 14.0)
        set_world_rot(pb[f"Forearm_{side}"], -22.0, 0.0, sign * 24.0)
        set_world_rot(pb[f"Thigh_{side}"], 14.0, sign * 26.0, 0.0)
        set_world_rot(pb[f"Shin_{side}"], 22.0, 0.0, sign * 12.0)
    key_pose_bones(arm_obj, 1)
    return action


def apply_skeleton_actions(prefix="Skeleton", arm_name="Rig_SkeletonHumanoid"):
    """Attach Idle, Walk, Run, Attack, and Corpse Actions onto Rig_SkeletonHumanoid."""
    arm_obj = bpy.data.objects.get(arm_name)
    if not arm_obj or arm_obj.type != "ARMATURE":
        raise ValueError(f"Missing skeleton armature: {arm_name}")

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.objects.active = arm_obj

    idle = build_idle_action(arm_obj, prefix)
    walk = build_gait_action(
        arm_obj, f"{prefix}_Walk", fps=8,
        params={"pel_rx": 2.0, "hunch": 12.0, "stride": 34.0, "knee": 36.0, "bounce": 0.045, "arm_swing": 28.0, "arm_fwd": 12.0, "elbow": 30.0},
    )
    run = build_gait_action(
        arm_obj, f"{prefix}_Run", fps=12,
        params={"pel_rx": 8.0, "hunch": 22.0, "stride": 46.0, "knee": 48.0, "bounce": 0.075, "arm_swing": 42.0, "arm_fwd": 26.0, "elbow": 40.0},
    )
    attack = build_attack_action(arm_obj, prefix)
    corpse = build_corpse_action(arm_obj, prefix)

    reset_pose_bones(arm_obj)
    bind_action_for_edit(arm_obj, idle)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 6
    bpy.context.scene.frame_set(1)
    return [a.name for a in (idle, walk, run, attack, corpse)]
