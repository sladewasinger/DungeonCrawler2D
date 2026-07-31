/** Defines the shared HTML HUD window catalog independently from its runtime facade. */
import type { HudWindowSpec } from "../window/layout/HudWindows.js";
import type { HudWindowChrome } from "../window/layout/HudWindowLayout.js";

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
  | "aspectRatio" | "minWidth" | "minHeight" | "intrinsicMinHeight"
>;

const CONTENT_ONLY: HudWindowChrome = "content-only";

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
  ...constraints
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
  ...windowConstraints(constraints),
});

type WindowConstraints = Pick<
  HudWindowSpec,
  "aspectRatio" | "minWidth" | "minHeight" | "intrinsicMinHeight"
>;

const windowConstraints = ({
  aspectRatio,
  minWidth,
  minHeight,
  intrinsicMinHeight,
}: WindowConstraints): WindowConstraints => ({
  ...(aspectRatio ? { aspectRatio } : {}),
  ...(minWidth ? { minWidth } : {}),
  ...(minHeight ? { minHeight } : {}),
  ...(intrinsicMinHeight ? { intrinsicMinHeight } : {}),
});

export const hudWindowSpecs = (
  content: HudWindowContents,
): HudWindowSpec[] => [
  spec({ id: "three-health", title: "Status", width: 286, height: 126, anchor: "top-left", content: content.status, intrinsicMinHeight: true }),
  spec({ id: "three-compass", title: "Minimap", width: 190, height: 190, anchor: "top-center", content: content.compass, aspectRatio: 1, chrome: CONTENT_ONLY }),
  spec({ id: "three-buffs", title: "Buffs and debuffs", width: 286, height: 72, anchor: "center-left", content: content.buffs, chrome: CONTENT_ONLY }),
  spec({ id: "three-hotbar", title: "Hotbar", width: 620, height: 58, anchor: "bottom-center", content: content.hotbar, interactive: true }),
  spec({ id: "three-chat", title: "Chat", width: 300, height: 230, anchor: "bottom-left", content: content.chat, interactive: true, mobile: {
    width: 280,
    height: 190,
    anchor: "center-left",
  } }),
  spec({ id: "three-weapon", title: "Active weapon", width: 230, height: 84, anchor: "bottom-right", content: content.weapon, chrome: CONTENT_ONLY }),
  spec({ id: "three-party", title: "Party", width: 260, height: 230, anchor: "top-right", content: content.party }),
  spec({ id: "three-telemetry", title: "World status", width: 244, height: 150, anchor: "center-right", content: content.telemetry, defaultVisible: false }),
  spec({ id: "three-contacts", title: "Contacts", width: 260, height: 340, anchor: "center", content: content.contacts, interactive: true, defaultVisible: false }),
  spec({ id: "three-craft", title: "Crafting", width: 390, height: 420, anchor: "center", content: content.craft, interactive: true, defaultVisible: false }),
  spec({ id: "three-stash", title: "Stash", width: 460, height: 420, anchor: "center", content: content.stash, interactive: true, defaultVisible: false }),
];
