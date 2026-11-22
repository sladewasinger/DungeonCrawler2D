"""Reusable Rig_ChibiHumanoid animation library (Idle, Walk, Run, Attack, Corpse)."""

import math
import bpy
from mathutils import Euler, Vector

CORPSE_Z_DROP = -0.17


def bind_action_for_edit(arm_obj, action):
    """Assign an Action to an armature safely in both Blender 4.x and 5.x."""
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    arm_obj.animation_data.action = action
    if hasattr(arm_obj.animation_data, "action_slot"):
        slots = getattr(action, "slots", None)
        arm_obj.animation_data.action_slot = slots[0] if slots and len(slots) > 0 else None


def reset_pose_bones(arm_obj):
    """Zero out all bone pose transforms before keying a new clip."""
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


def prepare_clean_action(name):
    """Remove any existing action with the same name and create a fake-user Action."""
    existing = bpy.data.actions.get(name)
    if existing:
        bpy.data.actions.remove(existing)
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    return action


def key_pose_bones(arm_obj, names, frame):
    """Insert location & rotation keyframes on the listed pose bones."""
    pb = arm_obj.pose.bones
    for bone_name in names:
        if bone_name in pb:
            pb[bone_name].keyframe_insert(data_path="location", frame=frame)
            pb[bone_name].keyframe_insert(data_path="rotation_euler", frame=frame)


ALL_BONES = (
    "Pelvis", "Spine", "Head", "Ear_L", "Ear_R",
    "UpperArm_L", "Forearm_L", "UpperArm_R", "Forearm_R",
    "Thigh_L", "Shin_L", "Thigh_R", "Shin_R",
)


def build_walk_action(arm_obj, prefix, frames=6):
    """Build a crisp 6-frame cyclic walk gait on Rig_ChibiHumanoid."""
    action = prepare_clean_action(f"{prefix}_Walk")
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, frames + 1):
        phase = (2.0 * math.pi * (f - 0.5)) / float(frames)
        stride = math.sin(phase)
        lift_l = max(0.0, math.cos(phase))
        lift_r = max(0.0, -math.cos(phase))
        bounce = abs(math.cos(phase)) * 0.042 - 0.015

        set_world_loc(pb["Pelvis"], 0.0, 0.0, bounce)
        set_world_rot(pb["Pelvis"], 0.0, 0.0, 5.0 * stride)
        set_world_rot(pb["Spine"], 7.0 + abs(stride) * 2.0, 0.0, -8.0 * stride)
        set_world_rot(pb["Head"], -5.0, 0.0, 4.0 * stride)

        set_world_rot(pb["Ear_L"], 0.0, 0.0, 6.0 * math.sin(phase - 0.6))
        set_world_rot(pb["Ear_R"], 0.0, 0.0, -6.0 * math.sin(phase - 0.6))

        set_world_rot(pb["Thigh_L"], -36.0 * stride, 0.0, 0.0)
        set_world_rot(pb["Shin_L"], 36.0 * lift_l, 0.0, 0.0)
        set_world_rot(pb["Thigh_R"], 36.0 * stride, 0.0, 0.0)
        set_world_rot(pb["Shin_R"], 36.0 * lift_r, 0.0, 0.0)

        set_world_rot(pb["UpperArm_L"], 30.0 * stride, 0.0, 0.0)
        set_world_rot(pb["Forearm_L"], -28.0 - 10.0 * max(0.0, -stride), 0.0, 0.0)
        set_world_rot(pb["UpperArm_R"], -30.0 * stride, 0.0, 0.0)
        set_world_rot(pb["Forearm_R"], -28.0 - 10.0 * max(0.0, stride), 0.0, 0.0)

        key_pose_bones(arm_obj, ALL_BONES, f)
    return action


def build_run_action(arm_obj, prefix, frames=6):
    """Build an energetic leaned-forward 6-frame sprint cycle."""
    action = prepare_clean_action(f"{prefix}_Run")
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, frames + 1):
        phase = (2.0 * math.pi * (f - 0.5)) / float(frames)
        stride = math.sin(phase)
        lift_l = max(0.0, math.cos(phase))
        lift_r = max(0.0, -math.cos(phase))
        bounce = abs(math.cos(phase)) * 0.068 - 0.032

        set_world_loc(pb["Pelvis"], 0.0, -0.02, bounce)
        set_world_rot(pb["Pelvis"], 6.0, 0.0, 8.0 * stride)
        set_world_rot(pb["Spine"], 20.0 + abs(stride) * 4.0, 0.0, -13.0 * stride)
        set_world_rot(pb["Head"], -18.0, 0.0, 7.0 * stride)

        # Swept back & fluttering fast on sprint
        set_world_rot(pb["Ear_L"], 0.0, -8.0, 12.0 + 7.0 * math.sin(phase - 0.5))
        set_world_rot(pb["Ear_R"], 0.0, 8.0, -12.0 - 7.0 * math.sin(phase - 0.5))

        set_world_rot(pb["Thigh_L"], -54.0 * stride, 0.0, 0.0)
        set_world_rot(pb["Shin_L"], 58.0 * lift_l + 10.0 * max(0.0, stride), 0.0, 0.0)
        set_world_rot(pb["Thigh_R"], 54.0 * stride, 0.0, 0.0)
        set_world_rot(pb["Shin_R"], 58.0 * lift_r + 10.0 * max(0.0, -stride), 0.0, 0.0)

        set_world_rot(pb["UpperArm_L"], 56.0 * stride, -6.0, 0.0)
        set_world_rot(pb["Forearm_L"], -62.0, 0.0, 0.0)
        set_world_rot(pb["UpperArm_R"], -56.0 * stride, 6.0, 0.0)
        set_world_rot(pb["Forearm_R"], -62.0, 0.0, 0.0)

        key_pose_bones(arm_obj, ALL_BONES, f)
    return action


def build_attack_action(arm_obj, prefix):
    """Build 6-frame melee strike: F1-3 windup cocked high-back, F4-5 lunge punch/slash forward, F6 recoil."""
    action = prepare_clean_action(f"{prefix}_Attack")
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    # (pelvis_y, pelvis_z, spine_rx, spine_rz, head_rx, arm_r_rx, arm_r_ry, farm_r_rx, arm_l_rx, stance)
    poses = (
        (0.02, -0.020, -4.0, 14.0, 4.0, 62.0, -24.0, -38.0, -24.0, 12.0),
        (0.04, -0.038, -10.0, 26.0, 8.0, 118.0, -34.0, -48.0, -42.0, 18.0),
        (0.05, -0.046, -14.0, 32.0, 10.0, 146.0, -36.0, -52.0, -50.0, 22.0),
        (-0.080, -0.028, 24.0, -30.0, -18.0, -82.0, 12.0, -18.0, 26.0, 26.0),
        (-0.065, -0.022, 18.0, -22.0, -14.0, -56.0, 16.0, -14.0, 20.0, 22.0),
        (-0.015, -0.008, 6.0, -8.0, -4.0, -18.0, -4.0, -16.0, 6.0, 10.0),
    )

    for f, p in enumerate(poses, start=1):
        py, pz, s_rx, s_rz, h_rx, ar_rx, ar_ry, fr_rx, al_rx, stance = p
        set_world_loc(pb["Pelvis"], 0.0, py, pz)
        set_world_rot(pb["Pelvis"], 0.0, 0.0, s_rz * 0.35)
        set_world_rot(pb["Spine"], s_rx, 0.0, s_rz)
        set_world_rot(pb["Head"], h_rx, 0.0, -s_rz * 0.55)
        set_world_rot(pb["Ear_L"], 0.0, 0.0, 6.0 if f <= 3 else -8.0)
        set_world_rot(pb["Ear_R"], 0.0, 0.0, -6.0 if f <= 3 else 8.0)

        set_world_rot(pb["UpperArm_R"], ar_rx, ar_ry, 0.0)
        set_world_rot(pb["Forearm_R"], fr_rx, 0.0, 0.0)
        set_world_rot(pb["UpperArm_L"], al_rx, -14.0, 0.0)
        set_world_rot(pb["Forearm_L"], -32.0, 0.0, 0.0)

        set_world_rot(pb["Thigh_L"], -stance, 0.0, 0.0)
        set_world_rot(pb["Shin_L"], stance * 0.85, 0.0, 0.0)
        set_world_rot(pb["Thigh_R"], stance * 0.9, 0.0, 0.0)
        set_world_rot(pb["Shin_R"], stance * 0.65, 0.0, 0.0)
        key_pose_bones(arm_obj, ALL_BONES, f)
    return action


def build_corpse_action(arm_obj, prefix):
    """Build 1-frame KO corpse pose lying on its back diagonally for crisp readability."""
    action = prepare_clean_action(f"{prefix}_Corpse")
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    set_world_loc(pb["Pelvis"], 0.0, 0.04, -0.15)
    set_world_rot(pb["Pelvis"], -82.0, 0.0, 52.0)
    set_world_rot(pb["Spine"], -6.0, 0.0, -10.0)
    set_world_rot(pb["Head"], -8.0, 0.0, 18.0)
    set_world_rot(pb["Ear_L"], 0.0, 0.0, 10.0)
    set_world_rot(pb["Ear_R"], 0.0, 0.0, -10.0)
    set_world_rot(pb["UpperArm_L"], 18.0, -52.0, 0.0)
    set_world_rot(pb["Forearm_L"], -20.0, 0.0, 0.0)
    set_world_rot(pb["UpperArm_R"], 14.0, 54.0, 0.0)
    set_world_rot(pb["Forearm_R"], -16.0, 0.0, 0.0)
    set_world_rot(pb["Thigh_L"], -12.0, -14.0, 0.0)
    set_world_rot(pb["Thigh_R"], -8.0, 16.0, 0.0)
    key_pose_bones(arm_obj, ALL_BONES, 1)
    return action


def align_ears_to_bones(prefix="Goblin", arm_name="Rig_ChibiHumanoid"):
    """Reposition ear meshes cleanly along their Ear_L/Ear_R bones without modifying any other meshes."""
    arm_obj = bpy.data.objects.get(arm_name)
    if not arm_obj or arm_obj.type != "ARMATURE":
        return []
    reset_pose_bones(arm_obj)
    bpy.context.view_layer.update()

    aligned = []
    for side in ("L", "R"):
        ear = bpy.data.objects.get(f"{prefix}_Ear_{side}")
        bone = arm_obj.data.bones.get(f"Ear_{side}")
        if not ear or not bone:
            continue
        head_w = arm_obj.matrix_world @ bone.head_local
        tail_w = arm_obj.matrix_world @ bone.tail_local
        span = tail_w - head_w
        if span.length < 1e-4:
            continue
        center = head_w + span * 0.42
        rot_q = span.to_track_quat("Z", "Y")
        ear.parent = None
        ear.location = center
        ear.rotation_mode = "XYZ"
        ear.rotation_euler = rot_q.to_euler("XYZ")
        bpy.context.view_layer.update()
        world_m = ear.matrix_world.copy()
        ear.parent = arm_obj
        ear.parent_type = "BONE"
        ear.parent_bone = f"Ear_{side}"
        bpy.context.view_layer.update()
        ear.matrix_world = world_m
        aligned.append(ear.name)
    return aligned


def ensure_idle_fake_user(prefix):
    """Keep existing hand-saved Idle action safe with fake user."""
    idle = bpy.data.actions.get(f"{prefix}_Idle")
    if idle:
        idle.use_fake_user = True
    return idle


def apply_humanoid_actions(prefix="Goblin", arm_name="Rig_ChibiHumanoid"):
    """Attach Walk, Run, Attack, and Corpse Actions to Rig_ChibiHumanoid without altering meshes."""
    arm_obj = bpy.data.objects.get(arm_name)
    if not arm_obj or arm_obj.type != "ARMATURE":
        raise ValueError(f"Missing armature object: {arm_name}")

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.objects.active = arm_obj

    idle = ensure_idle_fake_user(prefix)
    walk = build_walk_action(arm_obj, prefix)
    run = build_run_action(arm_obj, prefix)
    attack = build_attack_action(arm_obj, prefix)
    corpse = build_corpse_action(arm_obj, prefix)

    reset_pose_bones(arm_obj)
    if idle:
        bind_action_for_edit(arm_obj, idle)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 6
    bpy.context.scene.frame_set(1)
    return [a.name for a in (idle, walk, run, attack, corpse) if a]
