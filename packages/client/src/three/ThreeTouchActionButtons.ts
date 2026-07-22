/** Owns touch action button presentation and pointer/click fallback behavior. */
const idleStyle = "rgba(28,29,45,.78)";
const pressedStyle = "rgba(128,143,196,.92)";

export const createTouchButton = (label: string, bottom: number, right: number) => {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.style.cssText = `position:absolute;right:${right}px;bottom:${bottom}px;width:58px;height:58px;border-radius:50%;border:1px solid #8a8fa9;background:${idleStyle};color:#f4f1e9;font:11px monospace;touch-action:none;transition:background .08s,border-color .08s,transform .08s`;
  return element;
};

export const setTouchButtonPressed = (element: HTMLButtonElement, pressed: boolean): void => {
  element.style.background = pressed ? pressedStyle : idleStyle;
  element.style.borderColor = pressed ? "#f4f1e9" : "#8a8fa9";
  element.style.transform = pressed ? "scale(.94)" : "";
};

export const bindTouchActionButton = (element: HTMLButtonElement, trigger: () => void): void => {
  const release = () => setTouchButtonPressed(element, false);
  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setTouchButtonPressed(element, true);
    trigger();
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  element.addEventListener("lostpointercapture", release);
};

export const bindTouchJumpButton = (element: HTMLButtonElement, press: () => void, setHeld: (held: boolean) => void): void => {
  let lastPointerDown = 0;
  const release = () => {
    setHeld(false);
    setTouchButtonPressed(element, false);
  };
  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    lastPointerDown = performance.now();
    setTouchButtonPressed(element, true);
    setHeld(true);
    press();
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  element.addEventListener("lostpointercapture", () => setTouchButtonPressed(element, false));
  element.addEventListener("click", () => {
    if (performance.now() - lastPointerDown > 700) press();
  });
};
