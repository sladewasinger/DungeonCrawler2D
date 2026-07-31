import type { World } from "@dc2d/engine";
import { resolveStairwayTick } from "../../../scenes/dungeon/world/stairwayTick.js";
import { resolveCompassLandmarks } from "../../../scenes/dungeon/world/landmarks/compassLandmarks.js";
import { HUD_MUTED } from "../styles/HudStyles.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";
import type {
  CompassLandmarkTicks,
  HudFakeSnapshot,
  StairwayTickData,
} from "../../../ui/widgets/hud/core/fakeData.js";
import type { FirstPersonState } from "../../../three/input/movement.js";
import { headingDegrees } from "./HudTelemetry.js";
import {
  MinimapCanvasRenderer,
  minimapRenderedSize,
} from "./minimap/minimapCanvasRenderer.js";
import type { MinimapSnapshot } from "./minimap/minimapTypes.js";
import {
  updateCardinalLetters,
  updateCompassMarkers,
  type CompassLetterElement,
  type CompassMarkerElements,
} from "./minimap/HudCompassMarkers.js";

const CARDINALS = [
  { label: "N", offset: 0, color: "#e04a4a" },
  { label: "E", offset: 90, color: HUD_MUTED },
  { label: "S", offset: 180, color: HUD_MUTED },
  { label: "W", offset: 270, color: HUD_MUTED },
] as const;
const EMPTY_LANDMARKS: CompassLandmarkTicks = { safeRoom: null, miniBossArena: null };

export { compassCoordinates, stairwayTickCoordinates } from "./minimap/HudCompassGeometry.js";

export interface CompassState {
  bearingDeg: number;
  stairway: StairwayTickData | null;
  landmarks: CompassLandmarkTicks;
}

export interface CompassStateRequest {
  readonly world: World;
  readonly player: Pick<FirstPersonState, "x" | "z">;
  readonly yaw: number;
  readonly snapshot?: Pick<HudFakeSnapshot, "compassBearingDeg" | "stairway" | "compassLandmarks"> | undefined;
}

export interface HudCompassUpdate {
  readonly bearingDeg: number;
  readonly stairway?: StairwayTickData | null;
  readonly landmarks?: CompassLandmarkTicks;
  readonly minimap?: MinimapSnapshot;
}

export const resolveCompassState = ({ world, player, yaw, snapshot }: CompassStateRequest): CompassState => {
  const bearingDeg = snapshot?.compassBearingDeg ?? headingDegrees(yaw);
  return {
    bearingDeg,
    stairway: snapshot?.stairway ?? resolveStairwayTick({ world, x: player.x, y: player.z, viewBearingDeg: bearingDeg }),
    landmarks: snapshot?.compassLandmarks ?? resolveCompassLandmarks({ world, x: player.x, y: player.z, viewBearingDeg: bearingDeg }),
  };
};

export class HudCompass {
  readonly element: HTMLElement;
  private readonly letters: Array<typeof CARDINALS[number] & CompassLetterElement>;
  private readonly stairway: HTMLElement;
  private readonly safeRoom: HTMLElement;
  private readonly miniBossArena: HTMLElement;
  private readonly minimap: HTMLCanvasElement;
  private readonly minimapContext: CanvasRenderingContext2D | null;
  private readonly renderer = new MinimapCanvasRenderer();

  constructor() {
    this.element = createHudTemplate<HTMLElement>("hud-compass-template");
    this.letters = CARDINALS.map((cardinal) => ({
      ...cardinal,
      element: requireHudElement<HTMLElement>(this.element, `[data-compass-letter="${cardinal.label}"]`),
    }));
    this.stairway = requireHudElement(this.element, "[data-hud-compass-stairway]");
    this.safeRoom = requireHudElement(this.element, "[data-hud-compass-safe-room]");
    this.miniBossArena = requireHudElement(this.element, "[data-hud-compass-mini-boss]");
    this.minimap = requireHudElement(this.element, "[data-hud-minimap-canvas]");
    this.minimapContext = this.minimap.getContext?.("2d") ?? null;
    this.update({ bearingDeg: 0 });
  }

  update({ bearingDeg, stairway = null, landmarks = EMPTY_LANDMARKS, minimap }: HudCompassUpdate): void {
    const normalized = normalizeBearing(bearingDeg);
    updateCardinalLetters(
      this.letters,
      normalized,
      minimapRenderedSize(this.minimap),
    );
    updateCompassMarkers({ stairway, landmarks, elements: this.markerElements() }, Boolean(minimap));
    this.renderer.render({
      canvas: this.minimap,
      context: this.minimapContext,
      bearingDeg: normalized,
      ...(minimap ? { snapshot: minimap } : {}),
    });
    this.element.setAttribute("aria-label", `Minimap ${Math.round(normalized)} degrees`);
  }

  private markerElements(): CompassMarkerElements {
    return { stairway: this.stairway, safeRoom: this.safeRoom, miniBossArena: this.miniBossArena };
  }
}

const normalizeBearing = (bearingDeg: number): number => ((bearingDeg % 360) + 360) % 360;
