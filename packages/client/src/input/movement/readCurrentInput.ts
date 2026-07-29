import type Phaser from "phaser";
import type { MoveInput } from "@dc2d/engine";
import { screenDirToWorld, screenMoveToWorld } from "../controls/cameraRelative.js";
import { withPointerFacing } from "../gameplay/gameplayActions.js";
import { readMoveInput } from "../controls/keys.js";
import type { InputConnection, InputPanels, InputState } from "../controls/state.js";
import { mergeMoveInputs, touchMoveInput, updateLastFacing, type TouchInputState } from "../touch/index.js";
import { getViewOrientation } from "../../render/view/index.js";
import { kidFacingWorld, updateKidFacing } from "../controls/kidMode.js";

export interface CurrentInputRequest {
  readonly scene: Phaser.Scene;
  readonly panels: InputPanels;
  readonly state: InputState;
  readonly conn: InputConnection;
  readonly touch: TouchInputState;
  readonly touchActive: boolean;
  readonly tilePx: number;
}

export function readCurrentInput(request: CurrentInputRequest): MoveInput {
  const { scene, panels, state, conn, touch, touchActive, tilePx } = request;
  if (panels.gameplayBlocked) return { moveX: 0, moveY: 0, jump: false, run: false };
  const keyboardMove = readMoveInput(state, conn);
  if (!touchActive) {
    if (state.kidMode.active) return readKidInput({ scene, state, move: keyboardMove });
    return readPointerInput({ scene, conn, move: keyboardMove, tilePx });
  }
  const merged = mergeMoveInputs(keyboardMove, touchMoveInput(touch));
  updateLastFacing(touch, merged.moveX, merged.moveY);
  const move = screenMoveToWorld(merged, getViewOrientation());
  const facing = screenDirToWorld(touch.lastFacing, getViewOrientation());
  return { ...move, faceX: facing.x, faceY: facing.y };
}

function readKidInput(request: {
  readonly scene: Phaser.Scene;
  readonly state: InputState;
  readonly move: MoveInput;
}): MoveInput {
  const { scene, state, move } = request;
  updateKidFacing(state.kidMode, move);
  const worldMove = screenMoveToWorld(move, getViewOrientation());
  const facing = kidFacingWorld(state.kidMode);
  const pointerBlock = scene.input.activePointer.rightButtonDown();
  return {
    ...worldMove,
    faceX: facing.x,
    faceY: facing.y,
    block: state.keys.B.isDown || pointerBlock,
  };
}

interface PointerInputRequest {
  readonly scene: Phaser.Scene;
  readonly conn: InputConnection;
  readonly move: MoveInput;
  readonly tilePx: number;
}

function readPointerInput({ scene, conn, move, tilePx }: PointerInputRequest): MoveInput {
  const facing = withPointerFacing({ move: screenMoveToWorld(move, getViewOrientation()), scene, conn, tilePx });
  return { ...facing, block: scene.input.activePointer.rightButtonDown() };
}
