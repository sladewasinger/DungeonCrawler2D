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


DIRS_4 = (("south", 0.0), ("side", 90.0), ("north", 180.0))
DIRS_8 = (("south", 0.0), ("se", 45.0), ("side", 90.0), ("ne", 135.0), ("north", 180.0))


def parse_args(argv):
    """Parse CLI arguments passed after `--` to export_blend.py."""
    args = argv[argv.index("--") + 1 :] if "--" in argv else []
    opts = {}
    for i in range(0, len(args) - 1, 2):
        if args[i].startswith("--"):
            opts[args[i][2:]] = args[i + 1]
    if "out" not in opts:
        raise ValueError("Missing required --out directory argument")
    return {
        "out": opts["out"],
        "cell": int(opts.get("cell", "0")),
        "pxPerMeter": float(opts.get("pxPerMeter", "48")),
        "dirs": DIRS_8 if opts.get("dirs", "4") == "8" else DIRS_4,
    }


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


def resolve_clip_entry(action, state_name, frames, defaults):
    """Build manifest metadata honoring optional Action custom properties."""
    fps = int(action["fps"]) if "fps" in action else defaults["fps"]
    entry = {"state": state_name, "frameCount": len(frames), "fps": fps}
    loop_start = int(action["loopStart"]) if "loopStart" in action else defaults.get("loopStart")
    loop_end = int(action["loopEnd"]) if "loopEnd" in action else defaults.get("loopEnd")
    if loop_start is not None and len(frames) > loop_start:
        entry["loopStart"] = loop_start
    if loop_end is not None and len(frames) >= loop_end:
        entry["loopEnd"] = loop_end
    return entry


def resolve_export_metrics(scene, opts):
    """Compute target render cell pixels, ground Y row, and px/meter ratio cleanly."""
    base_cell = int(scene.render.resolution_x)
    base_ground_y = int(scene["sprite_ground_y"]) if "sprite_ground_y" in scene else (52 if base_cell == 64 else int(round(base_cell * 0.80)))
    cam = bpy.data.objects.get("StudioCam")
    ortho_scale = float(cam.data.ortho_scale) if cam and cam.data else (base_cell / 32.0)
    if opts["cell"] > 0:
        cell_px = opts["cell"]
        px_per_meter = round(cell_px / ortho_scale, 4)
    else:
        px_per_meter = opts["pxPerMeter"]
        cell_px = int(round(ortho_scale * px_per_meter))
    ground_y = int(round(base_ground_y * (cell_px / float(base_cell))))
    body_alpha = float(scene["sprite_body_alpha"]) if "sprite_body_alpha" in scene else 1.0
    return {"cell_px": cell_px, "ground_y": ground_y, "px_per_meter": px_per_meter, "body_alpha": body_alpha}


def write_clips_manifest(out_dir, metrics, manifest_clips, dir_names):
    """Write clips.json metadata consumed by bakeSpriteSheet.mjs."""
    meta_path = os.path.join(out_dir, "clips.json")
    payload = {
        "cellPx": metrics["cell_px"],
        "groundY": metrics["ground_y"],
        "pxPerMeter": metrics["px_per_meter"],
        "bodyAlpha": metrics.get("body_alpha", 1.0),
        "directions": list(dir_names),
        "clips": manifest_clips,
    }
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)


def main():
    opts = parse_args(sys.argv)
    scene = bpy.context.scene
    metrics = resolve_export_metrics(scene, opts)
    studio_core.configure_color_and_render(scene, metrics["cell_px"])
    cam = bpy.data.objects.get("StudioCam")
    dist = 10.0 if not cam else cam.location.length
    ortho_scale = float(cam.data.ortho_scale) if cam and cam.data else 2.0
    half_depth = max(1.4, min(2.2, ortho_scale * 0.58))
    studio_core.make_depth_override_material(near_dist=max(0.5, dist - half_depth), far_dist=dist + half_depth)

    arm_obj = next((obj for obj in bpy.data.objects if obj.type == "ARMATURE"), None)
    if not arm_obj:
        raise ValueError("Scene does not contain an Armature")

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    manifest_clips = []
    directions = opts["dirs"]
    for state_name, defaults in CANONICAL_CLIPS:
        action = find_action_for_state(state_name)
        if not action:
            continue
        frames = resolve_frame_list(action, state_name)
        bind_action(arm_obj, action)
        studio_core.render_turntable_clip(opts["out"], state_name, frames, directions=directions)
        manifest_clips.append(resolve_clip_entry(action, state_name, frames, defaults))

    write_clips_manifest(opts["out"], metrics, manifest_clips, [name for name, _ in directions])
    print(f"Exported {len(manifest_clips)} clips ({metrics['cell_px']}px, {metrics['px_per_meter']}px/m, groundY={metrics['ground_y']}) to {opts['out']}")


if __name__ == "__main__":
    main()
