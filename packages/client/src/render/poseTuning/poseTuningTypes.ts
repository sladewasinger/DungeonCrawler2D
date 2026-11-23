/** Types and 8-direction vector metadata for configurable character arm & gear poses. */
export type BodyKind = "female" | "male";

export const DIR8_LABELS = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"] as const;

export const DIR8_VECTORS: readonly { readonly x: number; readonly y: number }[] = [
  { x: 0, y: 1 },
  { x: 0.7071, y: 0.7071 },
  { x: 1, y: 0 },
  { x: 0.7071, y: -0.7071 },
  { x: 0, y: -1 },
  { x: -0.7071, y: -0.7071 },
  { x: -1, y: 0 },
  { x: -0.7071, y: 0.7071 },
];

export interface FreeArmDirTune {
  sxOff: number;
  syOff: number;
  txOff: number;
  tyOff: number;
  maxBendRad: number;
  bendSign: -1 | 0 | 1;
  upperBehind: boolean;
  foreBehind: boolean;
  handBehind: boolean;
  shaded: boolean;
  taper: boolean;
}

export interface RightCarryDirTune {
  x: number;
  y: number;
  rot: number;
  behind: boolean;
  rotSign: -1 | 1;
  scaleSign: -1 | 1;
  armBehind: boolean;
  armShaded: boolean;
  armTaper: boolean;
  maxBendRad: number;
}

export interface LeftCarryDirTune {
  x: number;
  y: number;
  rot: number;
  behind: boolean;
  armBehind: boolean;
  armShaded: boolean;
  armTaper: boolean;
  maxBendRad: number;
}

export interface BowAimDirTune {
  radiusX: number;
  centerY: number;
  radiusY: number;
  offsetX: number;
  offsetY: number;
  drawPull: number;
  behindBody: boolean;
  bowArmBehind: boolean;
  drawArmBehind: boolean;
  drawArmOverWeapon: boolean;
  gripMaxBendRad: number;
  drawMaxBendRad: number;
}

export interface BodyPoseTuning {
  freeLeft: FreeArmDirTune[];
  freeRight: FreeArmDirTune[];
  sword: RightCarryDirTune[];
  lantern: LeftCarryDirTune[];
  bow: BowAimDirTune[];
}

export interface PlayerPoseTuning {
  version: 1;
  female: BodyPoseTuning;
  male: BodyPoseTuning;
}
