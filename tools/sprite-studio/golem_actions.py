"""Reusable Rig_GolemTitan animation library (Idle, Walk, Run, Attack, Corpse)."""

import math
import bpy
from mathutils import Euler, Vector

ALL_GOLEM_BONES = (
    "Pelvis", "Torso", "Neck", "Head",
    "UpperArm_L", "Forearm_L", "Fist_L",
    "UpperArm_R", "Forearm_R", "Fist_R",
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
    """Zero out all pose bone transforms before keying a clip."""
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
    """Create a fake-user Action with playback custom metadata."""
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
    """Insert location and rotation keyframes across all Golem rig bones."""
    pb = arm_obj.pose.bones
    for bone_name in ALL_GOLEM_BONES:
        if bone_name in pb:
            pb[bone_name].keyframe_insert(data_path="location", frame=frame)
            pb[bone_name].keyframe_insert(data_path="rotation_euler", frame=frame)


def build_idle_action(arm_obj, prefix, frames=6):
    """Build 6-frame monumental breathing Idle with heavy arm settle."""
    action = prepare_clean_action(f"{prefix}_Idle", fps=5)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, frames + 1):
        phase = (2.0 * math.pi * (f - 1)) / float(frames)
        heave = 0.5 * (1.0 - math.cos(phase))
        sway = math.sin(phase)

        set_world_loc(pb["Pelvis"], 0.0, 0.0, -0.045 * heave)
        set_world_rot(pb["Torso"], 4.5 * heave, 0.0, 2.5 * sway)
        set_world_rot(pb["Neck"], -3.5 * heave, 0.0, -2.0 * sway)
        set_world_rot(pb["Head"], 2.0 * math.cos(phase), 0.0, 5.0 * sway)

        for sign, side in ((-1.0, "L"), (1.0, "R")):
            set_world_rot(pb[f"UpperArm_{side}"], 5.0 * heave, sign * (7.0 + 4.0 * heave), 0.0)
            set_world_rot(pb[f"Forearm_{side}"], -16.0 - 5.0 * heave, 0.0, -sign * 4.0)
            set_world_rot(pb[f"Fist_{side}"], -6.0 * sway, 0.0, -sign * 6.0)
            set_world_rot(pb[f"Thigh_{side}"], -5.0 * heave, sign * 4.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 10.0 * heave, 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], -5.0 * heave, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_walk_action(arm_obj, prefix, frames=6):
    """Build 6-frame heavy lumbering stone stride."""
    action = prepare_clean_action(f"{prefix}_Walk", fps=7)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, frames + 1):
        phase = (2.0 * math.pi * (f - 0.5)) / float(frames)
        s = math.sin(phase)
        c = math.cos(phase)
        bounce = abs(c) * 0.055 - 0.03

        set_world_loc(pb["Pelvis"], 0.0, 0.0, bounce)
        set_world_rot(pb["Pelvis"], 0.0, -4.5 * s, 5.5 * s)
        set_world_rot(pb["Torso"], 5.0, 4.0 * s, -7.5 * s)
        set_world_rot(pb["Head"], -2.0, 0.0, 4.0 * s)

        for sign, side, leg_s in ((-1.0, "L", s), (1.0, "R", -s)):
            lift = max(0.0, -sign * c)
            set_world_rot(pb[f"Thigh_{side}"], 26.0 * leg_s - 6.0 * lift, sign * 4.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 28.0 * lift + max(0.0, -14.0 * leg_s), 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], -12.0 * leg_s, 0.0, 0.0)
            set_world_rot(pb[f"UpperArm_{side}"], -22.0 * leg_s, sign * 10.0, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], -20.0 - 10.0 * max(0.0, -leg_s), 0.0, -sign * 4.0)
            set_world_rot(pb[f"Fist_{side}"], -8.0, 0.0, -sign * 6.0)
        key_pose_bones(arm_obj, f)
    return action


def build_run_action(arm_obj, prefix, frames=6):
    """Build 6-frame charging juggernaut stomp."""
    action = prepare_clean_action(f"{prefix}_Run", fps=10)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, frames + 1):
        phase = (2.0 * math.pi * (f - 0.5)) / float(frames)
        s = math.sin(phase)
        c = math.cos(phase)
        bounce = abs(c) * 0.08 - 0.045

        set_world_loc(pb["Pelvis"], 0.0, -0.04, bounce)
        set_world_rot(pb["Pelvis"], 6.0, -5.0 * s, 7.0 * s)
        set_world_rot(pb["Torso"], 14.0, 5.0 * s, -10.0 * s)
        set_world_rot(pb["Head"], -8.0, 0.0, 6.0 * s)

        for sign, side, leg_s in ((-1.0, "L", s), (1.0, "R", -s)):
            lift = max(0.0, -sign * c)
            set_world_rot(pb[f"Thigh_{side}"], 34.0 * leg_s - 8.0 * lift, sign * 5.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 36.0 * lift + max(0.0, -18.0 * leg_s), 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], -16.0 * leg_s, 0.0, 0.0)
            set_world_rot(pb[f"UpperArm_{side}"], -38.0 * leg_s, sign * 12.0, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], -34.0, 0.0, -sign * 6.0)
            set_world_rot(pb[f"Fist_{side}"], -12.0, 0.0, -sign * 8.0)
        key_pose_bones(arm_obj, f)
    return action


def build_attack_action(arm_obj, prefix):
    """Build 6-frame double-fisted overhead boulder slam (F1-3 windup, F4-6 smash + outro)."""
    action = prepare_clean_action(f"{prefix}_Attack", fps=9, loop_start=3, loop_end=5)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    # (pz, pel_rx, torso_rx, head_rx, arm_rx, arm_ry_spread, forearm_rx, forearm_rz_in, leg_rx)
    poses = (
        (-0.04, 4.0, -5.0, 4.0, -52.0, 12.0, -32.0, 8.0, 10.0),
        (-0.02, -3.0, -10.0, 8.0, -104.0, 14.0, -36.0, 16.0, 8.0),
        (-0.04, -5.0, -14.0, 10.0, -124.0, 8.0, -48.0, 24.0, 6.0),
        (-0.12, 8.0, 22.0, -14.0, -46.0, 8.0, -34.0, 16.0, 26.0),
        (-0.09, 7.0, 18.0, -10.0, -38.0, 9.0, -30.0, 14.0, 20.0),
        (-0.04, 4.0, 8.0, -4.0, -18.0, 10.0, -24.0, 8.0, 10.0),
    )

    for f, p in enumerate(poses, start=1):
        pz, pel_rx, tor_rx, hd_rx, arm_rx, spread, fore_rx, fore_in, leg_rx = p
        set_world_loc(pb["Pelvis"], 0.0, -0.03 if f >= 4 else 0.04, pz)
        set_world_rot(pb["Pelvis"], pel_rx, 0.0, 0.0)
        set_world_rot(pb["Torso"], tor_rx, 0.0, 0.0)
        set_world_rot(pb["Head"], hd_rx, 0.0, 0.0)

        for sign, side in ((-1.0, "L"), (1.0, "R")):
            set_world_rot(pb[f"UpperArm_{side}"], arm_rx, sign * spread, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], fore_rx, 0.0, sign * fore_in)
            set_world_rot(pb[f"Fist_{side}"], -8.0, 0.0, sign * 8.0)
            set_world_rot(pb[f"Thigh_{side}"], -leg_rx, sign * 6.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], leg_rx * 1.4, 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], -leg_rx * 0.4, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_corpse_action(arm_obj, prefix):
    """Build 1-frame collapsed ruined stone heap pose."""
    action = prepare_clean_action(f"{prefix}_Corpse", fps=1)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    set_world_loc(pb["Pelvis"], 0.0, 0.0, -0.44)
    set_world_rot(pb["Pelvis"], 76.0, 10.0, 16.0)
    set_world_rot(pb["Torso"], 12.0, -8.0, -6.0)
    set_world_rot(pb["Head"], 18.0, 12.0, -24.0)

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        set_world_rot(pb[f"UpperArm_{side}"], -28.0, sign * 42.0, 0.0)
        set_world_rot(pb[f"Forearm_{side}"], -24.0, 0.0, -sign * 14.0)
        set_world_rot(pb[f"Thigh_{side}"], -34.0, sign * 24.0, 0.0)
        set_world_rot(pb[f"Shin_{side}"], 22.0, 0.0, 0.0)
    key_pose_bones(arm_obj, 1)
    return action


def apply_golem_actions(prefix="Golem", arm_name="Rig_GolemTitan"):
    """Attach Idle, Walk, Run, Attack, and Corpse Actions onto Rig_GolemTitan."""
    arm_obj = bpy.data.objects.get(arm_name)
    if not arm_obj or arm_obj.type != "ARMATURE":
        raise ValueError(f"Missing golem armature: {arm_name}")

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.objects.active = arm_obj

    idle = build_idle_action(arm_obj, prefix)
    walk = build_walk_action(arm_obj, prefix)
    run = build_run_action(arm_obj, prefix)
    attack = build_attack_action(arm_obj, prefix)
    corpse = build_corpse_action(arm_obj, prefix)

    reset_pose_bones(arm_obj)
    bind_action_for_edit(arm_obj, idle)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 6
    bpy.context.scene.frame_set(1)
    return [a.name for a in (idle, walk, run, attack, corpse)]
