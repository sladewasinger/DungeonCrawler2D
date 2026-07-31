import { inputModality } from "../../../input/controls/inputModality.js";
import {
  createHudComposition,
  type HudComposition,
} from "./HudComposition.js";
import type { HudOptions, SharedHtmlHud } from "./SharedHtmlHud.js";

export function createSharedHudParts(
  hud: SharedHtmlHud,
  options: HudOptions,
): HudComposition {
  return createHudComposition(
    {
      root: options.root,
      element: hud.element,
      connection: options.connection,
      focusGame: options.focusGame,
      setTextInputFocused: hud.setTextInputFocus,
      touchDevice: inputModality.current === "touch",
      ...(options.viewDistance === undefined ? {} : { viewDistance: options.viewDistance }),
      ...(options.setViewDistance ? { setViewDistance: options.setViewDistance } : {}),
      ...(options.onSelectHotbar ? { onSelectHotbar: options.onSelectHotbar } : {}),
      session: options.session,
    },
    {
      closeInventory: () => hud.closeInventory(),
      toggleContacts: () => hud.toggleContacts(),
      closeContacts: () => hud.closeContacts(),
      closeCraft: () => hud.closeCraft(),
      closeStash: () => hud.closeStash(),
      toggleInventory: () => hud.toggleInventory(),
    },
  );
}
