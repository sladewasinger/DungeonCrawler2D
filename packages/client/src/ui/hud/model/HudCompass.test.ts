import { stairwayDownPosition, World } from "@dc2d/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compassCoordinates,
  resolveCompassState,
  stairwayTickCoordinates,
  HudCompass,
} from "./HudCompass.js";
import { hudWindowSpecs } from "./HudWindowSpecs.js";

interface FakeElement {
  clientWidth: number;
  clientHeight: number;
  dataset: Record<string, string>;
  style: Record<string, string>;
  textContent: string;
  children: FakeElement[];
  attributes: Record<string, string>;
  append(...children: FakeElement[]): void;
  setAttribute(name: string, value: string): void;
}

const fakeElement = (): FakeElement => ({
  clientWidth: 116,
  clientHeight: 116,
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
  adminDebug: {} as HTMLElement,
});

describe("shared HTML HUD compass", () => {
  it("rotates world north through the dial when the camera bearing changes", () => {
    expect(compassCoordinates(0, 0)).toEqual({ x: 0, y: -21 });
    expect(compassCoordinates(270, 0)).toEqual({ x: -21, y: 0 });
    expect(compassCoordinates(90, 0, 116)).toEqual({ x: 50, y: 0 });
  });

  it("keeps the stairway tick on its own reported screen bearing", () => {
    expect(stairwayTickCoordinates(90)).toEqual({ x: 27, y: 0 });
    expect(stairwayTickCoordinates(180)).toEqual({ x: 0, y: 27 });
  });

  it("uses camera-forward compass signs and a live stairway tick in renderer-neutral", () => {
    const world = new World(228182761, 1);
    const stairs = stairwayDownPosition(world);
    if (!stairs) throw new Error("expected a floor-one stairway");

    const compass = resolveCompassState({
      world,
      player: { x: stairs.x, z: stairs.y + 12 },
      yaw: -Math.PI / 2,
    });

    expect(compass.bearingDeg).toBe(90);
    expect(compass.stairway).toEqual({ screenBearingDeg: 90, near: false });
  });

  it("updates the visible HTML dial and gold stairway marker", () => {
    vi.stubGlobal("document", { createElement: fakeElement });
    const compass = new HudCompass();

    compass.update({ bearingDeg: 90, stairway: { screenBearingDeg: 180, near: true } });

    const root = compass.element as unknown as FakeElement;
    const dial = root.children[0];
    if (!dial) throw new Error("missing compass dial");
    const north = dial.children[1];
    if (!north) throw new Error("missing north marker");
    const stairway = dial.children[5];
    expect(north.style.marginLeft).toBe("50px");
    expect(north.style.marginTop).toBe("0px");
    expect(stairway).toMatchObject({
      style: {
        display: "block",
        marginLeft: "0px",
        marginTop: "27px",
        scale: "1.35",
      },
    });
    expect(root.attributes["aria-label"]).toBe("Minimap 90 degrees");
  });

  it("projects blue safe-room and red mini-boss markers independently", () => {
    vi.stubGlobal("document", { createElement: fakeElement });
    const compass = new HudCompass();

    compass.update({
      bearingDeg: 0,
      stairway: null,
      landmarks: {
        safeRoom: { screenBearingDeg: 90 },
        miniBossArena: { screenBearingDeg: 180 },
      },
    });

    const dial = (compass.element as unknown as FakeElement).children[0];
    if (!dial) throw new Error("missing compass dial");
    const safeRoom = dial.children[6];
    const miniBoss = dial.children[7];
    expect(safeRoom?.style).toMatchObject({ display: "block", marginLeft: "27px", marginTop: "0px" });
    expect(miniBoss?.style).toMatchObject({ display: "block", marginLeft: "0px", marginTop: "27px" });
  });

  it("registers a visible compass window even when an older stored layout has no entry", () => {
    const compass = hudWindowSpecs(contents()).find((window) => window.id === "three-compass");
    expect(compass).toMatchObject({
      id: "three-compass",
      title: "Minimap",
      anchor: "top-center",
      defaultVisible: true,
    });
    const telemetry = hudWindowSpecs(contents()).find((window) => window.id === "three-telemetry");
    expect(telemetry?.anchor).toBe("center-right");
  });
});
