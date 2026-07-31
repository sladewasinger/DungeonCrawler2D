export interface DisposableDebugLabel {
  destroy(): void;
}

/** Destroys labels that no longer have an authoritative nearby entity. */
export function pruneGameplayDebugLabels<T extends DisposableDebugLabel>(
  labels: Map<string, T>,
  activeIds: ReadonlySet<string>,
): void {
  for (const [id, label] of labels) {
    if (activeIds.has(id)) continue;
    label.destroy();
    labels.delete(id);
  }
}
