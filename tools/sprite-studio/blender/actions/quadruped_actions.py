"""Reusable Rig_Quadruped animation library (Idle, Walk, Run, Attack, Corpse)."""

import math
import bpy
from mathutils import Euler, Vector

ALL_QUADRUPED_BONES = (
    "Pelvis", "Spine", "Neck", "Head", "Ear_L", "Ear_R", "Tail",
    "FrontUpper_L", "FrontLower_L", "FrontUpper_R", "FrontLower_R",
    "BackUpper_L", "BackLower_L", "BackUpper_R", "BackLower_R",
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
    """Zero out all quadruped pose bone transforms before keying a clip."""
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


def key_pose_bones(arm_obj, names, frame):
    """Insert location and rotation keyframes on listed pose bones."""
    pb = arm_obj.pose.bones
    for bone_name in names:
        if bone_name in pb:
            pb[bone_name].keyframe_insert(data_path="location", frame=frame)
            pb[bone_name].keyframe_insert(data_path="rotation_euler", frame=frame)


def build_idle_action(arm_obj, prefix, frames=6):
    """Build 6-frame breathing Idle clip with gentle sniff and tail flick."""
    action = prepare_clean_action(f"{prefix}_Idle", fps=6)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, frames + 1):
        phase = (2.0 * math.pi * (f - 1)) / float(frames)
        bob = -0.024 * (1.0 - math.cos(phase)) * 0.5
        sniff = math.sin(phase)

        set_world_loc(pb["Pelvis"], 0.0, 0.0, bob)
        set_world_rot(pb["Spine"], 2.5 * math.cos(phase), 0.0, 0.0)
        set_world_rot(pb["Neck"], -3.5 * math.cos(phase), 0.0, 2.0 * sniff)
        set_world_rot(pb["Head"], 5.0 * sniff, 0.0, 3.0 * math.cos(phase))
        set_world_rot(pb["Ear_L"], 0.0, 0.0, 7.0 * math.sin(phase - 0.7))
        set_world_rot(pb["Ear_R"], 0.0, 0.0, -7.0 * math.sin(phase - 0.7))
        set_world_rot(pb["Tail"], 8.0 * math.sin(phase), 0.0, 14.0 * math.cos(phase))

        for side in ("L", "R"):
            set_world_rot(pb[f"FrontUpper_{side}"], -4.0 * bob * 25.0, 0.0, 0.0)
            set_world_rot(pb[f"BackUpper_{side}"], 4.0 * bob * 25.0, 0.0, 0.0)
        key_pose_bones(arm_obj, ALL_QUADRUPED_BONES, f)
    return action


def build_walk_action(arm_obj, prefix, frames=6):
    """Build smooth 6-frame diagonal quadruped walk cycle."""
    action = prepare_clean_action(f"{prefix}_Walk", fps=9)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, frames + 1):
        phase = (2.0 * math.pi * (f - 0.5)) / float(frames)
        s = math.sin(phase)
        lift_a = max(0.0, math.cos(phase))
        lift_b = max(0.0, -math.cos(phase))
        bounce = abs(math.cos(phase)) * 0.032 - 0.012

        set_world_loc(pb["Pelvis"], 0.0, 0.0, bounce)
        set_world_rot(pb["Pelvis"], 0.0, 0.0, 4.0 * s)
        set_world_rot(pb["Spine"], 3.0, 0.0, -5.0 * s)
        set_world_rot(pb["Neck"], 2.0 * math.cos(phase), 0.0, 0.0)
        set_world_rot(pb["Head"], 4.0 * math.sin(phase * 2.0), 0.0, 3.0 * s)
        set_world_rot(pb["Ear_L"], 0.0, 0.0, 6.0 * math.cos(phase))
        set_world_rot(pb["Ear_R"], 0.0, 0.0, -6.0 * math.cos(phase))
        set_world_rot(pb["Tail"], 6.0, 0.0, 16.0 * s)

        # Diagonal gait: Front_L pairs with Back_R; Front_R pairs with Back_L
        set_world_rot(pb["FrontUpper_L"], -34.0 * s, 0.0, 0.0)
        set_world_rot(pb["FrontLower_L"], 34.0 * lift_a, 0.0, 0.0)
        set_world_rot(pb["BackUpper_R"], -32.0 * s, 0.0, 0.0)
        set_world_rot(pb["BackLower_R"], 30.0 * lift_a, 0.0, 0.0)

        set_world_rot(pb["FrontUpper_R"], 34.0 * s, 0.0, 0.0)
        set_world_rot(pb["FrontLower_R"], 34.0 * lift_b, 0.0, 0.0)
        set_world_rot(pb["BackUpper_L"], 32.0 * s, 0.0, 0.0)
        set_world_rot(pb["BackLower_L"], 30.0 * lift_b, 0.0, 0.0)
        key_pose_bones(arm_obj, ALL_QUADRUPED_BONES, f)
    return action


def build_run_action(arm_obj, prefix, frames=6):
    """Build dynamic 6-frame bounding quadruped gallop."""
    action = prepare_clean_action(f"{prefix}_Run", fps=13)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, frames + 1):
        phase = (2.0 * math.pi * (f - 0.5)) / float(frames)
        front_swing = math.sin(phase)
        back_swing = math.sin(phase - 1.15)
        bounce = max(-0.025, math.cos(phase) * 0.065)

        set_world_loc(pb["Pelvis"], 0.0, -0.02, bounce)
        set_world_rot(pb["Pelvis"], -8.0 * math.sin(phase), 0.0, 0.0)
        set_world_rot(pb["Spine"], 12.0 * math.sin(phase), 0.0, 0.0)
        set_world_rot(pb["Neck"], 8.0, 0.0, 0.0)
        set_world_rot(pb["Head"], -8.0 * math.sin(phase), 0.0, 0.0)
        set_world_rot(pb["Ear_L"], 0.0, 0.0, 14.0 + 6.0 * math.cos(phase))
        set_world_rot(pb["Ear_R"], 0.0, 0.0, -14.0 - 6.0 * math.cos(phase))
        set_world_rot(pb["Tail"], 20.0 + 12.0 * math.sin(phase), 0.0, 0.0)

        for sign, side in ((-1.0, "L"), (1.0, "R")):
            offset = sign * 10.0
            set_world_rot(pb[f"FrontUpper_{side}"], -48.0 * front_swing + offset * 0.4, 0.0, 0.0)
            set_world_rot(pb[f"FrontLower_{side}"], 42.0 * max(0.0, -front_swing), 0.0, 0.0)
            set_world_rot(pb[f"BackUpper_{side}"], -46.0 * back_swing - offset * 0.4, 0.0, 0.0)
            set_world_rot(pb[f"BackLower_{side}"], 44.0 * max(0.0, back_swing), 0.0, 0.0)
        key_pose_bones(arm_obj, ALL_QUADRUPED_BONES, f)
    return action


def build_attack_action(arm_obj, prefix):
    """Build 8-frame charge attack: F1-3 windup paw, F4-6 gallop loop, F7-8 braking outro."""
    action = prepare_clean_action(f"{prefix}_Attack", fps=11, loop_start=3, loop_end=6)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    # (py, pz, pel_rx, sp_rx, neck_rx, head_rx, fl_u, fl_l, fr_u, fr_l, bl_u, br_u)
    poses = (
        # F1-F3: pawing earth telegraph (front right scrapes, head & tusks drop low)
        (0.02, -0.025, 4.0, 8.0, 12.0, 14.0, -12.0, 10.0, 14.0, 34.0, 10.0, 12.0),
        (0.04, -0.040, 6.0, 12.0, 16.0, 20.0, -14.0, 12.0, -44.0, 64.0, 16.0, 18.0),
        (0.05, -0.048, 8.0, 14.0, 18.0, 24.0, -18.0, 18.0, -24.0, 40.0, 26.0, 28.0),
        # F4-F6: sustained ramming charge gallop sub-loop (loopStart=3..loopEnd=6)
        (-0.04, 0.035, -10.0, 12.0, 18.0, 18.0, -52.0, 12.0, -44.0, 14.0, 48.0, 42.0),
        (-0.02, 0.055, 6.0, -6.0, 16.0, 16.0, 28.0, 52.0, 22.0, 48.0, -34.0, -28.0),
        (-0.05, 0.015, -4.0, 8.0, 18.0, 20.0, -34.0, 24.0, -42.0, 18.0, 44.0, 50.0),
        # F7-F8: braking skid & step-back recovery outro (played on exit from charge)
        (-0.04, -0.025, -6.0, -10.0, 2.0, 4.0, -44.0, 6.0, -34.0, 6.0, -24.0, -18.0),
        (0.00, -0.010, -2.0, -4.0, 0.0, 0.0, -10.0, 4.0, 8.0, 8.0, -6.0, 8.0),
    )

    for f, p in enumerate(poses, start=1):
        py, pz, pel_rx, sp_rx, nk_rx, hd_rx, fl_u, fl_l, fr_u, fr_l, bl_u, br_u = p
        set_world_loc(pb["Pelvis"], 0.0, py, pz)
        set_world_rot(pb["Pelvis"], pel_rx, 0.0, 0.0)
        set_world_rot(pb["Spine"], sp_rx, 0.0, 0.0)
        set_world_rot(pb["Neck"], nk_rx, 0.0, 0.0)
        set_world_rot(pb["Head"], hd_rx, 0.0, 0.0)
        set_world_rot(pb["Ear_L"], 0.0, 0.0, 14.0)
        set_world_rot(pb["Ear_R"], 0.0, 0.0, -14.0)
        set_world_rot(pb["Tail"], 24.0 if f <= 6 else 6.0, 0.0, 0.0)

        set_world_rot(pb["FrontUpper_L"], fl_u, 0.0, 0.0)
        set_world_rot(pb["FrontLower_L"], fl_l, 0.0, 0.0)
        set_world_rot(pb["FrontUpper_R"], fr_u, 0.0, 0.0)
        set_world_rot(pb["FrontLower_R"], fr_l, 0.0, 0.0)
        set_world_rot(pb["BackUpper_L"], bl_u, 0.0, 0.0)
        set_world_rot(pb["BackLower_L"], 18.0 if bl_u < 0 else 6.0, 0.0, 0.0)
        set_world_rot(pb["BackUpper_R"], br_u, 0.0, 0.0)
        set_world_rot(pb["BackLower_R"], 18.0 if br_u < 0 else 6.0, 0.0, 0.0)
        key_pose_bones(arm_obj, ALL_QUADRUPED_BONES, f)
    return action


def build_corpse_action(arm_obj, prefix):
    """Build 1-frame KO pose rolled cleanly onto its side."""
    action = prepare_clean_action(f"{prefix}_Corpse", fps=1)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    set_world_loc(pb["Pelvis"], 0.0, 0.0, -0.16)
    set_world_rot(pb["Pelvis"], 0.0, 84.0, 18.0)
    set_world_rot(pb["Spine"], 6.0, 0.0, -6.0)
    set_world_rot(pb["Neck"], 8.0, 0.0, 8.0)
    set_world_rot(pb["Head"], 10.0, -8.0, 14.0)
    set_world_rot(pb["Ear_L"], 0.0, 0.0, 10.0)
    set_world_rot(pb["Ear_R"], 0.0, 0.0, -10.0)
    set_world_rot(pb["Tail"], -12.0, 0.0, 0.0)

    for side, s in (("L", -1.0), ("R", 1.0)):
        set_world_rot(pb[f"FrontUpper_{side}"], -14.0 * s, 14.0, 0.0)
        set_world_rot(pb[f"FrontLower_{side}"], 18.0, 0.0, 0.0)
        set_world_rot(pb[f"BackUpper_{side}"], 14.0 * s, 12.0, 0.0)
        set_world_rot(pb[f"BackLower_{side}"], 12.0, 0.0, 0.0)
    key_pose_bones(arm_obj, ALL_QUADRUPED_BONES, 1)
    return action


def apply_quadruped_actions(prefix="Boar", arm_name="Rig_Quadruped"):
    """Attach Idle, Walk, Run, Attack, and Corpse Actions onto Rig_Quadruped."""
    arm_obj = bpy.data.objects.get(arm_name)
    if not arm_obj or arm_obj.type != "ARMATURE":
        raise ValueError(f"Missing quadruped armature: {arm_name}")

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
