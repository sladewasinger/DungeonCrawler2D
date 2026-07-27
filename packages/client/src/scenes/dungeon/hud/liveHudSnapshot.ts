/**
 * Marshals live Connection + InputController + ChatController state into one
 * HudFakeSnapshot frame — split out of DungeonScene to stay under the file-size cap.
 */
import { biomeAtWorldTile, findWorldInteractionTarget, type WorldInteractionKind } from "@dc2d/engine";
import type { InputController } from "../../../input/index.js";
import type { Connection } from "../../../net/connection/connection.js";
import { activeLootChestNearby } from "../../../net/queries/lootChestQuery.js";
import type { ChatController } from "../../../ui/chat/controller.js";
import { resolveRemoteBossBar } from "../../../ui/widgets/hud/bars/bossBarView.js";
import type { HudFakeSnapshot } from "../../../ui/widgets/hud/core/fakeData.js";
import { buildHudSnapshot, type HudSnapshotSource } from "./hudSnapshot.js";
import type { InteractionPrompt } from "../world/interactionPrompt.js";
import { resolveStairwayTick } from "../world/stairwayTick.js";
import type { ContextualAction } from "../../../ui/actionHelp/actionHelp.js";

const CHAT_LINES_SHOWN = 4;
export type LiveHudSnapshot = HudFakeSnapshot & {
  completedContextualActions: ContextualAction[];
};

/** Self-body proximity using the engine-owned interaction contract shared by input,
 * prompt rendering, and the authoritative server. */
function nearbyStation(conn: Connection, kind: WorldInteractionKind): boolean {
  return !!conn.world && !!conn.body &&
    !!findWorldInteractionTarget({ world: conn.world, x: conn.body.x, y: conn.body.y, kind });
}

/** Everything buildHudSnapshot's `src` needs, read straight off the live Connection —
 * split out so buildLiveHudSnapshot itself stays under the function-length cap. */
function buildSnapshotSource(conn: Connection): HudSnapshotSource {
  return {
    ...snapshotVitals(conn),
    ...snapshotWorldState(conn),
  };
}

function snapshotVitals(conn: Connection) {
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
  };
}

function snapshotWorldState(conn: Connection) {
  return {
    party: conn.party,
    craftTableNearby: nearbyStation(conn, "craft"),
    stashNearby: nearbyStation(conn, "stash") || activeLootChestNearby(conn),
    stash: conn.stash,
    stashKind: conn.stashContext.kind,
    lastToast: conn.toasts.at(-1) ?? null,
    toasts: conn.toasts,
    seed: conn.welcome ? String(conn.welcome.worldSeed) : null,
    floor: conn.floor,
    boss: resolveRemoteBossBar(conn.entities.values()),
  };
}

export interface LiveHudSnapshotInput {
  readonly conn: Connection;
  readonly inputController: InputController;
  readonly interactionPrompt: InteractionPrompt | null;
  readonly chatController: ChatController;
  readonly actualFps: number;
  readonly compassBearingDeg: number;
  readonly aimHeadingDeg: number;
}

export function buildLiveHudSnapshot(input: LiveHudSnapshotInput): LiveHudSnapshot {
  const { conn, inputController, interactionPrompt, chatController, actualFps, compassBearingDeg, aimHeadingDeg } = input;
  // conn.body may still be null the first frame or two after boot (HudScene's source()
  // callback runs every frame regardless of DungeonScene's own !conn.body update() guard).
  const bodyPos = conn.body ? { x: conn.body.x, y: conn.body.y, z: conn.body.z } : { x: 0, y: 0, z: 0 };
  // LANE W: conn.world tracks floor changes live (net/apply.ts's applyFloorState
  // rebuilds it on every transfer), so the tick re-aims at the NEW floor's stairway
  // the same frame the descent lands.
  const stairway = conn.world ? resolveStairwayTick({ world: conn.world, x: bodyPos.x, y: bodyPos.y, viewBearingDeg: compassBearingDeg }) : null;
  const snapshot = buildHudSnapshot({
    src: buildSnapshotSource(conn), selectedHotbarSlot: inputController.selectedHotbarSlot(),
    armedThrowableSlot: inputController.armedThrowableSlot(), interactionPrompt,
    touch: inputController.touchVisual(), fps: actualFps, bodyPos,
    chatModel: chatController.model(CHAT_LINES_SHOWN), contacts: conn.contacts,
    compassBearingDeg, stairway,
  }) as LiveHudSnapshot;
  snapshot.biome = conn.world
    ? biomeAtWorldTile({ worldSeed: conn.world.worldSeed, floor: conn.floor, wx: bodyPos.x, wy: bodyPos.y }).biome
    : null;
  snapshot.headingDeg = aimHeadingDeg;
  snapshot.respawnRemainingSec = conn.respawnSecondsRemaining;
  snapshot.downedRemainingSec = conn.downedSecondsRemaining;
  snapshot.reviveProgress = conn.reviveProgress;
  snapshot.reviverName = conn.reviverName;
  snapshot.giveUpHoldProgress = inputController.giveUpHoldProgress();
  snapshot.completedContextualActions = [...conn.contextualActionsUsed];
  return snapshot;
}
