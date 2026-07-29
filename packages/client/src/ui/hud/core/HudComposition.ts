/** Constructs the shared HTML HUD components while the Hud facade owns behavior. */
import type { Connection } from "../../../net/connection/connection.js";
import { SessionMenu, type SessionMenuActions } from "../../../ui/sessionMenu/SessionMenu.js";
import { HudWindowManager } from "../window/layout/HudWindows.js";
import { DownedOverlay } from "../feedback/DownedOverlay.js";
import { HudBuffs } from "../panels/HudBuffs.js";
import { HudCompass } from "../model/HudCompass.js";
import { HudHotbar } from "../panels/HudHotbar.js";
import { HealthFeedback } from "../feedback/HealthFeedback.js";
import { HudInventory } from "../panels/HudInventory.js";
import { HudNotices } from "../feedback/HudNotices.js";
import { HudOverlays } from "./HudOverlays.js";
import { type HudPanels } from "./HudPanels.js";
import { HudSettings } from "../panels/HudSettings.js";
import { mountHudOverlays, mountHudRoot } from "./HudSetup.js";
import { HudStatus } from "../panels/HudStatus.js";
import { HudTelemetry } from "../model/HudTelemetry.js";
import { HudTouchOverlay } from "../touch/HudTouchOverlay.js";
import { HudTutorials } from "../feedback/HudTutorials.js";
import { HudWeapon } from "../panels/HudWeapon.js";
import { PartyInvite } from "../party/PartyInvite.js";
import { PartyTracker } from "../party/PartyTracker.js";
import type { ViewDistance } from "../../../three/terrain/view/viewDistance.js";
import { createStaticParts, createWindowParts } from "./HudCompositionWindowParts.js";

export interface HudComposition {
  manager: HudWindowManager;
  status: HudStatus;
  compass: HudCompass;
  hotbar: HudHotbar;
  buffs: HudBuffs;
  weapon: HudWeapon;
  telemetry: HudTelemetry;
  party: PartyTracker;
  inventory: HudInventory;
  panels: HudPanels;
  overlays: HudOverlays;
  downed: DownedOverlay;
  invite: PartyInvite;
  tutorials: HudTutorials;
  notices: HudNotices;
  settings: HudSettings;
  touch: HudTouchOverlay;
  sessionMenu: SessionMenu;
  healthFeedback: HealthFeedback;
}

export interface HudCompositionOptions {
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

export interface HudCompositionActions {
  closeInventory(): void;
  toggleContacts(): void;
  closeContacts(): void;
  closeCraft(): void;
  closeStash(): void;
  toggleInventory(): void;
}

export type StaticParts = Pick<
  HudComposition,
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
  HudComposition,
  "panels" | "manager" | "overlays" | "touch" | "settings"
>;

type OverlayParts = Pick<
  HudComposition,
  "sessionMenu" | "downed" | "invite" | "healthFeedback"
>;


const createOverlayParts = (
  options: HudCompositionOptions,
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
  const downed = new DownedOverlay(
    options.element,
    () => options.connection.suicide(),
  );
  const invite = new PartyInvite(options.connection);
  const healthFeedback = new HealthFeedback();
  mountCompositionOverlays({ element: options.element, statics, windows, invite, healthFeedback });
  return { sessionMenu, downed, invite, healthFeedback };
};

interface CompositionOverlayMount {
  element: HTMLElement;
  statics: StaticParts;
  windows: WindowParts;
  invite: PartyInvite;
  healthFeedback: HealthFeedback;
}

function mountCompositionOverlays({ element, statics, windows, invite, healthFeedback }: CompositionOverlayMount): void {
  mountHudOverlays(element, [invite.element, statics.tutorials.element, windows.touch.element, statics.notices.element, statics.inventory.element, healthFeedback.element]);
}

export const createHudComposition = (
  options: HudCompositionOptions,
  actions: HudCompositionActions,
): HudComposition => {
  mountHudRoot(options.root, options.element);
  const statics = createStaticParts(options, actions);
  const windows = createWindowParts(options, actions, statics);
  const overlays = createOverlayParts(options, statics, windows);
  return { ...statics, ...windows, ...overlays };
};
