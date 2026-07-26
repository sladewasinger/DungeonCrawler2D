import type { ChunkVisual, ChunkVisualBuilder } from "./chunkVisualTypes.js";
import { chunkWindowKey, type ChunkCoord, type ViewRect } from "./streaming.js";

export type PageBudgetRecovery =
  | { readonly kind: "evict-margin"; readonly key: string }
  | { readonly kind: "release-replacement"; readonly key: string }
  | { readonly kind: "abandon-build" };

export function planPageBudgetRecovery(
  blockedKey: string,
  residentKeys: Iterable<string>,
  strictViewKeys: ReadonlySet<string>,
): PageBudgetRecovery {
  let hasReplacement = false;
  for (const key of residentKeys) {
    if (key === blockedKey) {
      hasReplacement = true;
      continue;
    }
    if (!strictViewKeys.has(key)) return { kind: "evict-margin", key };
  }
  if (hasReplacement) return { kind: "release-replacement", key: blockedKey };
  return { kind: "abandon-build" };
}

export function recoverPageBudgetBlockedBuild(
  key: string,
  builder: ChunkVisualBuilder,
  visuals: Map<string, ChunkVisual>,
  builders: Map<string, ChunkVisualBuilder>,
  blockedKeys: Set<string>,
  strictViewKeys: ReadonlySet<string>,
  destroyVisual: (visual: ChunkVisual) => void,
): boolean {
  const recovery = planPageBudgetRecovery(key, visuals.keys(), strictViewKeys);
  if (recovery.kind === "evict-margin") {
    builders.get(recovery.key)?.cancel();
    builders.delete(recovery.key);
    const visual = visuals.get(recovery.key);
    if (visual) destroyVisual(visual);
    visuals.delete(recovery.key);
    blockedKeys.add(recovery.key);
    return false;
  }
  if (recovery.kind === "release-replacement") {
    const visual = visuals.get(key);
    if (visual) destroyVisual(visual);
    visuals.delete(key);
    return visual !== undefined;
  }
  builder.cancel();
  builders.delete(key);
  blockedKeys.add(key);
  return false;
}

export function resetPageBudgetBlocksForWindow(
  view: ViewRect,
  marginChunks: number,
  previousWindow: string,
  blockedKeys: Set<string>,
): string {
  const currentWindow = chunkWindowKey(view, marginChunks);
  if (currentWindow !== previousWindow) blockedKeys.clear();
  return currentWindow;
}

export function queuePageBudgetRetries(
  blockedKeys: Set<string>,
  bakeQueue: ChunkCoord[],
  releasedActiveCapacity: boolean,
): void {
  if (!releasedActiveCapacity) return;
  for (const key of blockedKeys) {
    const [cx, cy] = key.split(",").map(Number) as [number, number];
    bakeQueue.push({ cx, cy });
  }
  blockedKeys.clear();
}
