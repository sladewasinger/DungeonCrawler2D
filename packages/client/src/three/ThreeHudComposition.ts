/** Constructs the shared HTML HUD components while the ThreeHud facade owns behavior. */
import type { Connection } from "../net/connection.js";
import {
  SessionMenu,
  type SessionMenuActions,
} from "../ui/sessionMenu/SessionMenu.js";
import { HudWindowManager } from "./HudWindows.js";
import { ThreeDownedOverlay } from "./ThreeDownedOverlay.js";
import { ThreeHudBuffs } from "./ThreeHudBuffs.js";
import { ThreeHudHotbar } from "./ThreeHudHotbar.js";
import { ThreeHudInventory } from "./ThreeHudInventory.js";
import { ThreeHudNotices } from "./ThreeHudNotices.js";
import { ThreeHudOverlays } from "./ThreeHudOverlays.js";
import { createThreeHudPanels, type ThreeHudPanels } from "./ThreeHudPanels.js";
import { ThreeHudSettings } from "./ThreeHudSettings.js";
import {
  createHudSettings,
  mountHudOverlays,
  mountHudRoot,
} from "./ThreeHudSetup.js";
import { ThreeHudStatus } from "./ThreeHudStatus.js";
import { ThreeHudTelemetry } from "./ThreeHudTelemetry.js";
import { ThreeHudTouchOverlay } from "./ThreeHudTouchOverlay.js";
import { ThreeHudTutorials } from "./ThreeHudTutorials.js";
import { ThreeHudWeapon } from "./ThreeHudWeapon.js";
import { threeHudWindowSpecs } from "./ThreeHudWindowSpecs.js";
import { ThreePartyInvite } from "./ThreePartyInvite.js";
import { ThreePartyTracker } from "./ThreePartyTracker.js";
import type { ViewDistance } from "./viewDistance.js";

export interface ThreeHudComposition {
  manager: HudWindowManager;
  status: ThreeHudStatus;
  hotbar: ThreeHudHotbar;
  buffs: ThreeHudBuffs;
  weapon: ThreeHudWeapon;
  telemetry: ThreeHudTelemetry;
  party: ThreePartyTracker;
  inventory: ThreeHudInventory;
  panels: ThreeHudPanels;
  overlays: ThreeHudOverlays;
  downed: ThreeDownedOverlay;
  invite: ThreePartyInvite;
  tutorials: ThreeHudTutorials;
  notices: ThreeHudNotices;
  settings: ThreeHudSettings;
  touch: ThreeHudTouchOverlay;
  sessionMenu: SessionMenu;
}

export interface ThreeHudCompositionOptions {
  root: HTMLElement;
  element: HTMLElement;
  connection: Connection;
  focusGame(): void;
  setTextInputFocused(focused: boolean): void;
  touchDevice: boolean;
  viewDistance?: ViewDistance;
  setViewDistance?: (viewDistance: ViewDistance) => void;
  onSelectHotbar?: (index: number | null) => void;
  session: Omit<SessionMenuActions, "focusGame">;
}

export interface ThreeHudCompositionActions {
  closeInventory(): void;
  toggleContacts(): void;
  closeContacts(): void;
  closeCraft(): void;
  closeStash(): void;
  toggleInventory(): void;
}

type StaticParts = Pick<
  ThreeHudComposition,
  | "status"
  | "hotbar"
  | "buffs"
  | "weapon"
  | "telemetry"
  | "party"
  | "tutorials"
  | "notices"
  | "inventory"
>;

type WindowParts = Pick<
  ThreeHudComposition,
  "panels" | "manager" | "overlays" | "touch" | "settings"
>;

type OverlayParts = Pick<
  ThreeHudComposition,
  "sessionMenu" | "downed" | "invite"
>;

const createStaticParts = (
  options: ThreeHudCompositionOptions,
  actions: ThreeHudCompositionActions,
): StaticParts => {
  const tutorials = new ThreeHudTutorials(
    options.touchDevice ? "touch" : "keyboard",
  );
  return {
    status: new ThreeHudStatus(),
    hotbar: new ThreeHudHotbar(options.onSelectHotbar),
    buffs: new ThreeHudBuffs(),
    weapon: new ThreeHudWeapon(),
    telemetry: new ThreeHudTelemetry(),
    party: new ThreePartyTracker(),
    tutorials,
    notices: new ThreeHudNotices(),
    inventory: new ThreeHudInventory(
      options.connection,
      actions.closeInventory,
    ),
  };
};

const createWindowParts = (
  options: ThreeHudCompositionOptions,
  actions: ThreeHudCompositionActions,
  statics: StaticParts,
): WindowParts => {
  const panels = createThreeHudPanels(
    options.connection,
    options.touchDevice,
    options.focusGame,
    options.setTextInputFocused,
    {
      toggleContacts: actions.toggleContacts,
      closeContacts: actions.closeContacts,
      closeCraft: actions.closeCraft,
      closeStash: actions.closeStash,
    },
  );
  const manager = new HudWindowManager(options.element);
  threeHudWindowSpecs({
    status: statics.status.element,
    buffs: statics.buffs.element,
    hotbar: statics.hotbar.element,
    chat: panels.chat.element,
    weapon: statics.weapon.element,
    party: statics.party.element,
    telemetry: statics.telemetry.element,
    contacts: panels.contacts.element,
    craft: panels.craft.element,
    stash: panels.stash.element,
  }).forEach((window) => manager.add(window));
  const overlays = new ThreeHudOverlays(manager, panels, options.focusGame);
  const touch = new ThreeHudTouchOverlay(actions.toggleInventory);
  const settings = createHudSettings(manager, {
    viewDistance: options.viewDistance,
    setViewDistance: options.setViewDistance,
    replayTutorials: () => statics.tutorials.replay(),
  });
  return { panels, manager, overlays, touch, settings };
};

const createOverlayParts = (
  options: ThreeHudCompositionOptions,
  statics: StaticParts,
  windows: WindowParts,
): OverlayParts => {
  const sessionMenu = new SessionMenu(
    options.root,
    options.element,
    windows.settings.element,
    {
      focusGame: options.focusGame,
      ...options.session,
      beforeOpen: () => {
        statics.inventory.close();
        windows.overlays.closeAll();
        options.setTextInputFocused(false);
      },
      onOpenChange: options.setTextInputFocused,
    },
  );
  windows.settings.onEditingChange((editing) => {
    if (editing) sessionMenu.close(false);
  });
  const downed = new ThreeDownedOverlay(options.element);
  const invite = new ThreePartyInvite(options.connection);
  mountHudOverlays(options.element, [
    invite.element,
    statics.tutorials.element,
    windows.touch.element,
    statics.notices.element,
    statics.inventory.element,
  ]);
  return { sessionMenu, downed, invite };
};

export const createThreeHudComposition = (
  options: ThreeHudCompositionOptions,
  actions: ThreeHudCompositionActions,
): ThreeHudComposition => {
  mountHudRoot(options.root, options.element);
  const statics = createStaticParts(options, actions);
  const windows = createWindowParts(options, actions, statics);
  const overlays = createOverlayParts(options, statics, windows);
  return { ...statics, ...windows, ...overlays };
};
