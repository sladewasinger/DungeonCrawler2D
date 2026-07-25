import {
  LEVEL,
  PROTOCOL_VERSION,
  decodeServerMessage,
  encodeMessage,
  type ClientMessage,
} from "@dc2d/engine";
import { WebSocket } from "ws";

export interface LoadClientMetrics {
  sentBytes: number;
  receivedBytes: number;
  maximumQueueBytes: number;
  decodeFailures: number;
}

export class NetworkLoadClient {
  private readonly socket: WebSocket;
  private sequence = 0;
  private latestServerTick = 0;
  private welcomeResolve: (() => void) | null = null;
  readonly metrics: LoadClientMetrics = {
    sentBytes: 0,
    receivedBytes: 0,
    maximumQueueBytes: 0,
    decodeFailures: 0,
  };

  constructor(url: string, index: number) {
    this.socket = new WebSocket(url);
    this.socket.on("message", (raw) => this.receive(raw.toString()));
    this.socket.once("open", () => this.send({
      type: "hello",
      protocol: PROTOCOL_VERSION,
      name: `load-${index + 1}`,
      clientId: `network-load-client-${index + 1}`,
      level: LEVEL.Sandbox,
      snapshotMode: "delta-v1",
    }));
  }

  connected(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.welcomeResolve = resolve;
      this.socket.once("error", reject);
    });
  }

  sample(tick: number, index: number): void {
    if (this.latestServerTick === 0) return;
    const phase = Math.floor(tick / 30) + index;
    const axis = phase % 2;
    const sign = phase % 4 < 2 ? 1 : -1;
    this.send({
      type: "input",
      seq: this.sequence++,
      projectedServerTick: this.latestServerTick + 1,
      moveX: axis === 0 ? sign : 0,
      moveY: axis === 1 ? sign : 0,
      jump: tick % 80 === index % 80,
      run: true,
      block: false,
    });
  }

  close(): Promise<void> {
    if (this.socket.readyState >= WebSocket.CLOSING) return Promise.resolve();
    return new Promise((resolve) => {
      this.socket.once("close", resolve);
      this.socket.close(1000, "load complete");
    });
  }

  private send(message: ClientMessage): void {
    const payload = encodeMessage(message);
    this.metrics.sentBytes += Buffer.byteLength(payload);
    this.socket.send(payload);
    this.metrics.maximumQueueBytes = Math.max(
      this.metrics.maximumQueueBytes,
      this.socket.bufferedAmount,
    );
  }

  private receive(payload: string): void {
    this.metrics.receivedBytes += Buffer.byteLength(payload);
    const message = decodeServerMessage(payload);
    if (!message) {
      this.metrics.decodeFailures += 1;
      return;
    }
    if (message.type === "welcome") {
      this.receiveWelcome();
    } else if (
      message.type === "snapshot" ||
      message.type === "snapshotDelta"
    ) {
      this.latestServerTick = message.tick;
    }
  }

  private receiveWelcome(): void {
    this.welcomeResolve?.();
    this.welcomeResolve = null;
  }
}
