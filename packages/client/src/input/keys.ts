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
  const keys = keyboard.addKeys("W,A,S,D,SPACE,G,E,R,C,F,ESC,SHIFT") as unknown as Keys;
  return { keys, cursors };
}

/** True when either the arrow-cursor key or its WASD equivalent is held. */
function eitherDown(cursorKey: Phaser.Input.Keyboard.Key, gameKey: Phaser.Input.Keyboard.Key): boolean {
  return cursorKey.isDown || gameKey.isDown;
}

/** Sampled at the fixed tick rate by the scene to build the server-bound move intent. */
export function readMoveInput(state: InputState, conn: InputConnection): MoveInput {
  if (isTypingInInput() || !conn.canAct) return { moveX: 0, moveY: 0, jump: false };
  const { keys, cursors } = state;
  const left = eitherDown(cursors.left, keys.A);
  const right = eitherDown(cursors.right, keys.D);
  const up = eitherDown(cursors.up, keys.W);
  const down = eitherDown(cursors.down, keys.S);
  return {
    moveX: (right ? 1 : 0) - (left ? 1 : 0),
    moveY: (down ? 1 : 0) - (up ? 1 : 0),
    jump: eitherDown(cursors.space, keys.SPACE),
  };
}
