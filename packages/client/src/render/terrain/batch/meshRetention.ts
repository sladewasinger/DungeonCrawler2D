interface RetainedTerrainMesh {
  destroy(): void;
  setVisible(visible: boolean): unknown;
}

interface TerrainMeshRetentionInput<T extends RetainedTerrainMesh> {
  readonly meshes: Map<string, T>;
  readonly active: ReadonlySet<string>;
  readonly visible: boolean;
}

/** Retains only meshes submitted by the latest plan and synchronizes visibility. */
export function pruneTerrainMeshes<T extends RetainedTerrainMesh>(
  input: TerrainMeshRetentionInput<T>,
): void {
  for (const [key, mesh] of input.meshes) {
    if (input.active.has(key)) {
      mesh.setVisible(input.visible);
      continue;
    }
    mesh.destroy();
    input.meshes.delete(key);
  }
}
