const LEGACY_DIAL_DIAMETER = 58;
const LETTER_EDGE_INSET = 8;
const STAIRWAY_RADIUS = 27;

const rounded = (value: number): number => {
  const result = Math.round(value);
  return Object.is(result, -0) ? 0 : result;
};

export const compassCoordinates = (
  bearingDeg: number,
  offsetDeg: number,
  dialDiameter = LEGACY_DIAL_DIAMETER,
) => {
  const radians = ((bearingDeg + offsetDeg) * Math.PI) / 180;
  const radius = Math.max(0, dialDiameter / 2 - LETTER_EDGE_INSET);
  return { x: rounded(Math.sin(radians) * radius), y: rounded(-Math.cos(radians) * radius) };
};

export const stairwayTickCoordinates = (bearingDeg: number) => {
  const radians = (bearingDeg * Math.PI) / 180;
  return { x: rounded(Math.sin(radians) * STAIRWAY_RADIUS), y: rounded(-Math.cos(radians) * STAIRWAY_RADIUS) };
};
