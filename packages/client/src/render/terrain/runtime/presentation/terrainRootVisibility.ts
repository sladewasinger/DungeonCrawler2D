import type { ViewOrientation } from "../../../view/orientation/viewOrientation.js";
import type { TerrainRoot } from "../root.js";

export function syncTerrainRootVisibility(
  roots: Iterable<TerrainRoot>,
  orientation: ViewOrientation,
  hasAtlasAssets: boolean,
): void {
  for (const root of roots) {
    root.graphics.setVisible(root.orientation === orientation && !hasAtlasAssets);
    root.atlas.setVisible(root.orientation === orientation);
    for (const prop of root.props.values()) prop.setVisible(root.orientation === orientation);
  }
}
