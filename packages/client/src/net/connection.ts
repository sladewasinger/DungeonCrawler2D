import {
  PROTOCOL_VERSION,
  TICK_DT,
  World,
  createBody,
  decodeServerMessage,
  encodeMessage,
  stepBody,
  type BodyState,
  type MoveInput,
  type ServerWelcome,
} from "@dc2d/engine";

/**
 * WebSocket client with client-side prediction for the local body and
 * interpolation buffers for everyone else.
 *
 * Prediction: inputs are sampled at the fixed tick rate, applied
 * locally through the same engine stepBody the server runs, and sent
 * with a sequence number. Each snapshot carries the authoritative self
 * state plus lastSeq; we reset to it and replay the still-unacked
 * inputs — identical math, so an honest client sees no corrections.
 */

interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
}

export interface RemotePlayer {
  id: string;
  name: string;
  samples: Sample[];
}

export interface InterpolatedPeer {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

const RESUME_KEY = "dc2d-resume-token";

export class Connection {
  world: World | null = null;
  welcome: ServerWelcome | null = null;
  body: BodyState | null = null;
  rttMs = 0;
  status: "connecting" | "connected" | "closed" = "connecting";

  private ws: WebSocket | null = null;
  private seq = 0;
  private pending: Array<{ seq: number; input: MoveInput }> = [];
  private readonly others = new Map<string, RemotePlayer>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly url: string,
    private readonly name: string,
  ) {}

  connect(): void {
    this.status = "connecting";
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      const resumeToken = sessionStorage.getItem(RESUME_KEY) ?? undefined;
      ws.send(
        encodeMessage({
          type: "hello",
          protocol: PROTOCOL_VERSION,
          name: this.name,
          ...(resumeToken ? { resumeToken } : {}),
        }),
      );
    };

    ws.onmessage = (event) => {
      const msg = decodeServerMessage(String(event.data));
      if (msg) this.handle(msg);
    };

    ws.onclose = () => {
      this.status = "closed";
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      // Reconnect with the resume token; the server keeps our body
      // alive through the grace window.
      setTimeout(() => this.connect(), 1000);
    };
  }

  private handle(msg: NonNullable<ReturnType<typeof decodeServerMessage>>): void {
    switch (msg.type) {
      case "welcome": {
        this.welcome = msg;
        this.status = "connected";
        sessionStorage.setItem(RESUME_KEY, msg.resumeToken);
        this.world = new World(msg.worldSeed, msg.floor);
        this.body = createBody(msg.spawn.x, msg.spawn.y, msg.spawn.z);
        this.pending = [];
        this.others.clear();
        if (!this.pingTimer) {
          this.pingTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(encodeMessage({ type: "ping", t: performance.now() }));
            }
          }, 2000);
        }
        return;
      }
      case "snapshot": {
        if (!this.world) return;
        // Reconcile self: adopt authoritative state, replay unacked inputs.
        this.body = {
          x: msg.self.x,
          y: msg.self.y,
          z: msg.self.z,
          zVel: msg.self.zVel,
          grounded: msg.self.grounded,
          fallPeak: msg.self.z,
        };
        this.pending = this.pending.filter((p) => p.seq > msg.lastSeq);
        for (const p of this.pending) {
          stepBody(this.world, this.body, p.input, TICK_DT);
        }
        // Buffer peers for interpolation.
        const now = performance.now();
        for (const peer of msg.others) {
          let remote = this.others.get(peer.id);
          if (!remote) {
            remote = { id: peer.id, name: peer.name, samples: [] };
            this.others.set(peer.id, remote);
          }
          remote.samples.push({ t: now, x: peer.x, y: peer.y, z: peer.z });
          while (remote.samples.length > 0 && now - remote.samples[0]!.t > 1000) {
            remote.samples.shift();
          }
        }
        for (const id of msg.left) this.others.delete(id);
        return;
      }
      case "pong": {
        this.rttMs = performance.now() - msg.t;
        return;
      }
      case "error": {
        console.error(`[server] ${msg.code}: ${msg.message}`);
        return;
      }
    }
  }

  /** Called by the scene at the fixed tick rate. Predicts and sends. */
  sampleInput(input: MoveInput): void {
    if (!this.world || !this.body || this.status !== "connected") return;
    this.seq++;
    stepBody(this.world, this.body, input, TICK_DT);
    this.pending.push({ seq: this.seq, input });
    if (this.pending.length > 3 * 20) this.pending.shift(); // ~3s of inputs max
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        encodeMessage({
          type: "input",
          seq: this.seq,
          moveX: input.moveX as -1 | 0 | 1,
          moveY: input.moveY as -1 | 0 | 1,
          jump: input.jump,
        }),
      );
    }
  }

  /** Peer positions rendered `delayMs` in the past, lerped between snapshots. */
  interpolatedPeers(delayMs: number): InterpolatedPeer[] {
    const t = performance.now() - delayMs;
    const result: InterpolatedPeer[] = [];
    for (const remote of this.others.values()) {
      const s = remote.samples;
      if (s.length === 0) continue;
      let out: Sample = s[s.length - 1]!;
      for (let i = s.length - 1; i > 0; i--) {
        const a = s[i - 1]!;
        const b = s[i]!;
        if (a.t <= t && t <= b.t) {
          const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
          out = {
            t,
            x: a.x + (b.x - a.x) * k,
            y: a.y + (b.y - a.y) * k,
            z: a.z + (b.z - a.z) * k,
          };
          break;
        }
      }
      if (t < s[0]!.t) out = s[0]!;
      result.push({ id: remote.id, name: remote.name, x: out.x, y: out.y, z: out.z });
    }
    return result;
  }

  get peerCount(): number {
    return this.others.size;
  }
}
