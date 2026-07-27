import type { World } from "@dc2d/engine";
import { resolveStairwayTick } from "../../../scenes/dungeon/world/stairwayTick.js";
import { HUD_MUTED } from "../styles/ThreeHudStyles.js";
import type { StairwayTickData } from "../../../ui/widgets/hud/core/fakeData.js";
import type { HudFakeSnapshot } from "../../../ui/widgets/hud/core/fakeData.js";
import type { FirstPersonState } from "../../input/movement.js";
import { headingDegrees } from "./ThreeHudTelemetry.js";

const CARDINALS = [
  { label: "N", offset: 0, color: "#e04a4a" },
  { label: "E", offset: 90, color: HUD_MUTED },
  { label: "S", offset: 180, color: HUD_MUTED },
  { label: "W", offset: 270, color: HUD_MUTED },
] as const;

const LETTER_RADIUS = 22;
const STAIRWAY_RADIUS = 27;

export interface ThreeCompassState {
  bearingDeg: number;
  stairway: StairwayTickData | null;
}

export interface ThreeCompassStateRequest {
  readonly world: World;
  readonly player: Pick<FirstPersonState, "x" | "z">;
  readonly yaw: number;
  readonly snapshot?: Pick<HudFakeSnapshot, "compassBearingDeg" | "stairway"> | undefined;
}

export const resolveThreeCompassState = ({ world, player, yaw, snapshot }: ThreeCompassStateRequest): ThreeCompassState => {
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

export class ThreeHudCompass {
  readonly element = document.createElement("div");
  private readonly letters = CARDINALS.map((cardinal) => ({
    ...cardinal,
    element: document.createElement("span"),
  }));
  private readonly stairway = document.createElement("span");

  constructor() {
    this.element.dataset.compass = "true";
    this.element.setAttribute("role", "img");
    this.element.style.cssText =
      "display:grid;place-items:center;padding:6px;background:transparent;border:0";
    const dial = this.createDial();
    this.element.append(dial);
    this.update(0);
  }

  private createDial(): HTMLDivElement {
    const dial = document.createElement("div");
    dial.style.cssText =
      "position:relative;width:58px;height:58px;border:2px solid #5f637c;border-radius:50%;box-sizing:border-box";
    const forward = document.createElement("span");
    forward.textContent = "▲";
    forward.style.cssText =
      "position:absolute;left:50%;top:-10px;translate:-50% 0;color:#c4c6d3;font:10px monospace";
    dial.append(forward);
    for (const letter of this.letters) {
      letter.element.textContent = letter.label;
      letter.element.style.cssText =
        `position:absolute;left:50%;top:50%;translate:-50% -50%;color:${letter.color};font:13px monospace;font-weight:700`;
      dial.append(letter.element);
    }
    this.stairway.textContent = "◆";
    this.stairway.style.cssText =
      "position:absolute;left:50%;top:50%;translate:-50% -50%;color:#ffd54c;font:10px monospace;display:none";
    dial.append(this.stairway);
    return dial;
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
