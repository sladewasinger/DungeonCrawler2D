/** Keyboard chord setup and per-tick movement sampling — pure over InputState. */
import type Phaser from "phaser";
import type { MoveInput } from "@dc2d/engine";
import { isTypingInInput, type InputConnection, type InputState, type Keys } from "./state.js";

/** Binds the fixed key chord this game listens to; called once at construction. */
export function createKeys(scene: Phaser.Scene): {
  keys: Keys;
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
} {
  const keyboard = scene.input.keyboard;
  if (!keyboard) throw new Error("scene has no keyboard plugin");
  const cursors = keyboard.createCursorKeys();
  const keys = keyboard.addKeys("W,A,S,D,B,N,SPACE,G,E,R,C,F,ESC,SHIFT,I,TAB,ENTER,O") as unknown as Keys;
  return { keys, cursors };
}

/** True when either the arrow-cursor key or its WASD equivalent is held. */
function eitherDown(cursorKey: Phaser.Input.Keyboard.Key, gameKey: Phaser.Input.Keyboard.Key): boolean {
  return cursorKey.isDown || gameKey.isDown;
}

/** Sampled at the fixed tick rate by the scene to build the server-bound move intent.
 * SHIFT holds run (Epic 7.12) — free to reuse here because it only otherwise fires
 * inside the open stash panel (input/hotbar.ts's Shift+number put), never during
 * ordinary movement. */
export function readMoveInput(state: InputState, conn: InputConnection): MoveInput {
  if (isTypingInInput() || !conn.canAct) return { moveX: 0, moveY: 0, jump: false, run: false };
  const { keys, cursors } = state;
  const direction = readDirection(state);
  return {
    moveX: direction.x,
    moveY: direction.y,
    jump: eitherDown(cursors.space, keys.SPACE),
    run: keys.SHIFT.isDown,
  };
}

function readDirection(state: InputState): { x: number; y: number } {
  const { keys, cursors } = state;
  const allowWasd = !state.kidMode.active;
  const left = directionKeyDown(cursors.left, keys.A, allowWasd);
  const right = directionKeyDown(cursors.right, keys.D, allowWasd);
  const up = directionKeyDown(cursors.up, keys.W, allowWasd);
  const down = directionKeyDown(cursors.down, keys.S, allowWasd);
  return {
    x: Number(right) - Number(left),
    y: Number(down) - Number(up),
  };
}

function directionKeyDown(
  arrow: Phaser.Input.Keyboard.Key,
  wasd: Phaser.Input.Keyboard.Key,
  allowWasd: boolean,
): boolean {
  return arrow.isDown || allowWasd && wasd.isDown;
}
