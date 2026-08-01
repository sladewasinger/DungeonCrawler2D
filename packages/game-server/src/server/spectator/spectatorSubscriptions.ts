import type {
  ClientSpectatorCommand,
  ClientSpectatorHello,
  ServerMessage,
} from "@dc2d/engine";
import type { WebSocket } from "ws";
import type { PreparedSnapshotDelivery } from "../../sim/snapshots/snapshots.js";
import { sendServerMessage } from "../telemetry/measuredSend.js";
import type { ConnState } from "../types.js";
import { applySpectatorCommand } from "./spectatorCommands.js";
import { clearDeliveredBaselineRequests, deliverSpectatorSnapshots } from "./spectatorDelivery.js";
import {
  SpectatorRateLimits,
  createSpectatorRateWindow,
} from "./spectatorRateLimits.js";
import {
  spectatorCapacityReached,
  type SpectatorSubscription,
  type SpectatorSubscriptionOptions,
} from "./spectatorSubscriptionTypes.js";
import {
  cycleSpectatorTarget,
  refreshSpectatorSubscription,
  selectInitialSpectatorTarget,
} from "./spectatorSubscriptionLifecycle.js";

export class SpectatorSubscriptions {
  private readonly subscriptions = new Map<WebSocket, SpectatorSubscription>();
  private readonly rateLimits = new SpectatorRateLimits();
  private lastRefreshAt = 0;

  constructor(private readonly options: SpectatorSubscriptionOptions) {}

  has(socket: WebSocket): boolean { return this.subscriptions.has(socket); }

  start(socket: WebSocket, connection: ConnState, hello: ClientSpectatorHello): void {
    if (connection.playerId !== null || this.has(socket)) return;
    const now = Date.now();
    if (!this.rateLimits.allowStart(connection.peerAddress, now)) {
      socket.close(1008, "spectator rate limited");
      return;
    }
    if (spectatorCapacityReached(this.subscriptions.values(), connection.peerAddress)) {
      socket.close(1013, "spectator capacity reached");
      return;
    }
    const subscription = {
      socket,
      connection,
      mode: hello.mode,
      playerId: selectInitialSpectatorTarget(this.options.directory, hello.playerId),
      worldIdentity: null,
      needsBaseline: false,
      lastTargetChangeAt: this.rateLimits.lastTargetChangeAt(connection.peerAddress, now),
      commandWindow: createSpectatorRateWindow(),
    };
    this.subscriptions.set(socket, subscription);
    this.sendTarget(subscription);
  }

  command(socket: WebSocket, command: ClientSpectatorCommand): void {
    const subscription = this.subscriptions.get(socket);
    if (!subscription) return;
    const now = Date.now();
    if (!this.rateLimits.allowCommand(subscription.connection.peerAddress, subscription.commandWindow, now)) return;
    const previousTargetChangeAt = subscription.lastTargetChangeAt;
    applySpectatorCommand({
      subscription,
      command,
      directory: this.options.directory,
      now,
      sendTarget: () => this.sendTarget(subscription),
      sendRoster: () => this.sendRoster(subscription),
      cycle: (direction) => cycleSpectatorTarget({
        subscription,
        direction,
        directory: this.options.directory,
        sendTarget: () => this.sendTarget(subscription),
        sendRoster: () => this.sendRoster(subscription),
      }),
    });
    if (subscription.lastTargetChangeAt !== previousTargetChangeAt) {
      this.rateLimits.recordTargetChange(subscription.connection.peerAddress, now);
    }
  }

  remove(socket: WebSocket): void {
    const removed = this.subscriptions.get(socket);
    if (!removed) return;
    this.subscriptions.delete(socket);
    this.rateLimits.release(removed.connection.peerAddress);
  }

  deliver(snapshots: Map<string, PreparedSnapshotDelivery>): void {
    deliverSpectatorSnapshots({
      targets: this.subscriptions.values(),
      snapshots,
      directory: this.options.directory,
      send: (target, message) => this.send(target as SpectatorSubscription, message),
    });
    clearDeliveredBaselineRequests(this.subscriptions.values(), snapshots);
  }

  prepare(): void {
    for (const subscription of this.subscriptions.values()) {
      const playerId = subscription.playerId;
      if (!playerId || !this.options.directory.has(playerId)) continue;
      const identity = this.options.directory.worldIdentity(playerId);
      if (identity !== subscription.worldIdentity) this.sendTarget(subscription);
    }
  }

  refresh(now = Date.now()): void {
    if (now - this.lastRefreshAt < 500) return;
    this.lastRefreshAt = now;
    for (const subscription of this.subscriptions.values()) {
      refreshSpectatorSubscription({
        subscription,
        now,
        directory: this.options.directory,
        sendTarget: () => this.sendTarget(subscription),
        sendRoster: () => this.sendRoster(subscription),
      });
    }
  }

  private sendTarget(subscription: SpectatorSubscription): void {
    const playerId = subscription.playerId;
    if (!playerId) return this.sendRoster(subscription);
    const welcome = this.options.directory.welcome(playerId, subscription.mode);
    if (!welcome) return;
    subscription.worldIdentity = this.options.directory.worldIdentity(playerId);
    subscription.needsBaseline = !this.options.directory.requestBaseline(playerId);
    this.send(subscription, welcome);
    const presentation = this.options.directory.presentation(playerId);
    if (presentation) this.send(subscription, presentation);
    this.sendRoster(subscription);
  }

  private sendRoster(subscription: SpectatorSubscription): void {
    this.send(subscription, {
      type: "spectatorRoster",
      players: this.options.directory.players(),
      playerId: subscription.playerId,
      mode: subscription.mode,
    });
  }

  private send(subscription: SpectatorSubscription, message: ServerMessage): void {
    sendServerMessage({
      socket: subscription.socket,
      playerId: null,
      message,
      diagnostics: this.options.diagnostics,
    });
  }
}
