import { stairwayDownPosition, World } from "@dc2d/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compassCoordinates,
  resolveThreeCompassState,
  stairwayTickCoordinates,
  ThreeHudCompass,
} from "./ThreeHudCompass.js";
import { threeHudWindowSpecs } from "./ThreeHudWindowSpecs.js";

interface FakeElement {
  dataset: Record<string, string>;
  style: Record<string, string>;
  textContent: string;
  children: FakeElement[];
  attributes: Record<string, string>;
  append(...children: FakeElement[]): void;
  setAttribute(name: string, value: string): void;
}

const fakeElement = (): FakeElement => ({
  dataset: {},
  style: {},
  textContent: "",
  children: [],
  attributes: {},
  append(...children: FakeElement[]) {
    this.children.push(...children);
  },
  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  },
});

afterEach(() => vi.unstubAllGlobals());

const contents = () => ({
  status: {} as HTMLElement,
  compass: {} as HTMLElement,
  buffs: {} as HTMLElement,
  hotbar: {} as HTMLElement,
  chat: {} as HTMLElement,
  weapon: {} as HTMLElement,
  party: {} as HTMLElement,
  telemetry: {} as HTMLElement,
  contacts: {} as HTMLElement,
  craft: {} as HTMLElement,
  stash: {} as HTMLElement,
});

describe("shared HTML HUD compass", () => {
  it("rotates world north through the dial when the camera bearing changes", () => {
    expect(compassCoordinates(0, 0)).toEqual({ x: 0, y: -22 });
    expect(compassCoordinates(270, 0)).toEqual({ x: -22, y: 0 });
  });

  it("keeps the stairway tick on its own reported screen bearing", () => {
    expect(stairwayTickCoordinates(90)).toEqual({ x: 27, y: 0 });
    expect(stairwayTickCoordinates(180)).toEqual({ x: 0, y: 27 });
  });

  it("uses camera-forward compass signs and a live stairway tick in native Three", () => {
    const world = new World(228182761, 1);
    const stairs = stairwayDownPosition(world);
    if (!stairs) throw new Error("expected a floor-one stairway");

    const compass = resolveThreeCompassState(
      world,
      { x: stairs.x, z: stairs.y + 12 },
      -Math.PI / 2,
    );

    expect(compass.bearingDeg).toBe(90);
    expect(compass.stairway).toEqual({ screenBearingDeg: 90, near: false });
  });

  it("updates the visible HTML dial and gold stairway marker", () => {
    vi.stubGlobal("document", { createElement: fakeElement });
    const compass = new ThreeHudCompass();

    compass.update(90, { screenBearingDeg: 180, near: true });

    const root = compass.element as unknown as FakeElement;
    const dial = root.children[0];
    if (!dial) throw new Error("missing compass dial");
    const north = dial.children[1];
    if (!north) throw new Error("missing north marker");
    const stairway = dial.children.at(-1);
    expect(north.style.marginLeft).toBe("22px");
    expect(north.style.marginTop).toBe("0px");
    expect(stairway).toMatchObject({
      style: {
        display: "block",
        marginLeft: "0px",
        marginTop: "27px",
        scale: "1.35",
      },
    });
    expect(root.attributes["aria-label"]).toBe("Compass 90 degrees");
  });

  it("registers a visible compass window even when an older stored layout has no entry", () => {
    const compass = threeHudWindowSpecs(contents()).find((window) => window.id === "three-compass");
    expect(compass).toMatchObject({
      id: "three-compass",
      title: "Compass",
      anchor: "top-center",
      defaultVisible: true,
    });
    const telemetry = threeHudWindowSpecs(contents()).find((window) => window.id === "three-telemetry");
    expect(telemetry?.anchor).toBe("center-right");
  });
});
