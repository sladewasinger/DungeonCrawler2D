/** Multiplayer WebSocket client with prediction and deterministic local preview fallback. */
import {
  DAY_DURATION_SECONDS,
  PROTOCOL_VERSION,
  ServerMessageSchema,
  WorldChunkCache,
  wrapDayPhase,
  type ClientMessage,
  type PlayerSnapshot,
} from "@dc2d/engine";
import {
  createDefaultPlayer,
  defaultWsUrl,
  predictLocalPlayerMove,
  reconcilePredictedPlayer,
} from "./worldPrediction.js";

const INITIAL_DAY_PHASE = 0.62;

export type ConnectionMode = "connecting" | "server" | "local";

export interface WorldViewState {
  readonly mode: ConnectionMode;
  readonly dayPhase: number;
  readonly dayPaused: boolean;
  readonly cache: WorldChunkCache;
  readonly players: readonly PlayerSnapshot[];
  readonly localPlayerId: string;
}

export class WorldClient {
  private ws: WebSocket | null = null;
  private mode: ConnectionMode = "connecting";
  private cache = new WorldChunkCache(1337);
  private localPlayerId = "local";
  private dayPhase = INITIAL_DAY_PHASE;
  private dayPaused = false;
  private seq = 0;
  private localPlayer: PlayerSnapshot = createDefaultPlayer("local");
  private remotePlayers: PlayerSnapshot[] = [];
  private connectTimer: number | null = null;

  constructor(wsUrl = defaultWsUrl()) {
    this.openSocket(wsUrl);
  }

  private openSocket(url: string): void {
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      this.connectTimer = window.setTimeout(() => {
        if (this.mode === "connecting") this.mode = "local";
      }, 800);
      ws.addEventListener("open", () => this.send({ t: "hello", version: PROTOCOL_VERSION, name: "Adventurer" }));
      ws.addEventListener("message", (ev) => this.handleMessage(String(ev.data)));
      ws.addEventListener("close", () => this.switchToLocal());
      ws.addEventListener("error", () => this.switchToLocal());
    } catch {
      this.switchToLocal();
    }
  }

  private switchToLocal(): void {
    if (this.connectTimer !== null) window.clearTimeout(this.connectTimer);
    this.mode = "local";
    this.ws = null;
  }

  private handleMessage(raw: string): void {
    let json: unknown;
    try { json = JSON.parse(raw); } catch { return; }
    const parsed = ServerMessageSchema.safeParse(json);
    if (!parsed.success) return;
    const msg = parsed.data;
    if (msg.t === "welcome") {
      if (this.connectTimer !== null) window.clearTimeout(this.connectTimer);
      this.mode = "server";
      this.localPlayerId = msg.playerId;
      this.cache = new WorldChunkCache(msg.worldSeed);
      this.dayPhase = msg.dayPhase;
      this.dayPaused = msg.dayPaused;
      return;
    }
    this.dayPhase = msg.dayPhase;
    this.dayPaused = msg.dayPaused;
    this.remotePlayers = msg.players;
    const me = msg.players.find((p) => p.id === this.localPlayerId);
    if (me) this.localPlayer = reconcilePredictedPlayer(this.localPlayer, me);
  }

  stepInput(move: { readonly x: number; readonly y: number }, dt: number): void {
    const mag = Math.hypot(move.x, move.y);
    const nx = mag > 0.05 ? move.x / Math.max(1, mag) : 0;
    const ny = mag > 0.05 ? move.y / Math.max(1, mag) : 0;
    if (this.mode === "server" && this.ws?.readyState === WebSocket.OPEN) {
      this.send({ t: "input", seq: ++this.seq, moveX: nx, moveY: ny });
    }
    if (this.mode !== "server" && !this.dayPaused) {
      this.dayPhase = wrapDayPhase(this.dayPhase + dt / DAY_DURATION_SECONDS);
    }
    this.localPlayer = predictLocalPlayerMove({ cache: this.cache, player: this.localPlayer, nx, ny, dt });
  }

  toggleTorch(): void {
    this.localPlayer = { ...this.localPlayer, torchLit: !this.localPlayer.torchLit };
    this.send({ t: "toggleTorch" });
  }

  setDayPhase(dayPhase: number, paused?: boolean): void {
    this.dayPhase = wrapDayPhase(dayPhase);
    if (paused !== undefined) this.dayPaused = paused;
    this.send({ t: "setDayPhase", dayPhase: this.dayPhase, ...(paused !== undefined ? { paused } : {}) });
  }

  snapshot(): WorldViewState {
    const players = this.mode === "server"
      ? this.remotePlayers.map((p) => (p.id === this.localPlayerId ? this.localPlayer : p))
      : [this.localPlayer];
    return {
      mode: this.mode,
      dayPhase: this.dayPhase,
      dayPaused: this.dayPaused,
      cache: this.cache,
      players,
      localPlayerId: this.localPlayerId,
    };
  }

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
