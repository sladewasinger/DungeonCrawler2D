// LANE W3 (editor rotation, the user's "north locked" litmus test): rotate-left/
// rotate-right buttons plus a small compass readout for the RIGHT (Phaser) render
// panel, which rotates through the exact same render/view seam the game uses — this
// data grid (left) stays north-fixed on purpose (docs/ASSUMPTIONS.md), so the compass
// is the user's own cross-reference for "what does screen-up currently mean."
//
// Hotkey: "[" (ccw) / "]" (cw). Checked first: the editor previously had ZERO keyboard
// bindings of its own anywhere under scenes/editor (only the DOM canvas's pointer
// events) — any key was safe, brackets were picked to read as an obvious "rotate/cycle"
// affordance and reserve every letter key for a future single-letter brush hotkey.
// Ignored while a text input has focus (fileSection's import name / lightingPanel's
// numeric sliders both use real <input> elements).
import { screenNorthWorldDirection, wrapDegrees } from "../../../render/view/index.js";
import { getViewOrientation } from "../../../render/view/viewState.js";
import type { EditorStore } from "../editorStore.js";
import { button, sectionLabel } from "./domHelpers.js";

function isTextInputFocused(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/** A tiny ring + needle: the needle points toward WORLD NORTH on screen (0 = up,
 * clockwise-positive) — same bearing convention as the game's HUD CompassWidget
 * (scenes/dungeon/compassBearing.ts), computed inline since the editor never tweens. */
function buildCompassRing(): { el: HTMLDivElement; sync: () => void } {
  const el = document.createElement("div");
  el.style.cssText =
    "position:relative;width:32px;height:32px;border:1px solid #494956;border-radius:50%;flex:0 0 auto";
  const needle = document.createElement("div");
  needle.style.cssText =
    "position:absolute;left:50%;top:50%;width:2px;height:13px;background:#e04a4a;transform-origin:50% 100%";
  el.append(needle);
  const sync = (): void => {
    const bearingDeg = wrapDegrees(-getViewOrientation());
    needle.style.transform = `translate(-50%,-100%) rotate(${bearingDeg}deg)`;
  };
  return { el, sync };
}

function readoutText(): string {
  const orientation = getViewOrientation();
  return `${orientation}° · screen-up = world-${screenNorthWorldDirection(orientation)}`;
}

export function buildViewSection(store: EditorStore): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:8px 0";
  wrap.append(sectionLabel("VIEW (render panel)"));
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;align-items:center;gap:8px";
  const readout = document.createElement("div");
  readout.style.cssText = "font:11px monospace;color:#8f8fa3;margin-top:2px";
  const compass = buildCompassRing();

  const sync = (): void => {
    compass.sync();
    readout.textContent = readoutText();
  };
  const rotate = (dir: 1 | -1): void => {
    store.rotateView(dir);
    sync();
  };

  bar.append(button("⟲ rotate", () => rotate(-1)), compass.el, button("⟳ rotate", () => rotate(1)));
  wrap.append(bar, readout);
  sync();

  document.addEventListener("keydown", (ev) => {
    if (isTextInputFocused()) return;
    if (ev.key === "[") rotate(-1);
    else if (ev.key === "]") rotate(1);
  });
  return wrap;
}
