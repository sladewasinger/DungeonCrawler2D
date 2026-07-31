import type { CompassLandmarkTicks, StairwayTickData } from "../../../../ui/widgets/hud/core/fakeData.js";
import { compassCoordinates, stairwayTickCoordinates } from "./HudCompassGeometry.js";

export interface CompassLetterElement {
  readonly offset: number;
  readonly element: HTMLElement;
}

export interface CompassMarkerElements {
  readonly stairway: HTMLElement;
  readonly safeRoom: HTMLElement;
  readonly miniBossArena: HTMLElement;
}

interface CompassMarkerUpdate {
  readonly stairway: StairwayTickData | null;
  readonly landmarks: CompassLandmarkTicks;
  readonly elements: CompassMarkerElements;
}

export const updateCompassMarkers = (
  { stairway, landmarks, elements }: CompassMarkerUpdate,
  hasMinimap: boolean,
): void => {
  if (hasMinimap) {
    hideMarker(elements.stairway);
    hideMarker(elements.safeRoom);
    hideMarker(elements.miniBossArena);
    return;
  }
  updateStairwayMarker(elements.stairway, stairway);
  updateLandmarkMarker(elements.safeRoom, landmarks.safeRoom);
  updateLandmarkMarker(elements.miniBossArena, landmarks.miniBossArena);
};

export const updateCardinalLetters = (
  letters: readonly CompassLetterElement[],
  bearingDeg: number,
  dialDiameter: number,
): void => {
  for (const letter of letters) {
    const point = compassCoordinates(bearingDeg, letter.offset, dialDiameter);
    letter.element.style.marginLeft = `${point.x}px`;
    letter.element.style.marginTop = `${point.y}px`;
  }
};

const updateStairwayMarker = (element: HTMLElement, stairway: StairwayTickData | null): void => {
  element.style.display = stairway ? "block" : "none";
  if (!stairway) return;
  const point = stairwayTickCoordinates(stairway.screenBearingDeg);
  element.style.marginLeft = `${point.x}px`;
  element.style.marginTop = `${point.y}px`;
  element.style.scale = stairway.near ? "1.35" : "1";
};

const updateLandmarkMarker = (
  element: HTMLElement,
  target: CompassLandmarkTicks["safeRoom"],
): void => {
  element.style.display = target ? "block" : "none";
  if (!target) return;
  const point = stairwayTickCoordinates(target.screenBearingDeg);
  element.style.marginLeft = `${point.x}px`;
  element.style.marginTop = `${point.y}px`;
};

const hideMarker = (element: HTMLElement): void => {
  element.style.display = "none";
};
