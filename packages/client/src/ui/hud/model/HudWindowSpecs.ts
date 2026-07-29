/** Defines the shared HTML HUD window catalog independently from its runtime facade. */
import type { HudWindowSpec } from "../window/layout/HudWindows.js";

export interface HudWindowContents {
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

type WindowSpecInput = Pick<
  HudWindowSpec,
  "id" | "title" | "width" | "height" | "anchor" | "content" |
  "interactive" | "mobile" | "defaultVisible" | "chrome"
>;

const spec = ({
  id,
  title,
  width,
  height,
  anchor,
  content,
  interactive = false,
  mobile,
  defaultVisible = true,
  chrome,
}: WindowSpecInput): HudWindowSpec => ({
  id,
  title,
  width,
  height,
  anchor,
  content,
  interactive,
  defaultVisible,
  ...(mobile ? { mobile } : {}),
  ...(chrome ? { chrome } : {}),
});

export const hudWindowSpecs = (
  content: HudWindowContents,
): HudWindowSpec[] => [
  spec({ id: "three-health", title: "Status", width: 286, height: 108, anchor: "top-left", content: content.status }),
  spec({ id: "three-compass", title: "Compass", width: 82, height: 82, anchor: "top-center", content: content.compass }),
  spec({ id: "three-buffs", title: "Buffs and debuffs", width: 286, height: 72, anchor: "center-left", content: content.buffs, chrome: "content-only" }),
  spec({ id: "three-hotbar", title: "Hotbar", width: 620, height: 58, anchor: "bottom-center", content: content.hotbar, interactive: true }),
  spec({ id: "three-chat", title: "Chat", width: 300, height: 230, anchor: "bottom-left", content: content.chat, interactive: true, mobile: {
    width: 280,
    height: 190,
    anchor: "center-left",
  } }),
  spec({ id: "three-weapon", title: "Active weapon", width: 230, height: 84, anchor: "bottom-right", content: content.weapon, chrome: "content-only" }),
  spec({ id: "three-party", title: "Party", width: 260, height: 230, anchor: "top-right", content: content.party }),
  spec({ id: "three-telemetry", title: "World status", width: 244, height: 150, anchor: "center-right", content: content.telemetry, defaultVisible: false }),
  spec({ id: "three-contacts", title: "Contacts", width: 260, height: 340, anchor: "center", content: content.contacts, interactive: true, defaultVisible: false }),
  spec({ id: "three-craft", title: "Crafting", width: 390, height: 420, anchor: "center", content: content.craft, interactive: true, defaultVisible: false }),
  spec({ id: "three-stash", title: "Stash", width: 460, height: 420, anchor: "center", content: content.stash, interactive: true, defaultVisible: false }),
];
