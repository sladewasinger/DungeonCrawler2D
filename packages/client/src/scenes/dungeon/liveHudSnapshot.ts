/**
 * Marshals live Connection + InputController + ChatController state into one
 * HudFakeSnapshot frame — split out of DungeonScene to stay under the file-size cap.
 */
import { findWorldInteractionTarget, type WorldInteractionKind } from "@dc2d/engine";
import type { InputController } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import type { ChatController } from "../../ui/chat/controller.js";
import { resolveBossBar } from "../../ui/widgets/hud/bossBarView.js";
import type { HudFakeSnapshot } from "../../ui/widgets/hud/fakeData.js";
import { buildHudSnapshot, type HudSnapshotSource } from "./hudSnapshot.js";
import type { InteractionPrompt } from "./interactionPrompt.js";
import { resolveStairwayTick } from "./stairwayTick.js";

const CHAT_LINES_SHOWN = 4;

/** Self-body proximity using the engine-owned interaction contract shared by input,
 * prompt rendering, and the authoritative server. */
function nearbyStation(conn: Connection, kind: WorldInteractionKind): boolean {
  return !!conn.world && !!conn.body &&
    !!findWorldInteractionTarget(conn.world, conn.body.x, conn.body.y, kind);
}

/** Everything buildHudSnapshot's `src` needs, read straight off the live Connection —
 * split out so buildLiveHudSnapshot itself stays under the function-length cap. */
function buildSnapshotSource(conn: Connection): HudSnapshotSource {
  return {
    playerId: conn.welcome?.playerId ?? null,
    hp: conn.hp,
    maxHp: conn.maxHp,
    stamina: conn.stamina,
    maxStamina: conn.maxStamina,
    blocking: conn.blocking,
    staminaExhausted: conn.staminaExhausted,
    xp: conn.xp,
    level: conn.charLevel,
    xpForNext: conn.xpForNext,
    hotbar: conn.hotbar,
    inventory: conn.inventory,
    weapon: conn.weapon,
    fx: conn.fx,
    statusEffects: conn.statusEffects,
    pingMs: conn.rttMs,
    connected: conn.status === "connected",
    reconnecting: conn.status !== "connected",
    reconnectAttempts: conn.reconnectAttempts,
    downed: conn.downed,
    dead: conn.dead,
    party: conn.party,
    craftTableNearby: nearbyStation(conn, "craft"),
    stashNearby: nearbyStation(conn, "stash"),
    stash: conn.stash,
    lastToast: conn.toasts.at(-1) ?? null,
    toasts: conn.toasts,
    seed: conn.welcome ? String(conn.welcome.worldSeed) : null,
    floor: conn.floor,
    boss: resolveBossBar([...conn.entities.values()].map((e) => e.snap)),
  };
}

export function buildLiveHudSnapshot(
  conn: Connection,
  inputController: InputController,
  interactionPrompt: InteractionPrompt | null,
  chatController: ChatController,
  actualFps: number,
  /** LANE W2 HUD compass — 0 = world-north at screen-up (scenes/dungeon/rotationControl.ts). */
  compassBearingDeg: number,
): HudFakeSnapshot {
  // conn.body may still be null the first frame or two after boot (HudScene's source()
  // callback runs every frame regardless of DungeonScene's own !conn.body update() guard).
  const bodyPos = conn.body ? { x: conn.body.x, y: conn.body.y, z: conn.body.z } : { x: 0, y: 0, z: 0 };
  // LANE W: conn.world tracks floor changes live (net/apply.ts's applyFloorState
  // rebuilds it on every transfer), so the tick re-aims at the NEW floor's stairway
  // the same frame the descent lands.
  const stairway = conn.world ? resolveStairwayTick(conn.world, bodyPos.x, bodyPos.y, compassBearingDeg) : null;
  return buildHudSnapshot(
    buildSnapshotSource(conn),
    inputController.selectedHotbarSlot(),
    inputController.armedThrowableSlot(),
    interactionPrompt,
    inputController.touchVisual(),
    actualFps,
    bodyPos,
    chatController.model(CHAT_LINES_SHOWN),
    conn.contacts,
    compassBearingDeg,
    stairway,
  );
}
