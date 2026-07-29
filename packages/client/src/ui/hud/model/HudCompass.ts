import type { World } from "@dc2d/engine";
import { resolveStairwayTick } from "../../../scenes/dungeon/world/stairwayTick.js";
import { HUD_MUTED } from "../styles/HudStyles.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";
import type { StairwayTickData } from "../../../ui/widgets/hud/core/fakeData.js";
import type { HudFakeSnapshot } from "../../../ui/widgets/hud/core/fakeData.js";
import type { FirstPersonState } from "../../../three/input/movement.js";
import { headingDegrees } from "./HudTelemetry.js";

const CARDINALS = [
  { label: "N", offset: 0, color: "#e04a4a" },
  { label: "E", offset: 90, color: HUD_MUTED },
  { label: "S", offset: 180, color: HUD_MUTED },
  { label: "W", offset: 270, color: HUD_MUTED },
] as const;

const LETTER_RADIUS = 22;
const STAIRWAY_RADIUS = 27;

export interface CompassState {
  bearingDeg: number;
  stairway: StairwayTickData | null;
}

export interface CompassStateRequest {
  readonly world: World;
  readonly player: Pick<FirstPersonState, "x" | "z">;
  readonly yaw: number;
  readonly snapshot?: Pick<HudFakeSnapshot, "compassBearingDeg" | "stairway"> | undefined;
}

export const resolveCompassState = ({ world, player, yaw, snapshot }: CompassStateRequest): CompassState => {
  const bearingDeg = snapshot?.compassBearingDeg ?? headingDegrees(yaw);
  return {
    bearingDeg,
    stairway: snapshot?.stairway ?? resolveStairwayTick({ world, x: player.x, y: player.z, viewBearingDeg: bearingDeg }),
  };
};

const rounded = (value: number): number => {
  const result = Math.round(value);
  return Object.is(result, -0) ? 0 : result;
};

export const compassCoordinates = (bearingDeg: number, offsetDeg: number) => {
  const radians = ((bearingDeg + offsetDeg) * Math.PI) / 180;
  return {
    x: rounded(Math.sin(radians) * LETTER_RADIUS),
    y: rounded(-Math.cos(radians) * LETTER_RADIUS),
  };
};

export const stairwayTickCoordinates = (bearingDeg: number) => {
  const radians = (bearingDeg * Math.PI) / 180;
  return {
    x: rounded(Math.sin(radians) * STAIRWAY_RADIUS),
    y: rounded(-Math.cos(radians) * STAIRWAY_RADIUS),
  };
};

export class HudCompass {
  readonly element: HTMLElement;
  private readonly letters: Array<typeof CARDINALS[number] & { element: HTMLElement }>;
  private readonly stairway: HTMLElement;

  constructor() {
    this.element = createHudTemplate<HTMLElement>("hud-compass-template");
    this.letters = CARDINALS.map((cardinal) => ({
      ...cardinal,
      element: requireHudElement<HTMLElement>(
        this.element,
        `[data-compass-letter="${cardinal.label}"]`,
      ),
    }));
    this.stairway = requireHudElement(this.element, "[data-hud-compass-stairway]");
    this.update(0);
  }

  update(bearingDeg: number, stairway: StairwayTickData | null = null): void {
    const normalized = ((bearingDeg % 360) + 360) % 360;
    for (const letter of this.letters) {
      const point = compassCoordinates(normalized, letter.offset);
      letter.element.style.marginLeft = `${point.x}px`;
      letter.element.style.marginTop = `${point.y}px`;
    }
    this.stairway.style.display = stairway ? "block" : "none";
    if (stairway) {
      const point = stairwayTickCoordinates(stairway.screenBearingDeg);
      this.stairway.style.marginLeft = `${point.x}px`;
      this.stairway.style.marginTop = `${point.y}px`;
      this.stairway.style.scale = stairway.near ? "1.35" : "1";
    }
    this.element.setAttribute("aria-label", `Compass ${Math.round(normalized)} degrees`);
  }
}
