// Parses assets/dungeon/tile_list_v1.7.txt into frame rects and groups animation frames.
// Frame line format: `name x y w h` (pixel units, origin top-left).

const FRAME_LINE = /^(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/;
// Matches both the pack's `name_anim_f0` convention and the plain `name_f0` one (e.g. `bomb_f0`).
const ANIM_SUFFIX = /^(.+?)_(?:anim_)?f(\d+)$/;

export function parseFrameList(text) {
  const frames = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = FRAME_LINE.exec(line.trim());
    if (!match) continue;
    const [, name, x, y, w, h] = match;
    frames.push({ name, x: Number(x), y: Number(y), w: Number(w), h: Number(h) });
  }
  return frames;
}

/**
 * Groups frames sharing an animation prefix into ordered frame-name arrays.
 * Returns a Map<groupKey, string[]> covering every group, including single-frame ones
 * (callers filter to length > 1 when only multi-frame animations matter).
 */
export function groupFrames(frames) {
  const groups = new Map();
  for (const frame of frames) {
    const match = ANIM_SUFFIX.exec(frame.name);
    if (!match) continue;
    const [, prefix, num] = match;
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push({ num: Number(num), name: frame.name });
  }
  const ordered = new Map();
  for (const [prefix, entries] of groups) {
    ordered.set(prefix, orderGroupFrames(entries));
  }
  return ordered;
}

/**
 * Sorts a group's frames into playback order. Handles the pack's documented `zombie_anim_f10`
 * quirk (INVENTORY.md): when frame 0 is missing but a frame numbered >=10 exists alongside a
 * low contiguous run (1..N), the high-numbered frame is actually the intended first frame.
 */
function orderGroupFrames(entries) {
  entries.sort((a, b) => a.num - b.num);
  const hasZero = entries.some((e) => e.num === 0);
  if (!hasZero) {
    const bigIndex = entries.findIndex((e) => e.num >= 10);
    if (bigIndex > 0) {
      const [big] = entries.splice(bigIndex, 1);
      entries.unshift(big);
    }
  }
  return entries.map((e) => e.name);
}
