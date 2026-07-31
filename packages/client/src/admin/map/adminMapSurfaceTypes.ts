export interface AdminSpawnSelection {
  readonly kind: "enemy" | "item" | "weapon" | "pet";
  readonly defId: string;
  readonly placementAllowed?: boolean;
}

export interface AdminSpectatorSurfaceOptions {
  readonly canvas: HTMLCanvasElement;
  readonly onCameraMove: (x: number, y: number) => void;
  readonly onSpawn: (x: number, y: number, selection: AdminSpawnSelection) => void;
  readonly onDespawn: (entityId: string) => void;
  readonly onZoomChange: (percent: number) => void;
}
