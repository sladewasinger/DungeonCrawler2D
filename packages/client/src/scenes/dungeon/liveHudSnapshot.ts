/**
 * Marshals live Connection + InputController + ChatController state into one
 * HudFakeSnapshot frame — split out of DungeonScene to stay under the file-size cap.
 */
import type { InputController } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import type { ChatController } from "../../ui/chat/controller.js";
import type { HudFakeSnapshot } from "../../ui/widgets/hud/fakeData.js";
import { buildHudSnapshot, type HudSnapshotSource } from "./hudSnapshot.js";
import type { InteractionPrompt } from "./interactionPrompt.js";

const CHAT_LINES_SHOWN = 4;

export function buildLiveHudSnapshot(
  conn: Connection,
  inputController: InputController,
  interactionPrompt: InteractionPrompt | null,
  chatController: ChatController,
  actualFps: number,
): HudFakeSnapshot {
  const source: HudSnapshotSource = {
    hp: conn.hp,
    maxHp: conn.maxHp,
    hotbar: conn.hotbar,
    inventory: conn.inventory,
    weapon: conn.weapon,
    fx: conn.fx,
    pingMs: conn.rttMs,
    connected: conn.status === "connected",
    reconnecting: conn.status !== "connected",
    downed: conn.downed || conn.dead,
  };
  // conn.body may still be null the first frame or two after boot (HudScene's source()
  // callback runs every frame regardless of DungeonScene's own !conn.body update() guard).
  const bodyPos = conn.body ? { x: conn.body.x, y: conn.body.y } : { x: 0, y: 0 };
  return buildHudSnapshot(
    source,
    inputController.armedThrowableSlot(),
    interactionPrompt,
    inputController.touchVisual(),
    actualFps,
    bodyPos,
    chatController.model(CHAT_LINES_SHOWN),
    conn.contacts,
  );
}
