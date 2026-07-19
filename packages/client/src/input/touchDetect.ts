/** Detects whether touch controls should mount: real touch hardware, or the
 * ?touch=1 URL override used for desktop testing/screenshots (scripts/screenshot.mjs). */
const TOUCH_QUERY_PARAM = "touch";

export function isTouchDevice(win: Window = window): boolean {
  if (new URLSearchParams(win.location.search).get(TOUCH_QUERY_PARAM) === "1") return true;
  return "ontouchstart" in win || win.navigator.maxTouchPoints > 0;
}
