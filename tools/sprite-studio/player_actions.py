"""Reusable Rig_Hero 6-clip animation library (Idle, Run, Jump, Fall, Dodge dive-roll, Downed)."""

import math
import bpy
from mathutils import Euler, Matrix, Vector

ALL_HERO_BONES = (
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
    """Zero out all Rig_Hero pose bone transforms cleanly."""
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
    """Insert location and rotation keyframes across all Rig_Hero bones."""
    pb = arm_obj.pose.bones
    for bone_name in ALL_HERO_BONES:
        if bone_name in pb:
            pb[bone_name].keyframe_insert(data_path="location", frame=frame)
            pb[bone_name].keyframe_insert(data_path="rotation_euler", frame=frame)


def build_idle_action(arm_obj, prefix="Hero"):
    """Build 4-frame heroic breathing Idle with alert ready posture."""
    action = prepare_clean_action(f"{prefix}_Idle", fps=6)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, 5):
        phase = (2.0 * math.pi * (f - 1)) / 4.0
        heave = 0.5 * (1.0 - math.cos(phase))
        sway = math.sin(phase)

        set_world_loc(pb["Pelvis"], 0.0, 0.0, -0.018 * heave)
        set_world_rot(pb["Torso"], 3.0 * heave, 0.0, 2.2 * sway)
        set_world_rot(pb["Head"], -2.5 * heave, 0.0, 1.5 * sway)

        for sign, side in ((1.0, "L"), (-1.0, "R")):
            set_world_rot(pb[f"UpperArm_{side}"], -6.0 - 3.0 * heave, -sign * 7.0, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], -16.0 - 4.0 * heave, 0.0, 0.0)
            set_world_rot(pb[f"Thigh_{side}"], -4.0 * heave, -sign * 3.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 8.0 * heave, 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], -4.0 * heave, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_walk_action(arm_obj, prefix="Hero"):
    """Build 6-frame calm upright hero walk with shorter strides and gentle swing."""
    action = prepare_clean_action(f"{prefix}_Walk", fps=7)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, 7):
        phase = (2.0 * math.pi * (f - 0.5)) / 6.0
        s = math.sin(phase)
        c = math.cos(phase)
        bounce = abs(c) * 0.018 - 0.008

        set_world_loc(pb["Pelvis"], 0.0, 0.0, bounce)
        set_world_rot(pb["Pelvis"], 2.0, 1.5 * s, -3.0 * s)
        set_world_rot(pb["Torso"], 2.5 + 1.0 * abs(s), -1.5 * s, 4.5 * s)
        set_world_rot(pb["Head"], -2.0, 0.0, -2.5 * s)

        for sign, side, ls in ((1.0, "L", s), (-1.0, "R", -s)):
            set_world_rot(pb[f"UpperArm_{side}"], 14.0 * ls - 4.0, -sign * 7.0, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], -14.0 - 5.0 * max(0.0, -ls), 0.0, 0.0)
            lift = max(0.0, -c if side == "L" else c)
            set_world_rot(pb[f"Thigh_{side}"], -20.0 * ls - 4.0 * lift, -sign * 3.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 24.0 * lift + 6.0 * max(0.0, -ls), 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], -8.0 * ls, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_run_action(arm_obj, prefix="Hero"):
    """Build 6-frame athletic hero sprint with forward lean, counter-twist, and knee drive."""
    action = prepare_clean_action(f"{prefix}_Run", fps=11)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, 7):
        phase = (2.0 * math.pi * (f - 0.5)) / 6.0
        s = math.sin(phase)
        c = math.cos(phase)
        bounce = abs(c) * 0.055 - 0.025

        set_world_loc(pb["Pelvis"], 0.0, -0.02, bounce)
        set_world_rot(pb["Pelvis"], 6.0, 3.5 * s, -6.5 * s)
        set_world_rot(pb["Torso"], 12.0 + 3.0 * abs(s), -3.5 * s, 11.0 * s)
        set_world_rot(pb["Head"], -10.0, 0.0, -6.0 * s)

        for sign, side, ls in ((1.0, "L", s), (-1.0, "R", -s)):
            set_world_rot(pb[f"UpperArm_{side}"], 34.0 * ls - 10.0, -sign * 8.0, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], -48.0 - 18.0 * max(0.0, -ls), 0.0, 0.0)
            lift = max(0.0, -c if side == "L" else c)
            set_world_rot(pb[f"Thigh_{side}"], -42.0 * ls - 10.0 * lift, -sign * 3.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 54.0 * lift + 18.0 * max(0.0, -ls), 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], -14.0 * ls, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_jump_action(arm_obj, prefix="Hero"):
    """Build 2-frame upward leap: F1 spring launch -> F2 tucked airborne ascent."""
    action = prepare_clean_action(f"{prefix}_Jump", fps=8)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    # Frame 1: coil launch pushing off toes
    set_world_loc(pb["Pelvis"], 0.0, -0.02, 0.08)
    set_world_rot(pb["Torso"], 8.0, 0.0, 6.0)
    set_world_rot(pb["Head"], -6.0, 0.0, -4.0)
    set_world_rot(pb["UpperArm_L"], -38.0, -14.0, 0.0)
    set_world_rot(pb["Forearm_L"], -34.0, 0.0, 0.0)
    set_world_rot(pb["UpperArm_R"], 24.0, 14.0, 0.0)
    set_world_rot(pb["Forearm_R"], -38.0, 0.0, 0.0)
    set_world_rot(pb["Thigh_L"], -34.0, -4.0, 0.0)
    set_world_rot(pb["Shin_L"], 48.0, 0.0, 0.0)
    set_world_rot(pb["Thigh_R"], 18.0, 4.0, 0.0)
    set_world_rot(pb["Shin_R"], 22.0, 0.0, 0.0)
    set_world_rot(pb["Foot_R"], 24.0, 0.0, 0.0)
    key_pose_bones(arm_obj, 1)

    # Frame 2: airborne apex tuck
    set_world_loc(pb["Pelvis"], 0.0, -0.02, 0.28)
    set_world_rot(pb["Torso"], 12.0, 0.0, 8.0)
    set_world_rot(pb["Head"], -10.0, 0.0, -5.0)
    set_world_rot(pb["UpperArm_L"], -58.0, -22.0, 0.0)
    set_world_rot(pb["Forearm_L"], -42.0, 0.0, 0.0)
    set_world_rot(pb["UpperArm_R"], 30.0, 22.0, 0.0)
    set_world_rot(pb["Forearm_R"], -48.0, 0.0, 0.0)
    set_world_rot(pb["Thigh_L"], -64.0, -5.0, 0.0)
    set_world_rot(pb["Shin_L"], 84.0, 0.0, 0.0)
    set_world_rot(pb["Thigh_R"], 24.0, 5.0, 0.0)
    set_world_rot(pb["Shin_R"], 52.0, 0.0, 0.0)
    set_world_rot(pb["Foot_L"], 20.0, 0.0, 0.0)
    set_world_rot(pb["Foot_R"], 28.0, 0.0, 0.0)
    key_pose_bones(arm_obj, 2)
    return action


def build_fall_action(arm_obj, prefix="Hero"):
    """Build 2-frame descending landing brace with reaching boots and raised arms."""
    action = prepare_clean_action(f"{prefix}_Fall", fps=8)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f, sway in ((1, 0.0), (2, 1.0)):
        set_world_loc(pb["Pelvis"], 0.0, 0.0, 0.11 - 0.05 * sway)
        set_world_rot(pb["Torso"], 8.0 + 4.0 * sway, 0.0, -3.0 + 4.0 * sway)
        set_world_rot(pb["Head"], 5.0, 0.0, 0.0)
        for sign, side, phase in ((1.0, "L", 1.0), (-1.0, "R", -1.0)):
            set_world_rot(pb[f"UpperArm_{side}"], -18.0 - 10.0 * sway * phase, -sign * 34.0, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], -34.0, 0.0, 0.0)
            set_world_rot(pb[f"Thigh_{side}"], -26.0 - 8.0 * sway, -sign * 6.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 38.0 + 10.0 * sway, 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], 14.0, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_dodge_action(arm_obj, prefix="Hero"):
    """Build 6-frame forward dive-roll somersault along -Y (positive world X pitch = forward)."""
    action = prepare_clean_action(f"{prefix}_Dodge", fps=16)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    # (py, pz, pel_rx, tor_rx, head_rx, thigh_rx, shin_rx, arm_rx, forearm_rx)
    # Positive pel_rx turns head (+Z) forward toward -Y -> inverted ball -> rolling upright.
    roll_poses = (
        (-0.14, -0.04, 48.0, 24.0, -22.0, -24.0, 36.0, -82.0, -30.0),
        (-0.10, -0.12, 118.0, 28.0, 26.0, -78.0, 106.0, -68.0, -88.0),
        (-0.02, -0.10, 194.0, 26.0, 28.0, -88.0, 116.0, -62.0, -96.0),
        (0.06, -0.12, 268.0, 24.0, 24.0, -80.0, 104.0, -56.0, -82.0),
        (0.02, -0.10, 330.0, 20.0, 10.0, -54.0, 74.0, -34.0, -56.0),
        (-0.04, -0.04, 372.0, 14.0, -10.0, -24.0, 36.0, -18.0, -42.0),
    )

    for f, row in enumerate(roll_poses, start=1):
        py, pz, pel_rx, tor_rx, head_rx, th_rx, sh_rx, arm_rx, fa_rx = row
        set_world_loc(pb["Pelvis"], 0.0, py, pz)
        set_world_rot(pb["Pelvis"], pel_rx, 0.0, 0.0)
        set_world_rot(pb["Torso"], tor_rx, 0.0, 0.0)
        set_world_rot(pb["Head"], head_rx, 0.0, 0.0)
        for sign, side in ((1.0, "L"), (-1.0, "R")):
            set_world_rot(pb[f"UpperArm_{side}"], arm_rx, -sign * 14.0, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], fa_rx, 0.0, 0.0)
            set_world_rot(pb[f"Thigh_{side}"], th_rx, -sign * 6.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], sh_rx, 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], 12.0, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_downed_action(arm_obj, prefix="Hero"):
    """Build 2-frame collapsed downed hero pose resting sideways/flat on the ground."""
    action = prepare_clean_action(f"{prefix}_Downed", fps=4)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f, breath in ((1, 0.0), (2, 1.0)):
        set_world_loc(pb["Pelvis"], 0.0, 0.0, -0.50)
        set_world_rot(pb["Pelvis"], 18.0, 82.0, -16.0)
        set_world_rot(pb["Torso"], 6.0 + 3.0 * breath, 6.0, 8.0)
        set_world_rot(pb["Head"], 10.0, 12.0 - 4.0 * breath, 18.0)
        set_world_rot(pb["UpperArm_L"], -32.0, -34.0, 0.0)
        set_world_rot(pb["Forearm_L"], -36.0, 0.0, 0.0)
        set_world_rot(pb["UpperArm_R"], -20.0, 38.0, 0.0)
        set_world_rot(pb["Forearm_R"], -24.0, 0.0, 0.0)
        set_world_rot(pb["Thigh_L"], -28.0, -12.0, 0.0)
        set_world_rot(pb["Shin_L"], 38.0, 0.0, 0.0)
        set_world_rot(pb["Thigh_R"], -14.0, 10.0, 0.0)
        set_world_rot(pb["Shin_R"], 20.0, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_swim_action(arm_obj, prefix="Hero"):
    """Build 4-frame breaststroke swimming cycle keeping head buoyed above waterline."""
    action = prepare_clean_action(f"{prefix}_Swim", fps=6)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, 5):
        phase = (2.0 * math.pi * (f - 1)) / 4.0
        stroke = math.sin(phase)
        scoop = math.cos(phase)
        bob = 0.025 * scoop
        set_world_loc(pb["Pelvis"], 0.0, 0.0, -0.14 + bob)
        set_world_rot(pb["Pelvis"], 16.0, 0.0, 2.5 * stroke)
        set_world_rot(pb["Torso"], 14.0 + 3.0 * scoop, 0.0, -2.5 * stroke)
        set_world_rot(pb["Head"], -26.0 - 2.0 * scoop, 0.0, 0.0)

        sweep = 0.5 * (1.0 - scoop)
        for sign, side in ((1.0, "L"), (-1.0, "R")):
            set_world_rot(pb[f"UpperArm_{side}"], -62.0 + 26.0 * sweep, -sign * (18.0 + 36.0 * sweep), sign * 12.0)
            set_world_rot(pb[f"Forearm_{side}"], -42.0 + 18.0 * stroke, -sign * (16.0 * sweep), 0.0)
            kick = stroke if side == "L" else -stroke
            set_world_rot(pb[f"Thigh_{side}"], 14.0 + 14.0 * kick, -sign * 4.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 18.0 + 14.0 * max(0.0, -kick), 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], 26.0, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def aim_bone_dir(pb, target_dir):
    """Rotate a pose bone cleanly so its +Y shaft aligns with armature-space target_dir."""
    bpy.context.view_layer.update()
    rest_p = pb.parent.bone.matrix_local.to_3x3() if pb.parent else Matrix.Identity(3)
    pose_p = pb.parent.matrix.to_3x3() if pb.parent else Matrix.Identity(3)
    zero_mat = pose_p @ (rest_p.inverted() @ pb.bone.matrix_local.to_3x3())
    zero_y = zero_mat.col[1].normalized()
    q_delta = zero_y.rotation_difference(target_dir.normalized())
    desired_mat = q_delta.to_matrix() @ zero_mat
    pb.rotation_euler = (zero_mat.inverted() @ desired_mat).to_euler("XYZ")


def solve_arm_ik(upper_pb, fore_pb, hand_target, pole_dir):
    """Solve 2-bone 3D arm IK so wrist/socket reaches toward hand_target with elbow bent toward pole_dir."""
    bpy.context.view_layer.update()
    sh = upper_pb.head.copy()
    l1 = upper_pb.bone.length
    l2 = fore_pb.bone.length + 0.045
    to_tgt = Vector(hand_target) - sh
    dist = max(0.05, min(l1 + l2 - 0.004, to_tgt.length))
    fwd = to_tgt.normalized() if to_tgt.length > 1e-4 else Vector((0.0, -1.0, 0.0))
    bend = (Vector(pole_dir) - fwd * Vector(pole_dir).dot(fwd))
    bend_dir = bend.normalized() if bend.length > 1e-4 else Vector((1.0, 0.0, 0.0))
    cos_a = max(-1.0, min(1.0, (l1 * l1 + dist * dist - l2 * l2) / (2.0 * l1 * dist)))
    sin_a = math.sqrt(max(0.0, 1.0 - cos_a * cos_a))
    elbow = sh + fwd * (l1 * cos_a) + bend_dir * (l1 * sin_a)
    aim_bone_dir(upper_pb, elbow - sh)
    bpy.context.view_layer.update()
    aim_bone_dir(fore_pb, Vector(hand_target) - fore_pb.head)


def build_bow_action(arm_obj, prefix="Hero"):
    """Build 3-frame Hero_Bow archery stance (ready vertical hold, half draw, full draw)."""
    action = prepare_clean_action(f"{prefix}_Bow", fps=8)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    # Frame specs: (pel_z, pel_rz, tor_rx, tor_rz, head_rz, left_hand_tgt, right_hand_tgt, right_pole)
    frames = (
        (-0.015, -8.0, 2.0, -10.0, 16.0, (0.09, -0.39, 0.96), (-0.18, -0.14, 0.78), (-0.45, 0.25, -0.35)),
        (-0.022, -10.0, 3.0, -13.0, 21.0, (0.04, -0.45, 1.04), (-0.06, -0.22, 1.03), (-0.95, 0.30, 0.05)),
        (-0.028, -12.0, 4.0, -16.0, 26.0, (0.02, -0.46, 1.07), (-0.11, -0.10, 1.06), (-0.95, 0.35, 0.06)),
    )
    for f, (pz, pel_rz, tor_rx, tor_rz, head_rz, lh_tgt, rh_tgt, r_pole) in enumerate(frames, start=1):
        reset_pose_bones(arm_obj)
        set_world_loc(pb["Pelvis"], 0.0, 0.0, pz)
        set_world_rot(pb["Pelvis"], 0.0, 0.0, pel_rz)
        set_world_rot(pb["Torso"], tor_rx, 0.0, tor_rz)
        set_world_rot(pb["Head"], -2.0, 0.0, head_rz)
        set_world_rot(pb["Thigh_L"], -14.0, -4.0, 0.0)
        set_world_rot(pb["Shin_L"], 18.0, 0.0, 0.0)
        set_world_rot(pb["Foot_L"], -4.0, 0.0, 0.0)
        set_world_rot(pb["Thigh_R"], 12.0, 4.0, 0.0)
        set_world_rot(pb["Shin_R"], 14.0, 0.0, 0.0)
        set_world_rot(pb["Foot_R"], -6.0, 0.0, 0.0)
        solve_arm_ik(pb["UpperArm_L"], pb["Forearm_L"], lh_tgt, (0.6, 0.2, -0.75))
        solve_arm_ik(pb["UpperArm_R"], pb["Forearm_R"], rh_tgt, r_pole)
        key_pose_bones(arm_obj, f)
    return action


def build_crouch_idle_action(arm_obj, prefix="Hero"):
    """Build 4-frame low stealth crouch breathing idle keeping knees bent and head alert."""
    action = prepare_clean_action(f"{prefix}_CrouchIdle", fps=5)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, 5):
        phase = (2.0 * math.pi * (f - 1)) / 4.0
        heave = 0.5 * (1.0 - math.cos(phase))
        set_world_loc(pb["Pelvis"], 0.0, 0.03, -0.22 - 0.015 * heave)
        set_world_rot(pb["Pelvis"], 10.0, 0.0, 0.0)
        set_world_rot(pb["Torso"], 24.0 + 2.5 * heave, 0.0, 0.0)
        set_world_rot(pb["Head"], -20.0 - 2.0 * heave, 0.0, 0.0)
        for sign, side in ((1.0, "L"), (-1.0, "R")):
            set_world_rot(pb[f"UpperArm_{side}"], -22.0 - 2.0 * heave, -sign * 9.0, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], -52.0, 0.0, 0.0)
            set_world_rot(pb[f"Thigh_{side}"], -48.0 - 2.0 * heave, -sign * 5.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 78.0 + 3.0 * heave, 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], -30.0, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_crouch_walk_action(arm_obj, prefix="Hero"):
    """Build 6-frame hunched stealth prowl stride with damped bob and tucked arms."""
    action = prepare_clean_action(f"{prefix}_CrouchWalk", fps=7)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, 7):
        phase = (2.0 * math.pi * (f - 0.5)) / 6.0
        s = math.sin(phase)
        c = math.cos(phase)
        bounce = -0.22 + abs(c) * 0.016 - 0.008
        set_world_loc(pb["Pelvis"], 0.0, 0.03, bounce)
        set_world_rot(pb["Pelvis"], 12.0, 1.5 * s, -3.5 * s)
        set_world_rot(pb["Torso"], 26.0, -1.5 * s, 4.5 * s)
        set_world_rot(pb["Head"], -22.0, 0.0, -2.5 * s)
        for sign, side, ls in ((1.0, "L", s), (-1.0, "R", -s)):
            set_world_rot(pb[f"UpperArm_{side}"], 12.0 * ls - 24.0, -sign * 9.0, 0.0)
            set_world_rot(pb[f"Forearm_{side}"], -50.0, 0.0, 0.0)
            lift = max(0.0, -c if side == "L" else c)
            set_world_rot(pb[f"Thigh_{side}"], -46.0 - 16.0 * ls - 5.0 * lift, -sign * 5.0, 0.0)
            set_world_rot(pb[f"Shin_{side}"], 74.0 + 18.0 * lift + 4.0 * max(0.0, -ls), 0.0, 0.0)
            set_world_rot(pb[f"Foot_{side}"], -24.0 - 6.0 * ls, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_attack_action(arm_obj, prefix="Hero"):
    """Build 3-frame melee commitment poses: F1 windup pullback, F2 strike follow-through, F3 overhead raise."""
    action = prepare_clean_action(f"{prefix}_Attack", fps=10)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    # Frame 1: shoulder-pull windup coiled right
    set_world_loc(pb["Pelvis"], 0.0, 0.02, -0.02)
    set_world_rot(pb["Pelvis"], 4.0, 0.0, -14.0)
    set_world_rot(pb["Torso"], 6.0, 0.0, -28.0)
    set_world_rot(pb["Head"], -4.0, 0.0, 24.0)
    set_world_rot(pb["UpperArm_R"], -42.0, 22.0, -26.0)
    set_world_rot(pb["Forearm_R"], -58.0, 0.0, 0.0)
    set_world_rot(pb["UpperArm_L"], -22.0, -16.0, 12.0)
    set_world_rot(pb["Forearm_L"], -46.0, 0.0, 0.0)
    set_world_rot(pb["Thigh_L"], -16.0, -4.0, 0.0)
    set_world_rot(pb["Shin_L"], 20.0, 0.0, 0.0)
    set_world_rot(pb["Thigh_R"], 14.0, 4.0, 0.0)
    set_world_rot(pb["Shin_R"], 12.0, 0.0, 0.0)
    key_pose_bones(arm_obj, 1)

    # Frame 2: extended strike follow-through twisted forward/left
    reset_pose_bones(arm_obj)
    set_world_loc(pb["Pelvis"], 0.0, -0.05, -0.03)
    set_world_rot(pb["Pelvis"], 8.0, 0.0, 18.0)
    set_world_rot(pb["Torso"], 16.0, 0.0, 34.0)
    set_world_rot(pb["Head"], -12.0, 0.0, -26.0)
    set_world_rot(pb["UpperArm_R"], -66.0, -18.0, 28.0)
    set_world_rot(pb["Forearm_R"], -22.0, 0.0, 0.0)
    set_world_rot(pb["UpperArm_L"], 22.0, -14.0, -10.0)
    set_world_rot(pb["Forearm_L"], -40.0, 0.0, 0.0)
    set_world_rot(pb["Thigh_L"], -24.0, -4.0, 0.0)
    set_world_rot(pb["Shin_L"], 28.0, 0.0, 0.0)
    set_world_rot(pb["Thigh_R"], 18.0, 4.0, 0.0)
    set_world_rot(pb["Shin_R"], 16.0, 0.0, 0.0)
    key_pose_bones(arm_obj, 2)

    # Frame 3: high overhead slam / heavy raise apex
    reset_pose_bones(arm_obj)
    set_world_loc(pb["Pelvis"], 0.0, 0.02, -0.01)
    set_world_rot(pb["Pelvis"], 0.0, 0.0, -6.0)
    set_world_rot(pb["Torso"], -10.0, 0.0, -10.0)
    set_world_rot(pb["Head"], 8.0, 0.0, 8.0)
    set_world_rot(pb["UpperArm_R"], -128.0, 12.0, 8.0)
    set_world_rot(pb["Forearm_R"], -36.0, 0.0, 0.0)
    set_world_rot(pb["UpperArm_L"], -112.0, -12.0, -8.0)
    set_world_rot(pb["Forearm_L"], -42.0, 0.0, 0.0)
    set_world_rot(pb["Thigh_L"], -12.0, -4.0, 0.0)
    set_world_rot(pb["Shin_L"], 16.0, 0.0, 0.0)
    set_world_rot(pb["Thigh_R"], 10.0, 4.0, 0.0)
    set_world_rot(pb["Shin_R"], 12.0, 0.0, 0.0)
    key_pose_bones(arm_obj, 3)
    return action


def apply_player_actions(prefix="Hero", arm_name="Rig_Hero"):
    """Attach all Hero Actions including Crouch and Attack onto Rig_Hero."""
    arm_obj = bpy.data.objects.get(arm_name)
    if not arm_obj or arm_obj.type != "ARMATURE":
        raise ValueError(f"Missing hero armature: {arm_name}")

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.objects.active = arm_obj

    idle = build_idle_action(arm_obj, prefix)
    walk = build_walk_action(arm_obj, prefix)
    run = build_run_action(arm_obj, prefix)
    jump = build_jump_action(arm_obj, prefix)
    fall = build_fall_action(arm_obj, prefix)
    dodge = build_dodge_action(arm_obj, prefix)
    downed = build_downed_action(arm_obj, prefix)
    swim = build_swim_action(arm_obj, prefix)
    bow = build_bow_action(arm_obj, prefix)
    crouch_idle = build_crouch_idle_action(arm_obj, prefix)
    crouch_walk = build_crouch_walk_action(arm_obj, prefix)
    attack = build_attack_action(arm_obj, prefix)

    reset_pose_bones(arm_obj)
    bind_action_for_edit(arm_obj, idle)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 6
    bpy.context.scene.frame_set(1)
    return [a.name for a in (idle, walk, run, jump, fall, dodge, downed, swim, bow, crouch_idle, crouch_walk, attack)]
