interface InteractKey {
  on(event: "down" | "up", listener: () => void): void;
}

export function bindInteractKey(
  key: InteractKey,
  press: () => void,
  release: () => void,
): void {
  let held = false;
  key.on("down", () => {
    if (held) return;
    held = true;
    press();
  });
  key.on("up", () => {
    if (!held) return;
    held = false;
    release();
  });
}
