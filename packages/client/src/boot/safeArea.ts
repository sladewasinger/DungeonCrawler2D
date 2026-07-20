// Reads the notch/gesture-bar safe-area insets (index.html's viewport-fit=cover makes
// env(safe-area-inset-*) resolve to real values instead of 0) as numeric pixels, for
// canvas-rendered UI that can't use CSS env() directly. HUD placement itself is out of
// this lane's ownership (ui/widgets/hud/**) — this is the plumbing another lane wires
// its edge padding through.
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Forces layout of a zero-size probe element styled with each env() inset as padding, then reads the resolved pixel values back off it — the only way to get env() as a number rather than a CSS string. */
export function readSafeAreaInsets(doc: Document = document): SafeAreaInsets {
  const probe = doc.createElement("div");
  Object.assign(probe.style, {
    position: "fixed",
    inset: "0",
    visibility: "hidden",
    pointerEvents: "none",
    paddingTop: "env(safe-area-inset-top, 0px)",
    paddingRight: "env(safe-area-inset-right, 0px)",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    paddingLeft: "env(safe-area-inset-left, 0px)",
  });
  doc.body.append(probe);
  const style = getComputedStyle(probe);
  const insets: SafeAreaInsets = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}
