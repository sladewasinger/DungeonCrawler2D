import { HudWindowManager } from "../window/layout/HudWindows.js";
import { HudBuffs } from "../panels/HudBuffs.js";
import { HudCompass } from "../model/HudCompass.js";
import { HudHotbar } from "../panels/HudHotbar.js";
import { HudInventory } from "../panels/HudInventory.js";
import { HudNotices } from "../feedback/HudNotices.js";
import { HudOverlays } from "./HudOverlays.js";
import { createHudPanels } from "./HudPanels.js";
import { createHudSettings } from "./HudSetup.js";
import { HudTouchOverlay } from "../touch/HudTouchOverlay.js";
import { HudTutorials } from "../feedback/HudTutorials.js";
import { HudStatus } from "../panels/HudStatus.js";
import { HudTelemetry } from "../model/HudTelemetry.js";
import { HudWeapon } from "../panels/HudWeapon.js";
import { hudWindowSpecs } from "../model/HudWindowSpecs.js";
import { PartyTracker } from "../party/PartyTracker.js";
import type {
  StaticParts,
  HudCompositionActions,
  HudCompositionOptions,
  WindowParts,
} from "./HudComposition.js";

export const createStaticParts = (
  options: HudCompositionOptions,
  actions: HudCompositionActions,
): StaticParts => {
  const tutorials = new HudTutorials(options.touchDevice ? "touch" : "keyboard");
  return {
    status: new HudStatus(), compass: new HudCompass(),
    hotbar: new HudHotbar(options.onSelectHotbar), buffs: new HudBuffs(),
    weapon: new HudWeapon(), telemetry: new HudTelemetry(),
    party: new PartyTracker(options.connection), tutorials,
    notices: new HudNotices(),
    inventory: new HudInventory(options.connection, actions.closeInventory, options.touchDevice),
  };
};

export const createWindowParts = (
  options: HudCompositionOptions,
  actions: HudCompositionActions,
  statics: StaticParts,
): WindowParts => {
  const panels = createHudPanels({
    connection: options.connection, mobile: options.touchDevice, focusGame: options.focusGame,
    setTextInputFocused: options.setTextInputFocused,
    actions: { toggleContacts: actions.toggleContacts, closeContacts: actions.closeContacts, closeCraft: actions.closeCraft, closeStash: actions.closeStash },
  });
  const manager = new HudWindowManager(options.element);
  addHudWindows(manager, { statics, panels, adminDebug: options.adminDebug });
  return {
    panels, manager,
    overlays: new HudOverlays({ manager, panels, focusGame: options.focusGame, releaseStash: options.connection.closeLootChest.bind(options.connection) }),
    touch: new HudTouchOverlay(actions.toggleInventory),
    settings: createHudSettings(manager, {
      connection: options.connection,
      viewDistance: options.viewDistance,
      setViewDistance: options.setViewDistance,
    }),
  };
};

function addHudWindows(
  manager: HudWindowManager,
  content: {
    readonly statics: StaticParts;
    readonly panels: WindowParts["panels"];
    readonly adminDebug: HTMLElement;
  },
): void {
  const { statics, panels, adminDebug } = content;
  hudWindowSpecs({
    status: statics.status.element, compass: statics.compass.element, buffs: statics.buffs.element,
    hotbar: statics.hotbar.element, chat: panels.chat.element, weapon: statics.weapon.element,
    party: statics.party.element, telemetry: statics.telemetry.element, contacts: panels.contacts.element,
    craft: panels.craft.element, stash: panels.stash.element,
    adminDebug,
  }).forEach((window) => manager.add(window));
}
