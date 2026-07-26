/** Defines the shared HTML HUD window catalog independently from its runtime facade. */
import type { HudWindowSpec } from "./HudWindows.js";

export interface ThreeHudWindowContents {
  status: HTMLElement;
  compass: HTMLElement;
  buffs: HTMLElement;
  hotbar: HTMLElement;
  chat: HTMLElement;
  weapon: HTMLElement;
  party: HTMLElement;
  telemetry: HTMLElement;
  contacts: HTMLElement;
  craft: HTMLElement;
  stash: HTMLElement;
}

const spec = (
  id: string,
  title: string,
  width: number,
  height: number,
  anchor: HudWindowSpec["anchor"],
  content: HTMLElement,
  interactive = false,
  mobile?: HudWindowSpec["mobile"],
  defaultVisible = true,
): HudWindowSpec => ({
  id,
  title,
  width,
  height,
  anchor,
  content,
  interactive,
  defaultVisible,
  ...(mobile ? { mobile } : {}),
});

export const threeHudWindowSpecs = (
  content: ThreeHudWindowContents,
): HudWindowSpec[] => [
  spec("three-health", "Status", 286, 108, "top-left", content.status),
  spec("three-compass", "Compass", 82, 82, "top-center", content.compass),
  spec("three-buffs", "Buffs and debuffs", 286, 72, "center-left", content.buffs),
  spec("three-hotbar", "Hotbar", 620, 58, "bottom-center", content.hotbar, true),
  spec("three-chat", "Chat", 300, 230, "bottom-left", content.chat, true, {
    width: 280,
    height: 190,
    anchor: "center-left",
  }),
  spec("three-weapon", "Active weapon", 230, 84, "bottom-right", content.weapon),
  spec("three-party", "Party", 260, 230, "top-right", content.party),
  spec("three-telemetry", "World status", 244, 150, "center-right", content.telemetry),
  spec("three-contacts", "Contacts", 260, 340, "center", content.contacts, true, undefined, false),
  spec("three-craft", "Crafting", 390, 420, "center", content.craft, true, undefined, false),
  spec("three-stash", "Stash", 460, 420, "center", content.stash, true, undefined, false),
];
