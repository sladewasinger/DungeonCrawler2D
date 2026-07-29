interface Destroyable {
  destroy(): void;
}

/** Removes depth rows no longer represented by the current terrain plan. */
export function pruneTerrainLayers<T extends Destroyable>(
  layers: Map<number, T>,
  activeDepths: ReadonlySet<number>,
): void {
  for (const [depth, layer] of layers) {
    if (activeDepths.has(depth)) continue;
    layer.destroy();
    layers.delete(depth);
  }
}
