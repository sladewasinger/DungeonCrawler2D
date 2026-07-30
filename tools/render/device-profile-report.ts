import {
  CONSTRAINED_DEVICE_PRESENTATION_PROFILE,
  DESKTOP_DEVICE_PRESENTATION_PROFILE,
} from "../../packages/client/src/presentation/devicePresentationProfile.js";
import { statusVisualBudgetFor } from "../../packages/client/src/render/entities/status/statusVisualBudget.js";
import {
  CONSTRAINED_TERRAIN_PROFILE,
  DESKTOP_TERRAIN_PROFILE,
} from "../../packages/client/src/render/terrain/streaming/terrainDeviceProfile.js";
import { areaVisualBudgetFor } from "../../packages/client/src/vfx/areas/presentation/areaVisualBudget.js";

/** Reports the real production budgets selected for capable and constrained devices. */
export function renderDeviceProfileReport() {
  return {
    desktop: profileReport(
      DESKTOP_DEVICE_PRESENTATION_PROFILE,
      DESKTOP_TERRAIN_PROFILE,
    ),
    constrained: profileReport(
      CONSTRAINED_DEVICE_PRESENTATION_PROFILE,
      CONSTRAINED_TERRAIN_PROFILE,
    ),
  };
}

function profileReport(
  presentation: typeof DESKTOP_DEVICE_PRESENTATION_PROFILE,
  terrain: typeof DESKTOP_TERRAIN_PROFILE,
) {
  return {
    terrainRetention: terrain.retention,
    terrainVisuals: terrain.visuals,
    areaVfx: areaVisualBudgetFor(false, false, presentation),
    statusVfx: statusVisualBudgetFor(false, false, presentation),
  };
}
