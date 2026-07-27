/** Builds the touch-sized visual resize affordance shown during HUD edit mode. */
export const createHudWindowResizeGrip = (): HTMLDivElement => {
  const grip = document.createElement("div");
  grip.dataset.hudResizeGrip = "true";
  grip.setAttribute("aria-label", "Resize window");
  grip.style.cssText =
    "position:absolute;right:0;bottom:0;width:44px;height:44px;display:none;" +
    "z-index:2;pointer-events:auto;touch-action:none;cursor:nwse-resize;" +
    "background:linear-gradient(135deg,transparent 48%," +
    "rgba(235,225,180,.82) 49%,rgba(235,225,180,.82) 53%,transparent 54%)," +
    "linear-gradient(135deg,transparent 64%,rgba(235,225,180,.82) 65%," +
    "rgba(235,225,180,.82) 69%,transparent 70%)";
  return grip;
};

export const isHudWindowResizeGrip = (
  target: EventTarget | null,
  grip: HTMLDivElement,
): boolean => target === grip ||
  (target instanceof Element &&
    target.closest("[data-hud-resize-grip='true']") === grip);
