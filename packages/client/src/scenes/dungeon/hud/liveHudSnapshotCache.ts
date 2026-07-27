import { biomeAtWorldTile, displayCoordinates } from "@dc2d/engine";
import type { InputController } from "../../../input/index.js";
import type { Connection } from "../../../net/connection/connection.js";
import type { ChatController, ChatPanelModel } from "../../../ui/chat/controller.js";
import type { InteractionPrompt } from "../world/interactionPrompt.js";
import {
  buildLiveHudSnapshot,
  type LiveHudSnapshot,
} from "./liveHudSnapshot.js";
import { resolveStairwayTick } from "../world/stairwayTick.js";

const CHAT_LINES_SHOWN = 4;

export interface LiveHudCacheInput {
  readonly conn: Connection;
  readonly input: InputController;
  readonly interactionPrompt: InteractionPrompt | null;
  readonly chat: ChatController;
  readonly actualFps: number;
  readonly compassBearingDeg: number;
  readonly aimHeadingDeg?: number;
}

interface LiveHudFixedState {
  readonly conn: Connection;
  readonly selectedSlot: number | null;
  readonly armedSlot: number | null;
  readonly chatModel: ChatPanelModel;
  readonly lastToast: Connection["toasts"][number] | undefined;
}

interface LiveHudTransientInput {
  readonly snapshot: LiveHudSnapshot;
  readonly conn: Connection;
  readonly controller: InputController;
  readonly interactionPrompt: InteractionPrompt | null;
  readonly actualFps: number;
  readonly compassBearingDeg: number;
  readonly aimHeadingDeg: number;
}

interface LiveHudBodyFields {
  readonly snapshot: LiveHudSnapshot;
  readonly conn: Connection;
  readonly body: { x: number; y: number; z: number };
  readonly compassBearingDeg: number;
}

export class LiveHudSnapshotCache {
  private snapshot: LiveHudSnapshot | undefined;
  private serverTick = -1;
  private projectedTick: number | null = null;
  private world: Connection["world"] = null;
  private selectedSlot: number | null = null;
  private armedSlot: number | null = null;
  private chatModel: ChatPanelModel | undefined;
  private contacts: Connection["contacts"] | undefined;
  private toastCount = -1;
  private lastToast: Connection["toasts"][number] | undefined;
  private completedAttack = false;
  private completedBlock = false;

  build(input: LiveHudCacheInput): LiveHudSnapshot {
    const { conn, input: controller, interactionPrompt, chat, actualFps, compassBearingDeg, aimHeadingDeg = 0 } = input;
    const selectedSlot = controller.selectedHotbarSlot();
    const armedSlot = controller.armedThrowableSlot();
    const chatModel = chat.model(CHAT_LINES_SHOWN);
    const lastToast = conn.toasts.at(-1);
    const fixed = { conn, selectedSlot, armedSlot, chatModel, lastToast };
    if (this.needsRebuild(fixed)) {
      this.snapshot = buildLiveHudSnapshot({ conn, inputController: controller, interactionPrompt, chatController: chat, actualFps, compassBearingDeg, aimHeadingDeg });
      this.captureFixedState(fixed);
      return this.snapshot;
    }
    const snapshot = this.snapshot;
    if (!snapshot) throw new Error("HUD cache missed its initial frame");
    this.updateTransient({ snapshot, conn, controller, interactionPrompt, actualFps, compassBearingDeg, aimHeadingDeg });
    return snapshot;
  }

  private needsRebuild(fixed: LiveHudFixedState): boolean {
    const { conn } = fixed;
    return !this.snapshot || this.fixedClockChanged(conn) ||
      this.visibleStateChanged(fixed);
  }

  private fixedClockChanged(conn: Connection): boolean {
    return this.serverTick !== conn.serverTick ||
      this.projectedTick !== conn.prediction.projectedTick ||
      this.world !== conn.world;
  }

  private visibleStateChanged(fixed: LiveHudFixedState): boolean {
    const { conn, selectedSlot, armedSlot, chatModel, lastToast } = fixed;
    return this.selectedSlot !== selectedSlot ||
      this.armedSlot !== armedSlot ||
      this.chatModel !== chatModel ||
      this.contacts !== conn.contacts ||
      this.toastCount !== conn.toasts.length ||
      this.lastToast !== lastToast ||
      this.completedAttack !== conn.contextualActionsUsed.has("attack") ||
      this.completedBlock !== conn.contextualActionsUsed.has("block");
  }

  private captureFixedState(fixed: LiveHudFixedState): void {
    const { conn, selectedSlot, armedSlot, chatModel, lastToast } = fixed;
    this.serverTick = conn.serverTick;
    this.projectedTick = conn.prediction.projectedTick;
    this.world = conn.world;
    this.selectedSlot = selectedSlot;
    this.armedSlot = armedSlot;
    this.chatModel = chatModel;
    this.contacts = conn.contacts;
    this.toastCount = conn.toasts.length;
    this.lastToast = lastToast;
    this.completedAttack = conn.contextualActionsUsed.has("attack");
    this.completedBlock = conn.contextualActionsUsed.has("block");
  }

  private updateTransient(source: LiveHudTransientInput): void {
    const { snapshot, conn, controller, interactionPrompt, actualFps, compassBearingDeg, aimHeadingDeg } = source;
    const body = conn.body ?? { x: 0, y: 0, z: 0 };
    this.updateBodyFields({ snapshot, conn, body, compassBearingDeg });
    snapshot.interactionPrompt = interactionPrompt;
    snapshot.touch = controller.touchVisual();
    snapshot.fps = actualFps;
    snapshot.headingDeg = aimHeadingDeg;
    snapshot.giveUpHoldProgress = controller.giveUpHoldProgress();
  }

  private updateBodyFields(input: LiveHudBodyFields): void {
    const { snapshot, conn, body, compassBearingDeg } = input;
    const display = displayCoordinates(body.x, body.y);
    snapshot.coords.x = Math.round(display.x);
    snapshot.coords.y = Math.round(display.y);
    snapshot.coords.z = Math.round(body.z * 10) / 10;
    snapshot.pingMs = conn.rttMs;
    snapshot.connected = conn.status === "connected";
    snapshot.reconnecting = conn.status !== "connected";
    snapshot.reconnectAttempts = conn.reconnectAttempts;
    snapshot.compassBearingDeg = compassBearingDeg;
    snapshot.respawnRemainingSec = conn.respawnSecondsRemaining;
    snapshot.downedRemainingSec = conn.downedSecondsRemaining;
    snapshot.reviveProgress = conn.reviveProgress;
    snapshot.reviverName = conn.reviverName;
    snapshot.biome = conn.world
      ? biomeAtWorldTile({ worldSeed: conn.world.worldSeed, floor: conn.floor, wx: body.x, wy: body.y }).biome
      : null;
    snapshot.stairway = conn.world
      ? resolveStairwayTick({ world: conn.world, x: body.x, y: body.y, viewBearingDeg: compassBearingDeg })
      : null;
  }
}
