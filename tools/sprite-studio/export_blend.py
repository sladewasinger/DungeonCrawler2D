"""Headless Blender batch renderer exporting all canonical creature Actions across S/E/N."""

import json
import os
import sys
import bpy

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import studio_core  # noqa: E402

CANONICAL_CLIPS = (
    ("idle", {"fps": 7}),
    ("walk", {"fps": 9}),
    ("run", {"fps": 13}),
    ("attack", {"fps": 11, "loopStart": 3, "loopEnd": 5}),
    ("corpse", {"fps": 1}),
)


def parse_args(argv):
    """Parse CLI arguments passed after `--` to export_blend.py."""
    args = argv[argv.index("--") + 1 :] if "--" in argv else []
    opts = {}
    for i in range(0, len(args) - 1, 2):
        if args[i].startswith("--"):
            opts[args[i][2:]] = args[i + 1]
    if "out" not in opts:
        raise ValueError("Missing required --out directory argument")
    return {"out": opts["out"], "cell": int(opts.get("cell", "64"))}


def find_action_for_state(state_name):
    """Match an exact or suffix-named Action in bpy.data.actions (case-insensitive)."""
    suffix = f"_{state_name}"
    for action in bpy.data.actions:
        lower = action.name.lower()
        if lower == state_name or lower.endswith(suffix):
            return action
    return None


def bind_action(arm_obj, action):
    """Bind Action and its primary slot (Blender 5.1+) safely on the scene armature."""
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    arm_obj.animation_data.action = action
    if hasattr(arm_obj.animation_data, "action_slot"):
        slots = getattr(action, "slots", None)
        arm_obj.animation_data.action_slot = slots[0] if slots and len(slots) > 0 else None


def resolve_frame_list(action, state_name):
    """Extract sorted integer keyframes for the Action (1 frame for corpse)."""
    if state_name == "corpse":
        return [int(round(action.frame_range[0]))]
    f_start = int(round(action.frame_range[0]))
    f_end = int(round(action.frame_range[1]))
    if f_end < f_start:
        f_end = f_start
    return list(range(f_start, f_end + 1))


def main():
    opts = parse_args(sys.argv)
    scene = bpy.context.scene
    studio_core.configure_color_and_render(scene, opts["cell"])
    cam = bpy.data.objects.get("StudioCam")
    dist = 10.0 if not cam else cam.location.length
    studio_core.make_depth_override_material(near_dist=max(0.5, dist - 1.4), far_dist=dist + 1.4)

    arm_obj = next((obj for obj in bpy.data.objects if obj.type == "ARMATURE"), None)
    if not arm_obj:
        raise ValueError("Scene does not contain an Armature")

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    manifest_clips = []
    for state_name, defaults in CANONICAL_CLIPS:
        action = find_action_for_state(state_name)
        if not action:
            continue
        frames = resolve_frame_list(action, state_name)
        bind_action(arm_obj, action)
        studio_core.render_turntable_clip(opts["out"], state_name, frames)

        entry = {"state": state_name, "frameCount": len(frames), "fps": defaults["fps"]}
        if "loopStart" in defaults and len(frames) > defaults["loopStart"]:
            entry["loopStart"] = defaults["loopStart"]
        if "loopEnd" in defaults and len(frames) >= defaults["loopEnd"]:
            entry["loopEnd"] = defaults["loopEnd"]
        manifest_clips.append(entry)

    meta_path = os.path.join(opts["out"], "clips.json")
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump({"cellPx": opts["cell"], "directions": ["south", "side", "north"], "clips": manifest_clips}, fh, indent=2)
    print(f"Exported {len(manifest_clips)} clips to {opts['out']}")


if __name__ == "__main__":
    main()
