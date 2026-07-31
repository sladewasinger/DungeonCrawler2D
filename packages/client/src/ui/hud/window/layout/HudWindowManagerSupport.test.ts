import { describe, expect, it } from "vitest";
import type { HudWindowSpec } from "./HudWindowLayout.js";
import {
  resolveManagedHudWindowLayout,
  resolveRenderedHudWindowGeometry,
} from "./HudWindowManagerSupport.js";
import type { HudWindowLayout } from "./hudWindowStorage.js";

const spec = (defaultVisible: boolean): HudWindowSpec => ({
  id: "three-telemetry",
  title: "World status",
  width: 244,
  height: 150,
  anchor: "center-right",
  content: {} as HTMLElement,
  defaultVisible,
});

const storedLayout = (visible: boolean): HudWindowLayout => ({
  anchor: "free",
  xRatio: 0.25,
  yRatio: 0.75,
  widthRatio: 0.3,
  heightRatio: 0.2,
  z: 19,
  visible,
});

const resolve = (
  windowSpec: HudWindowSpec,
  stored: HudWindowLayout | undefined,
): HudWindowLayout => resolveManagedHudWindowLayout({
  spec: windowSpec,
  mobile: false,
  stored,
  z: 10,
  viewport: { width: 1280, height: 720 },
  scale: 1,
});

describe("managed HUD window visibility", () => {
  it("uses the catalog visibility when no preference exists", () => {
    expect(resolve(spec(false), undefined).visible).toBe(false);
  });

  it.each([false, true])(
    "preserves persisted visibility=%s and geometry",
    (visible) => {
      const stored = storedLayout(visible);
      expect(resolve(spec(false), stored)).toEqual(stored);
    },
  );
});

describe("managed HUD intrinsic geometry", () => {
  it("anchors against the rendered intrinsic height instead of the requested height", () => {
    const element = {
      getBoundingClientRect: () => ({ width: 280, height: 120 }),
    } as unknown as HTMLElement;
    const layout = { ...storedLayout(true), anchor: "bottom-right" as const };

    expect(resolveRenderedHudWindowGeometry({
      element,
      requestedSize: { width: 280, height: 20 },
      layout,
      viewport: { width: 320, height: 200 },
    })).toEqual({
      size: { width: 280, height: 120 },
      position: { x: 24, y: 64 },
    });
  });
});
