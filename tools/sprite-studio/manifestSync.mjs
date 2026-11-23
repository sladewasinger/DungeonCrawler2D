/** Updates sprite-manifest.json with baked multi-clip animations and measured bounds. */
import fs from "node:fs";

function buildClipSpec(meta, rowIdx, frameCount) {
  const frames = Array.from({ length: frameCount }, (_, col) => [col, rowIdx]);
  const spec = { fps: meta.fps };
  if (meta.loopStart !== undefined) spec.loopStart = meta.loopStart;
  if (meta.loopEnd !== undefined) spec.loopEnd = meta.loopEnd;
  spec.frames = frames;
  return spec;
}

export function buildManifestClips(clipEntries, directions = ["south", "side", "north"]) {
  const clips = {};
  for (const entry of clipEntries) {
    if (entry.state === "corpse") {
      const row = entry.rows.get("south");
      const corpseClip = buildClipSpec(entry, row, 1);
      clips.corpse = Object.fromEntries(directions.map((d) => [d, corpseClip]));
      continue;
    }
    const byDir = {};
    for (const [dir, rowIdx] of entry.rows.entries()) {
      byDir[dir] = buildClipSpec(entry, rowIdx, entry.frameCount);
    }
    clips[entry.state] = byDir;
  }
  return clips;
}

export function updateCreatureManifest(opts) {
  const { manifestPath, creature, cellW, cellH, idleBounds, groundY, scale, clipEntries, directions } = opts;
  if (!manifestPath) return;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.assets[creature] = {
    path: `/assets/creatures/${creature}.png`,
    width: cellW,
    height: cellH,
    contentWidth: idleBounds.contentWidth,
    contentHeight: idleBounds.contentHeight,
    scale: scale ?? 0.5,
    anchorX: 0.5,
    anchorY: Number((groundY / cellH).toFixed(4)),
    animations: {
      sheetPath: `/assets/creatures/${creature}-sheet.png`,
      frameWidth: cellW,
      frameHeight: cellH,
      clips: buildManifestClips(clipEntries, directions),
    },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
