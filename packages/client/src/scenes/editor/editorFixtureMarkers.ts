import Phaser from "phaser";
import { depthForEntity } from "../../render/entities/presentation/depthSort.js";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { getViewOrientation } from "../../render/view/transform/viewState.js";
import { worldToView } from "../../render/view/transform/viewTransform.js";
import type { EditorFixture, EditorTerrainWorld } from "./EditorTerrainWorld.js";

export class EditorFixtureMarkers {
  private readonly markers = new Map<string, Phaser.GameObjects.Text>();

  constructor(private readonly scene: Phaser.Scene) {}

  sync(world: EditorTerrainWorld): void {
    const active = new Set<string>();
    for (const edited of world.editedCells()) {
      if (!edited.fixture) continue;
      const key = `${edited.point.x},${edited.point.y}`;
      active.add(key);
      const view = worldToView(edited.point, getViewOrientation());
      const marker = this.markers.get(key) ?? this.createMarker();
      marker.setText(markerText(edited.fixture));
      marker.setPosition((view.x + 0.5) * SCREEN_TILE_PX, (view.y + 0.5) * SCREEN_TILE_PX);
      marker.setDepth(depthForEntity(view.y + 1));
      this.markers.set(key, marker);
    }
    this.removeInactive(active);
  }

  dispose(): void {
    for (const marker of this.markers.values()) marker.destroy();
    this.markers.clear();
  }

  private createMarker(): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, "", { color: "#ffe38a", fontSize: "12px" });
  }

  private removeInactive(active: ReadonlySet<string>): void {
    for (const [key, marker] of this.markers) {
      if (active.has(key)) continue;
      marker.destroy();
      this.markers.delete(key);
    }
  }
}

function markerText(fixture: EditorFixture): string {
  return { safe: "S", spawn: "P", arena: "A", feature: "F" }[fixture];
}
