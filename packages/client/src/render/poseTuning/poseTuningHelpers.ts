/** Pure pose-tuning lookup helpers used by PlayerArmIk and held gear layout. */
import type { CharacterPose, FacingDir } from "../character/characterTypes.js";
import type { ShoulderSocket } from "../character/playerAssets.js";
import { getPoseTuning } from "./poseTuningStore.js";
import type { BowAimDirTune, FreeArmDirTune, LeftCarryDirTune, RightCarryDirTune } from "./poseTuningTypes.js";

const DEFAULT_FREE: FreeArmDirTune = {
  sxOff: 0, syOff: 0, txOff: 0, tyOff: 6, maxBendRad: 0.22, bendSign: 0,
  upperBehind: false, foreBehind: false, handBehind: false, shaded: false, taper: false,
};

const DEFAULT_SWORD: RightCarryDirTune = {
  x: -4.1, y: -8.3, rot: 0.92, behind: false, rotSign: -1, scaleSign: -1,
  armBehind: false, armShaded: false, armTaper: false, maxBendRad: 0.22,
};

const DEFAULT_LANTERN: LeftCarryDirTune = {
  x: 4.1, y: -8.3, rot: 0, behind: false, armBehind: false, armShaded: false, armTaper: false, maxBendRad: 0.22,
};

const DEFAULT_BOW: BowAimDirTune = {
  radiusX: 6.8, centerY: -12.8, radiusY: 4.8, offsetX: 0, offsetY: 0, drawPull: 4.2,
  behindBody: false, bowArmBehind: true, drawArmBehind: false, drawArmOverWeapon: true, gripMaxBendRad: 0.22, drawMaxBendRad: 0.58,
};

export interface TunedFreeArmResult {
  readonly socket: ShoulderSocket;
  readonly target: { readonly x: number; readonly y: number };
  readonly upperBehind: boolean;
  readonly behindBody: boolean;
  readonly handBehind: boolean;
  readonly shaded: boolean;
  readonly taper: boolean;
  readonly maxBendRad: number;
  readonly bendSign: -1 | 0 | 1;
}

function shiftSocket(socket: ShoulderSocket, dx: number, dy: number): ShoulderSocket {
  return dx === 0 && dy === 0 ? socket : { ...socket, x: socket.x + dx, y: socket.y + dy };
}

function packFreeArm(socket: ShoulderSocket, target: { readonly x: number; readonly y: number }, t: FreeArmDirTune): TunedFreeArmResult {
  return {
    socket, target, upperBehind: t.upperBehind, behindBody: t.foreBehind, handBehind: t.handBehind,
    shaded: t.shaded, taper: t.taper, maxBendRad: t.maxBendRad, bendSign: t.bendSign,
  };
}

export function computeTunedFreeArm(opts: {
  readonly socket: ShoulderSocket; readonly dir: FacingDir; readonly yawIdx: number;
  readonly pose: CharacterPose; readonly isRight: boolean; readonly body?: string | undefined;
}): TunedFreeArmResult {
  const { socket, dir, yawIdx, pose, isRight, body } = opts;
  const sideArr = isRight ? getPoseTuning(body).freeRight : getPoseTuning(body).freeLeft;
  const t = sideArr[yawIdx] ?? DEFAULT_FREE;
  const swingDir = isRight ? 1 : -1;
  if (dir === "north" || dir === "south") {
    const outSign = Math.sign(socket.x) || -swingDir;
    const adjSocket = shiftSocket(socket, outSign * t.sxOff, t.syOff);
    const target = { x: socket.x + outSign * t.txOff, y: socket.y + t.tyOff + pose.armSwing * swingDir * 0.25 };
    return packFreeArm(adjSocket, target, t);
  }
  const adjSocket = shiftSocket(socket, t.sxOff, t.syOff);
  const target = { x: socket.x + t.txOff + pose.armSwing * swingDir * 0.9, y: socket.y + t.tyOff };
  return packFreeArm(adjSocket, target, t);
}

export function getTunedSwordArm(yawIdx: number, body?: string): RightCarryDirTune {
  const arr = getPoseTuning(body).sword;
  return arr[yawIdx] ?? arr[0] ?? DEFAULT_SWORD;
}

export function getTunedLanternArm(yawIdx: number, body?: string): LeftCarryDirTune {
  const arr = getPoseTuning(body).lantern;
  return arr[yawIdx] ?? arr[0] ?? DEFAULT_LANTERN;
}

export function getTunedBowConfig(yawIdx: number, body?: string): BowAimDirTune {
  const arr = getPoseTuning(body).bow;
  return arr[yawIdx] ?? arr[0] ?? DEFAULT_BOW;
}
