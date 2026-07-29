/** Defines renderer-neutral live and preview inputs accepted by the HUD scene. */
import type { Connection } from "../net/connection/connection.js";
import type { InventoryActions } from "../ui/widgets/hud/inventory/inventoryWindow.js";
import type { HudFakeSnapshot } from "../ui/widgets/hud/core/fakeData.js";
import type {
  SocialActions,
  StationActions,
} from "../ui/widgets/hud/core/index.js";

export interface HudSceneData {
  source?: () => HudFakeSnapshot;
  actions?: InventoryActions;
  social?: SocialActions;
  stations?: StationActions;
  connection?: Connection;
  onSelectHotbar?: (index: number | null) => void;
  session?: {
    respawn(): void;
    rescue(): void;
    quitToTitle(): void;
  };
}
