import { biomeAtWorldTile, displayCoordinates } from "@dc2d/engine";
import type { InputController } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import type { ChatController, ChatPanelModel } from "../../ui/chat/controller.js";
import type { InteractionPrompt } from "./interactionPrompt.js";
import {
  buildLiveHudSnapshot,
  type LiveHudSnapshot,
} from "./liveHudSnapshot.js";
import { resolveStairwayTick } from "./stairwayTick.js";

const CHAT_LINES_SHOWN = 4;

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

  build(
    conn: Connection,
    input: InputController,
    interactionPrompt: InteractionPrompt | null,
    chat: ChatController,
    actualFps: number,
    compassBearingDeg: number,
    aimHeadingDeg = 0,
  ): LiveHudSnapshot {
    const selectedSlot = input.selectedHotbarSlot();
    const armedSlot = input.armedThrowableSlot();
    const chatModel = chat.model(CHAT_LINES_SHOWN);
    const lastToast = conn.toasts.at(-1);
    if (this.needsRebuild(conn, selectedSlot, armedSlot, chatModel, lastToast)) {
      this.snapshot = buildLiveHudSnapshot(
        conn,
        input,
        interactionPrompt,
        chat,
        actualFps,
        compassBearingDeg,
        aimHeadingDeg,
      );
      this.captureFixedState(conn, selectedSlot, armedSlot, chatModel, lastToast);
      return this.snapshot;
    }
    const snapshot = this.snapshot;
    if (!snapshot) throw new Error("HUD cache missed its initial frame");
    this.updateTransient(
      snapshot,
      conn,
      input,
      interactionPrompt,
      actualFps,
      compassBearingDeg,
      aimHeadingDeg,
    );
    return snapshot;
  }

  private needsRebuild(
    conn: Connection,
    selectedSlot: number | null,
    armedSlot: number | null,
    chatModel: ChatPanelModel,
    lastToast: Connection["toasts"][number] | undefined,
  ): boolean {
    return !this.snapshot || this.fixedClockChanged(conn) ||
      this.visibleStateChanged(
        conn, selectedSlot, armedSlot, chatModel, lastToast,
      );
  }

  private fixedClockChanged(conn: Connection): boolean {
    return this.serverTick !== conn.serverTick ||
      this.projectedTick !== conn.prediction.projectedTick ||
      this.world !== conn.world;
  }

  private visibleStateChanged(
    conn: Connection,
    selectedSlot: number | null,
    armedSlot: number | null,
    chatModel: ChatPanelModel,
    lastToast: Connection["toasts"][number] | undefined,
  ): boolean {
    return this.selectedSlot !== selectedSlot ||
      this.armedSlot !== armedSlot ||
      this.chatModel !== chatModel ||
      this.contacts !== conn.contacts ||
      this.toastCount !== conn.toasts.length ||
      this.lastToast !== lastToast ||
      this.completedAttack !== conn.contextualActionsUsed.has("attack") ||
      this.completedBlock !== conn.contextualActionsUsed.has("block");
  }

  private captureFixedState(
    conn: Connection,
    selectedSlot: number | null,
    armedSlot: number | null,
    chatModel: ChatPanelModel,
    lastToast: Connection["toasts"][number] | undefined,
  ): void {
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

  private updateTransient(
    snapshot: LiveHudSnapshot,
    conn: Connection,
    input: InputController,
    interactionPrompt: InteractionPrompt | null,
    actualFps: number,
    compassBearingDeg: number,
    aimHeadingDeg: number,
  ): void {
    const body = conn.body ?? { x: 0, y: 0, z: 0 };
    const display = displayCoordinates(body.x, body.y);
    snapshot.coords.x = Math.round(display.x);
    snapshot.coords.y = Math.round(display.y);
    snapshot.coords.z = Math.round(body.z * 10) / 10;
    snapshot.pingMs = conn.rttMs;
    snapshot.connected = conn.status === "connected";
    snapshot.reconnecting = conn.status !== "connected";
    snapshot.reconnectAttempts = conn.reconnectAttempts;
    snapshot.interactionPrompt = interactionPrompt;
    snapshot.touch = input.touchVisual();
    snapshot.fps = actualFps;
    snapshot.compassBearingDeg = compassBearingDeg;
    snapshot.headingDeg = aimHeadingDeg;
    snapshot.respawnRemainingSec = conn.respawnSecondsRemaining;
    snapshot.downedRemainingSec = conn.downedSecondsRemaining;
    snapshot.reviveProgress = conn.reviveProgress;
    snapshot.reviverName = conn.reviverName;
    snapshot.giveUpHoldProgress = input.giveUpHoldProgress();
    snapshot.biome = conn.world
      ? biomeAtWorldTile(conn.world.worldSeed, conn.floor, body.x, body.y).biome
      : null;
    snapshot.stairway = conn.world
      ? resolveStairwayTick(conn.world, body.x, body.y, compassBearingDeg)
      : null;
  }
}
