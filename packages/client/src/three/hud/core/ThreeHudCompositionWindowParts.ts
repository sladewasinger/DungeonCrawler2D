import { HudWindowManager } from "../window/layout/HudWindows.js";
import { ThreeHudBuffs } from "../panels/ThreeHudBuffs.js";
import { ThreeHudCompass } from "../model/ThreeHudCompass.js";
import { ThreeHudHotbar } from "../panels/ThreeHudHotbar.js";
import { ThreeHudInventory } from "../panels/ThreeHudInventory.js";
import { ThreeHudNotices } from "../feedback/ThreeHudNotices.js";
import { ThreeHudOverlays } from "./ThreeHudOverlays.js";
import { createThreeHudPanels } from "./ThreeHudPanels.js";
import { createHudSettings } from "./ThreeHudSetup.js";
import { ThreeHudTouchOverlay } from "../../input/touch-controls/ThreeHudTouchOverlay.js";
import { ThreeHudTutorials } from "../feedback/ThreeHudTutorials.js";
import { ThreeHudStatus } from "../panels/ThreeHudStatus.js";
import { ThreeHudTelemetry } from "../model/ThreeHudTelemetry.js";
import { ThreeHudWeapon } from "../panels/ThreeHudWeapon.js";
import { threeHudWindowSpecs } from "../model/ThreeHudWindowSpecs.js";
import { ThreePartyTracker } from "../../world/party/ThreePartyTracker.js";
import type {
  StaticParts,
  ThreeHudCompositionActions,
  ThreeHudCompositionOptions,
  WindowParts,
} from "./ThreeHudComposition.js";

export const createStaticParts = (
  options: ThreeHudCompositionOptions,
  actions: ThreeHudCompositionActions,
): StaticParts => {
  const tutorials = new ThreeHudTutorials(options.touchDevice ? "touch" : "keyboard");
  return {
    status: new ThreeHudStatus(), compass: new ThreeHudCompass(),
    hotbar: new ThreeHudHotbar(options.onSelectHotbar), buffs: new ThreeHudBuffs(),
    weapon: new ThreeHudWeapon(), telemetry: new ThreeHudTelemetry(),
    party: new ThreePartyTracker(options.connection), tutorials,
    notices: new ThreeHudNotices(),
    inventory: new ThreeHudInventory(options.connection, actions.closeInventory, options.touchDevice),
  };
};

export const createWindowParts = (
  options: ThreeHudCompositionOptions,
  actions: ThreeHudCompositionActions,
  statics: StaticParts,
): WindowParts => {
  const panels = createThreeHudPanels({
    connection: options.connection, mobile: options.touchDevice, focusGame: options.focusGame,
    setTextInputFocused: options.setTextInputFocused,
    actions: { toggleContacts: actions.toggleContacts, closeContacts: actions.closeContacts, closeCraft: actions.closeCraft, closeStash: actions.closeStash },
  });
  const manager = new HudWindowManager(options.element);
  addHudWindows(manager, statics, panels);
  return {
    panels, manager,
    overlays: new ThreeHudOverlays({ manager, panels, focusGame: options.focusGame, releaseStash: options.connection.closeLootChest.bind(options.connection) }),
    touch: new ThreeHudTouchOverlay(actions.toggleInventory),
    settings: createHudSettings(manager, { viewDistance: options.viewDistance, setViewDistance: options.setViewDistance }),
  };
};

function addHudWindows(manager: HudWindowManager, statics: StaticParts, panels: WindowParts["panels"]): void {
  threeHudWindowSpecs({
    status: statics.status.element, compass: statics.compass.element, buffs: statics.buffs.element,
    hotbar: statics.hotbar.element, chat: panels.chat.element, weapon: statics.weapon.element,
    party: statics.party.element, telemetry: statics.telemetry.element, contacts: panels.contacts.element,
    craft: panels.craft.element, stash: panels.stash.element,
  }).forEach((window) => manager.add(window));
}
