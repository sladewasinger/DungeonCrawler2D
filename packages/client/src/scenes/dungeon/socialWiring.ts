/**
 * Chat/contacts glue extracted from DungeonScene to stay under the file-size cap:
 * builds the HudScene social-actions bundle and the InputHooks social callbacks
 * from a live ChatController + ChatInputBox + HudScene.
 */
import type { ChatController } from "../../ui/chat/controller.js";
import type { ChatInputBox } from "../../ui/chat/chatInput.js";
import type { SocialActions } from "../../ui/widgets/hud/index.js";
import type { SocialHookCallbacks } from "./inputAdapters.js";
import type { HudScene } from "../HudScene.js";

/** Opens the chat input near the chat panel's screen corner (bottom-left, per default-layout.json). */
export function openChatInputAt(box: ChatInputBox, viewportHeight: number, prefill = ""): void {
  box.open(20, viewportHeight - 140, prefill);
}

/** Chat-tab clicks, the contacts chip beside them, and the contacts window's per-row DM button. */
export function buildSocialActions(
  chatController: ChatController,
  box: ChatInputBox,
  viewportHeight: () => number,
  hudScene: HudScene,
): SocialActions {
  return {
    chat: {
      onSelectTab: (tab) => chatController.selectTab(tab),
      onToggleContacts: () => hudScene.toggleContacts(),
    },
    contacts: { startDm: (name) => openChatInputAt(box, viewportHeight(), `/dm ${name} `) },
  };
}

export function buildSocialHooks(
  hudScene: HudScene,
  box: ChatInputBox,
  viewportHeight: () => number,
): SocialHookCallbacks {
  return {
    toggleChat: () => hudScene.toggleChat(),
    toggleInventory: () => hudScene.toggleInventory(),
    openChat: () => openChatInputAt(box, viewportHeight()),
    toggleContacts: () => hudScene.toggleContacts(),
    closeOverlays: () => {
      box.close();
      hudScene.closeContacts();
    },
  };
}
