/** Live pose-tuning store backed by playerPoseTuning.json with mirror/reset/dev-save helpers. */
import defaultJson from "./playerPoseTuning.json" with { type: "json" };
import type { BodyKind, BodyPoseTuning, FreeArmDirTune, PlayerPoseTuning } from "./poseTuningTypes.js";

const MIRROR_PAIRS: Readonly<Record<number, number>> = { 1: 7, 7: 1, 2: 6, 6: 2, 3: 5, 5: 3 };

let activeTuning: PlayerPoseTuning = structuredClone(defaultJson) as PlayerPoseTuning;

export function getPoseTuning(body?: string): BodyPoseTuning {
  return body === "female" ? activeTuning.female : activeTuning.male;
}

export function getFullPoseTuning(): PlayerPoseTuning {
  return activeTuning;
}

export function resetPoseTuning(): void {
  activeTuning = structuredClone(defaultJson) as PlayerPoseTuning;
}

export function resetPoseTuningDir(body: BodyKind, dirIdx: number): void {
  const def = (defaultJson as PlayerPoseTuning)[body];
  const cur = activeTuning[body];
  const fl = def.freeLeft[dirIdx];
  const fr = def.freeRight[dirIdx];
  const sw = def.sword[dirIdx];
  const lt = def.lantern[dirIdx];
  const bw = def.bow[dirIdx];
  if (fl) cur.freeLeft[dirIdx] = { ...fl };
  if (fr) cur.freeRight[dirIdx] = { ...fr };
  if (sw) cur.sword[dirIdx] = { ...sw };
  if (lt) cur.lantern[dirIdx] = { ...lt };
  if (bw) cur.bow[dirIdx] = { ...bw };
}

export function copyBodyTuning(from: BodyKind, to: BodyKind): void {
  activeTuning[to] = structuredClone(activeTuning[from]);
}

function mirrorFreeArm(src: FreeArmDirTune): FreeArmDirTune {
  const sign = src.bendSign === 0 ? 0 : (-src.bendSign as -1 | 1);
  return { ...src, sxOff: -src.sxOff, txOff: -src.txOff, bendSign: sign };
}

export function mirrorEastWestPair(body: BodyKind, srcDirIdx: number): boolean {
  const dstDirIdx = MIRROR_PAIRS[srcDirIdx];
  if (dstDirIdx === undefined) return false;
  const cur = activeTuning[body];
  const fl = cur.freeLeft[srcDirIdx];
  const fr = cur.freeRight[srcDirIdx];
  const sw = cur.sword[srcDirIdx];
  const lt = cur.lantern[srcDirIdx];
  const bw = cur.bow[srcDirIdx];
  if (fr) cur.freeLeft[dstDirIdx] = mirrorFreeArm(fr);
  if (fl) cur.freeRight[dstDirIdx] = mirrorFreeArm(fl);
  if (sw) cur.sword[dstDirIdx] = { ...sw, x: -sw.x, rot: -sw.rot, rotSign: -sw.rotSign as -1 | 1, scaleSign: -sw.scaleSign as -1 | 1 };
  if (lt) cur.lantern[dstDirIdx] = { ...lt, x: -lt.x, rot: -lt.rot };
  if (bw) cur.bow[dstDirIdx] = { ...bw, offsetX: -bw.offsetX };
  return true;
}

export async function savePoseTuningToServer(): Promise<{ readonly ok: boolean; readonly message: string }> {
  try {
    const res = await fetch("/__dev/save-pose-tuning", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-DC2D-Dev-Save": "1" },
      body: JSON.stringify(activeTuning),
    });
    const data = (await res.json()) as { readonly ok?: boolean; readonly error?: string };
    if (!res.ok || !data.ok) return { ok: false, message: data.error ?? `HTTP ${res.status}` };
    return { ok: true, message: "Saved playerPoseTuning.json!" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Save failed" };
  }
}
