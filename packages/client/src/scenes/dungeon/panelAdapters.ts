/**
 * Range-gated panel wiring (Epic 7.12): the crafting-table/stash open/close/toggle
 * semantics ported from reference/client/ui/panels.ts's Panels class, plus the two
 * windows' network-intent adapters. Split out of inputAdapters.ts to keep that file
 * focused on connection/query/hook adapters.
 */
import type { InputConnection, InputPanels, InputQueries } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import type { CraftActions } from "../../ui/widgets/hud/craftWindow.js";
import type { StashActions } from "../../ui/widgets/hud/stashWindow.js";

/** The slice of HudScene's window-widget state/actions InputPanels needs — kept structural
 * (not a HudScene import) so this module stays decoupled from scenes/HudScene.ts, mirroring
 * inputAdapters.ts's former InventoryPanelSource. */
export interface PanelSource {
  inventoryOpen(): boolean;
  selectedInventoryItem(): string | null;
  closeInventory(): void;
  craftOpen(): boolean;
  toggleCraftPanel(): void;
  closeCraftPanel(): void;
  stashOpen(): boolean;
  openStashPanel(): void;
  closeStashPanel(): void;
}

/**
 * [C]: closes an open craft window unconditionally (no range check needed to close);
 * opens it only when a crafting table is nearby right now. Matches v1's
 * `craftOpen = !craftOpen && tableNearby(conn)` exactly.
 */
function toggleCraft(hud: PanelSource, queries: InputQueries, conn: InputConnection): void {
  if (hud.craftOpen()) {
    hud.closeCraftPanel();
    return;
  }
  if (queries.isCraftTableNearby(conn)) {
    hud.closeStashPanel();
    hud.toggleCraftPanel();
  }
  // Judge-panel finding: "failed actions give no feedback" — [C] away from any table
  // used to be a silent no-op (Epic 7.13 onboarding lane).
  else conn.pushToast("No crafting table nearby");
}

/** [E] near a stash toggles its panel. The shared gameplay action sends the server
 * interaction only when opening, which refreshes the authoritative stash snapshot. */
function toggleStash(hud: PanelSource, queries: InputQueries, conn: InputConnection): boolean {
  if (hud.stashOpen()) {
    hud.closeStashPanel();
    return false;
  }
  if (!queries.isStashNearby(conn)) return false;
  hud.closeCraftPanel();
  hud.openStashPanel();
  return true;
}

export function createInputPanels(hud: PanelSource, queries: InputQueries): InputPanels {
  return {
    get craftOpen() {
      return hud.craftOpen();
    },
    get stashOpen() {
      return hud.stashOpen();
    },
    get inventoryOpen() {
      return hud.inventoryOpen();
    },
    get selectedInventoryItem() {
      return hud.selectedInventoryItem();
    },
    toggleStash: (conn) => toggleStash(hud, queries, conn),
    toggleCraft: (conn) => toggleCraft(hud, queries, conn),
    closeAll: () => {
      hud.closeInventory();
      hud.closeCraftPanel();
      hud.closeStashPanel();
    },
  };
}

/** The crafting window's network intent — Connection.craft(recipeId). */
export function createCraftActions(conn: Connection): CraftActions {
  return { craft: (recipeId) => conn.craft(recipeId) };
}

/** The stash window's network intents — both index-addressed (net/connection.ts's stashOp). */
export function createStashActions(conn: Connection): StashActions {
  return {
    put: (index) => conn.stashOp("put", index),
    take: (index) => conn.stashOp("take", index),
  };
}
