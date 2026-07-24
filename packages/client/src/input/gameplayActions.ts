/**
 * Contextual item/interact and aim actions shared by keyboard, mouse, and touch.
 * The controller owns event wiring; this module owns action priority and targeting.
 */
import { MAX_THROW_RANGE, type MoveInput } from "@dc2d/engine";
import type Phaser from "phaser";
import { screenDirToWorld } from "./cameraRelative.js";
import { activeThrowableSlot } from "./hotbar.js";
import { cursorWorldTile } from "./pointer.js";
import type { InputConnection, InputPanels, InputQueries, InputState } from "./state.js";
import type { TouchInputState } from "./touch/index.js";
import { getViewOrientation } from "../render/view/index.js";

function useWorldInteraction(
  conn: InputConnection,
  panels: InputPanels,
  queries: InputQueries,
): boolean {
  const stashNearby = queries.isStashNearby(conn);
  if (stashNearby) panels.openStashIfNearby(conn);
  const nearby = stashNearby
    || queries.isDoorNearby(conn)
    || queries.isCraftTableNearby(conn);
  if (nearby) conn.interact();
  return nearby;
}

/** E priority: stairs/revive/world interaction first, then the selected consumable. */
export function interactOrUse(
  conn: InputConnection,
  panels: InputPanels,
  queries: InputQueries,
  selectedSlot: number | null,
  startRevive: (targetId: string | undefined) => boolean,
): void {
  if (queries.isStairwayNearby(conn)) return conn.descend();
  if (startRevive(queries.downedPartyMemberInRange(conn)?.id)) return;
  if (useWorldInteraction(conn, panels, queries)) return;
  const item = selectedSlot === null ? undefined : conn.hotbar[selectedSlot];
  if (selectedSlot !== null && item && queries.isConsumable(item)) {
    conn.useSlot(selectedSlot);
    return;
  }
  conn.pushToast("Nothing to interact with here");
  conn.interact();
}

/** Adds normalized cursor aim to the fixed-step movement sample. */
export function withPointerFacing(
  move: MoveInput,
  scene: Phaser.Scene,
  conn: InputConnection,
  tilePx: number,
): MoveInput {
  if (!conn.body) return move;
  const target = cursorWorldTile(scene.cameras.main, scene.input.activePointer, tilePx, conn.heightAt);
  const dx = target.x - conn.body.x;
  const dy = target.y - conn.body.y;
  const length = Math.hypot(dx, dy);
  return length > 0.001 ? { ...move, faceX: dx / length, faceY: dy / length } : move;
}

function throwAt(conn: InputConnection, slot: number, targetX: number, targetY: number): void {
  const { body } = conn;
  if (!body) return;
  const dx = targetX - body.x;
  const dy = targetY - body.y;
  if (conn.hotbar[slot] === "torch") {
    conn.throwTorch(dx, dy);
    return;
  }
  conn.useSlot(slot, targetX, targetY);
}

/** G throws the selected throwable toward touch facing or the desktop cursor. */
export function throwSelected(
  scene: Phaser.Scene,
  conn: InputConnection,
  queries: InputQueries,
  state: InputState,
  touch: TouchInputState,
  touchActive: boolean,
  tilePx: number,
): void {
  const slot = activeThrowableSlot(state, conn, queries);
  if (slot === null || !conn.body) return;
  if (touchActive) {
    const facing = screenDirToWorld(touch.lastFacing, getViewOrientation());
    throwAt(
      conn,
      slot,
      conn.body.x + facing.x * MAX_THROW_RANGE,
      conn.body.y + facing.y * MAX_THROW_RANGE,
    );
    return;
  }
  const target = cursorWorldTile(
    scene.cameras.main,
    scene.input.activePointer,
    tilePx,
    conn.heightAt,
  );
  throwAt(conn, slot, target.x, target.y);
}
