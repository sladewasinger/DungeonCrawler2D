/** Constructs the shared HTML HUD components while the ThreeHud facade owns behavior. */
import type { Connection } from "../../../net/connection/connection.js";
import { SessionMenu, type SessionMenuActions } from "../../../ui/sessionMenu/SessionMenu.js";
import { HudWindowManager } from "../window/layout/HudWindows.js";
import { ThreeDownedOverlay } from "../feedback/ThreeDownedOverlay.js";
import { ThreeHudBuffs } from "../panels/ThreeHudBuffs.js";
import { ThreeHudCompass } from "../model/ThreeHudCompass.js";
import { ThreeHudHotbar } from "../panels/ThreeHudHotbar.js";
import { ThreeHealthFeedback } from "../feedback/ThreeHealthFeedback.js";
import { ThreeHudInventory } from "../panels/ThreeHudInventory.js";
import { ThreeHudNotices } from "../feedback/ThreeHudNotices.js";
import { ThreeHudOverlays } from "./ThreeHudOverlays.js";
import { type ThreeHudPanels } from "./ThreeHudPanels.js";
import { ThreeHudSettings } from "../panels/ThreeHudSettings.js";
import { mountHudOverlays, mountHudRoot } from "./ThreeHudSetup.js";
import { ThreeHudStatus } from "../panels/ThreeHudStatus.js";
import { ThreeHudTelemetry } from "../model/ThreeHudTelemetry.js";
import { ThreeHudTouchOverlay } from "../../input/touch-controls/ThreeHudTouchOverlay.js";
import { ThreeHudTutorials } from "../feedback/ThreeHudTutorials.js";
import { ThreeHudWeapon } from "../panels/ThreeHudWeapon.js";
import { ThreePartyInvite } from "../../world/party/ThreePartyInvite.js";
import { ThreePartyTracker } from "../../world/party/ThreePartyTracker.js";
import type { ViewDistance } from "../../terrain/view/viewDistance.js";
import { createStaticParts, createWindowParts } from "./ThreeHudCompositionWindowParts.js";

export interface ThreeHudComposition {
  manager: HudWindowManager;
  status: ThreeHudStatus;
  compass: ThreeHudCompass;
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
  healthFeedback: ThreeHealthFeedback;
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

export type StaticParts = Pick<
  ThreeHudComposition,
  | "status"
  | "compass"
  | "hotbar"
  | "buffs"
  | "weapon"
  | "telemetry"
  | "party"
  | "tutorials"
  | "notices"
  | "inventory"
>;

export type WindowParts = Pick<
  ThreeHudComposition,
  "panels" | "manager" | "overlays" | "touch" | "settings"
>;

type OverlayParts = Pick<
  ThreeHudComposition,
  "sessionMenu" | "downed" | "invite" | "healthFeedback"
>;


const createOverlayParts = (
  options: ThreeHudCompositionOptions,
  statics: StaticParts,
  windows: WindowParts,
): OverlayParts => {
  const sessionMenu = new SessionMenu({
    appRoot: options.root,
    hudRoot: options.element,
    settingsContent: windows.settings.element,
    actions: {
      focusGame: options.focusGame,
      ...options.session,
      replayTutorials: () => statics.tutorials.replay(),
      beforeOpen: () => {
        statics.inventory.close();
        windows.overlays.closeAll();
        options.setTextInputFocused(false);
      },
      onOpenChange: options.setTextInputFocused,
    },
  });
  const downed = new ThreeDownedOverlay(
    options.element,
    () => options.connection.suicide(),
  );
  const invite = new ThreePartyInvite(options.connection);
  const healthFeedback = new ThreeHealthFeedback();
  mountCompositionOverlays({ element: options.element, statics, windows, invite, healthFeedback });
  return { sessionMenu, downed, invite, healthFeedback };
};

interface CompositionOverlayMount {
  element: HTMLElement;
  statics: StaticParts;
  windows: WindowParts;
  invite: ThreePartyInvite;
  healthFeedback: ThreeHealthFeedback;
}

function mountCompositionOverlays({ element, statics, windows, invite, healthFeedback }: CompositionOverlayMount): void {
  mountHudOverlays(element, [invite.element, statics.tutorials.element, windows.touch.element, statics.notices.element, statics.inventory.element, healthFeedback.element]);
}

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
