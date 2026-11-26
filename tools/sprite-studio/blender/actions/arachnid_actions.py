"""Reusable Rig_Arachnid 8-leg animation library (Idle, Walk, Run, Attack, Corpse)."""

import math
import bpy
from mathutils import Euler, Vector


def get_all_spider_bones():
    """Return ordered bone names across Body, Abdomen, face appendages, and 8 legs."""
    names = ["Body", "Abdomen", "Pedipalp_L", "Pedipalp_R", "Fang_L", "Fang_R"]
    for idx in (1, 2, 3, 4):
        for side in ("L", "R"):
            names.extend((f"Leg{idx}_Femur_{side}", f"Leg{idx}_Tibia_{side}", f"Leg{idx}_Tarsus_{side}"))
    return tuple(names)


ALL_SPIDER_BONES = get_all_spider_bones()


def bind_action_for_edit(arm_obj, action):
    """Assign an Action and its primary slot safely across Blender 4.x and 5.x."""
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    arm_obj.animation_data.action = action
    if hasattr(arm_obj.animation_data, "action_slot"):
        slots = getattr(action, "slots", None)
        arm_obj.animation_data.action_slot = slots[0] if slots and len(slots) > 0 else None


def reset_pose_bones(arm_obj):
    """Zero out all pose bone transforms cleanly."""
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
    """Insert location and rotation keyframes across all 30 spider rig bones."""
    pb = arm_obj.pose.bones
    for bone_name in ALL_SPIDER_BONES:
        if bone_name in pb:
            pb[bone_name].keyframe_insert(data_path="location", frame=frame)
            pb[bone_name].keyframe_insert(data_path="rotation_euler", frame=frame)


def apply_leg_step(pb, leg_idx, side, sweep_deg, lift_norm):
    """Pose one 3-segment spider leg cleanly above floor during stepping."""
    sign = -1.0 if side == "L" else 1.0
    lift_deg = 22.0 * lift_norm
    set_world_rot(pb[f"Leg{leg_idx}_Femur_{side}"], 0.0, -sign * lift_deg, -sign * sweep_deg)
    set_world_rot(pb[f"Leg{leg_idx}_Tibia_{side}"], 0.0, sign * (lift_deg * 0.45), 0.0)
    set_world_rot(pb[f"Leg{leg_idx}_Tarsus_{side}"], 0.0, sign * (lift_deg * 0.35), 0.0)


def build_idle_action(arm_obj, prefix, frames=6):
    """Build 6-frame crouched predatory breathing Idle with palp/fang twitch."""
    action = prepare_clean_action(f"{prefix}_Idle", fps=6)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, frames + 1):
        phase = (2.0 * math.pi * (f - 1)) / float(frames)
        bob = -0.022 * 0.5 * (1.0 - math.cos(phase))
        twitch = math.sin(phase)

        set_world_loc(pb["Body"], 0.0, 0.0, bob)
        set_world_rot(pb["Body"], -3.0 * math.cos(phase), 0.0, 0.0)
        set_world_rot(pb["Abdomen"], 5.0 * math.cos(phase), 0.0, 3.0 * twitch)
        for sign, side in ((-1.0, "L"), (1.0, "R")):
            set_world_rot(pb[f"Pedipalp_{side}"], 8.0 * twitch, 0.0, sign * 7.0 * math.cos(phase))
            set_world_rot(pb[f"Fang_{side}"], -6.0 * twitch, 0.0, sign * (6.0 + 5.0 * math.sin(phase)))
            for idx in (1, 2, 3, 4):
                # Counter-rotate femurs slightly so tarsus tips remain planted as body bobs
                set_world_rot(pb[f"Leg{idx}_Femur_{side}"], 0.0, -sign * (bob * -180.0), 0.0)
                set_world_rot(pb[f"Leg{idx}_Tibia_{side}"], 0.0, sign * (bob * -140.0), 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_tetrapod_gait_action(arm_obj, name, fps, params):
    """Build 6-frame alternating-tetrapod 8-leg locomotion cycle."""
    action = prepare_clean_action(name, fps=fps)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    for f in range(1, 7):
        phase = (2.0 * math.pi * (f - 0.5)) / 6.0
        s = math.sin(phase)
        c = math.cos(phase)
        bounce = abs(c) * params["bounce"] - params["bounce"] * 0.45

        set_world_loc(pb["Body"], 0.0, 0.0, bounce)
        set_world_rot(pb["Body"], params["pitch"] * s, params["roll"] * s, params["yaw"] * c)
        set_world_rot(pb["Abdomen"], -params["pitch"] * s * 1.1, 0.0, -params["yaw"] * 1.4 * s)
        for sign, side in ((-1.0, "L"), (1.0, "R")):
            set_world_rot(pb[f"Pedipalp_{side}"], 10.0 * s, 0.0, sign * 8.0 * c)
            set_world_rot(pb[f"Fang_{side}"], 0.0, 0.0, sign * (6.0 + 4.0 * s))

        # Alternating tetrapods: Group A = (1L, 2R, 3L, 4R); Group B = (1R, 2L, 3R, 4L)
        for idx in (1, 2, 3, 4):
            for side in ("L", "R"):
                is_group_a = (idx % 2 == 1 and side == "L") or (idx % 2 == 0 and side == "R")
                p_val = s if is_group_a else -s
                l_val = max(0.0, c if is_group_a else -c)
                apply_leg_step(pb, idx, side, params["sweep"] * p_val, params["lift"] * l_val)
        key_pose_bones(arm_obj, f)
    return action


def build_attack_action(arm_obj, prefix):
    """Build 6-frame wide threat rear-up (F1-3) and fang-snapping lunge (F4-6)."""
    action = prepare_clean_action(f"{prefix}_Attack", fps=12, loop_start=3, loop_end=5)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    # (py, pz, body_rx, ab_rx, leg1_lift, leg2_lift, spread_deg, fang_spread)
    poses = (
        (0.02, 0.02, -8.0, 6.0, 18.0, 10.0, 10.0, 10.0),
        (0.04, 0.05, -16.0, 12.0, 32.0, 18.0, 16.0, 18.0),
        (0.05, 0.07, -22.0, 16.0, 42.0, 24.0, 20.0, 24.0),
        (-0.12, -0.02, 10.0, -8.0, -8.0, -4.0, -14.0, 28.0),
        (-0.08, -0.01, 5.0, -4.0, 6.0, 4.0, -6.0, 14.0),
        (-0.02, 0.00, 0.0, 0.0, 0.0, 0.0, 0.0, 6.0),
    )

    for f, p in enumerate(poses, start=1):
        py, pz, body_rx, ab_rx, l1, l2, spr, f_sp = p
        set_world_loc(pb["Body"], 0.0, py, pz)
        set_world_rot(pb["Body"], body_rx, 0.0, 0.0)
        set_world_rot(pb["Abdomen"], ab_rx, 0.0, 0.0)

        for sign, side in ((-1.0, "L"), (1.0, "R")):
            set_world_rot(pb[f"Pedipalp_{side}"], -abs(body_rx) * 0.5, 0.0, sign * f_sp * 0.9)
            set_world_rot(pb[f"Fang_{side}"], -14.0 if f <= 3 else 14.0, 0.0, sign * f_sp)
            # Front 2 pairs flare outward and upward framing the bared fangs & ruby eyes
            set_world_rot(pb[f"Leg1_Femur_{side}"], 0.0, -sign * l1, sign * spr)
            set_world_rot(pb[f"Leg1_Tibia_{side}"], 0.0, -sign * (l1 * 0.25), 0.0)
            set_world_rot(pb[f"Leg2_Femur_{side}"], 0.0, -sign * l2, sign * (spr * 0.6))
            for back_i in (3, 4):
                set_world_rot(pb[f"Leg{back_i}_Femur_{side}"], -body_rx * 0.45, 0.0, 0.0)
        key_pose_bones(arm_obj, f)
    return action


def build_corpse_action(arm_obj, prefix):
    """Build 1-frame inverted curled death pose."""
    action = prepare_clean_action(f"{prefix}_Corpse", fps=1)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    set_world_loc(pb["Body"], 0.0, 0.0, 0.02)
    set_world_rot(pb["Body"], 8.0, 174.0, 16.0)
    set_world_rot(pb["Abdomen"], 10.0, 0.0, 0.0)

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        set_world_rot(pb[f"Pedipalp_{side}"], 22.0, 0.0, -sign * 14.0)
        set_world_rot(pb[f"Fang_{side}"], 14.0, 0.0, -sign * 8.0)
        for idx in (1, 2, 3, 4):
            set_world_rot(pb[f"Leg{idx}_Femur_{side}"], 0.0, sign * 26.0, 0.0)
            set_world_rot(pb[f"Leg{idx}_Tibia_{side}"], 0.0, sign * 38.0, 0.0)
            set_world_rot(pb[f"Leg{idx}_Tarsus_{side}"], 0.0, sign * 44.0, 0.0)
    key_pose_bones(arm_obj, 1)
    return action


def apply_arachnid_actions(prefix="Spider", arm_name="Rig_Arachnid"):
    """Attach Idle, Walk, Run, Attack, and Corpse Actions onto Rig_Arachnid."""
    arm_obj = bpy.data.objects.get(arm_name)
    if not arm_obj or arm_obj.type != "ARMATURE":
        raise ValueError(f"Missing arachnid armature: {arm_name}")

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.objects.active = arm_obj

    idle = build_idle_action(arm_obj, prefix)
    walk = build_tetrapod_gait_action(
        arm_obj, f"{prefix}_Walk", fps=10,
        params={"sweep": 20.0, "lift": 0.9, "bounce": 0.028, "pitch": 2.5, "roll": 3.0, "yaw": 4.0},
    )
    run = build_tetrapod_gait_action(
        arm_obj, f"{prefix}_Run", fps=14,
        params={"sweep": 30.0, "lift": 1.25, "bounce": 0.045, "pitch": 5.0, "roll": 5.5, "yaw": 6.0},
    )
    attack = build_attack_action(arm_obj, prefix)
    corpse = build_corpse_action(arm_obj, prefix)

    reset_pose_bones(arm_obj)
    bind_action_for_edit(arm_obj, idle)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 6
    bpy.context.scene.frame_set(1)
    return [a.name for a in (idle, walk, run, attack, corpse)]
