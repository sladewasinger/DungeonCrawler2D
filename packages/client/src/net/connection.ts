import {
  PROTOCOL_VERSION,
  TICK_DT,
  World,
  createBody,
  decodeServerMessage,
  encodeMessage,
  stepBody,
  type AreaTileUpdate,
  type BodyState,
  type ClientMessage,
  type EntitySnapshot,
  type GameEvent,
  type InvSlot,
  type MoveInput,
  type ServerSnapshot,
  type ServerWelcome,
} from "@dc2d/engine";

/**
 * WebSocket client, protocol v2. Predicts the local body through the
 * same engine stepBody the server runs; everything else (hp, statuses,
 * inventory, entities, areas) is server truth rendered as received.
 */

interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
}

export interface RemoteEntity {
  snap: EntitySnapshot;
  samples: Sample[];
}

export interface Toast {
  msg: string;
  until: number;
}

export interface ChatLine {
  channel: string;
  name: string;
  text: string;
}

/** Visual-only events the scene consumes each frame. */
export type VisualEvent =
  | { t: "hit"; id: string; amount: number }
  | { t: "death"; id: string }
  | { t: "status"; id: string; status: string; on: boolean };

const RESUME_KEY = "dc2d-resume-token";
const CLIENT_ID_KEY = "dc2d-client-id";

export function persistentClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export class Connection {
  world: World | null = null;
  welcome: ServerWelcome | null = null;
  body: BodyState | null = null;
  rttMs = 0;
  status: "connecting" | "connected" | "closed" = "connecting";

  // Server-authoritative self state.
  hp = 0;
  maxHp = 1;
  fx: string[] = [];
  downed = false;
  inventory: InvSlot[] = [];
  selectedSlot = 0;
  party: ServerSnapshot["party"] = null;

  // UI state fed by events.
  stash: Array<{ item: string; qty: number }> | null = null;
  pendingInvite: { from: string; name: string } | null = null;
  toasts: Toast[] = [];
  chatLog: ChatLine[] = [];
  visualEvents: VisualEvent[] = [];
  /** Set when the server teleported us (scene snaps the camera). */
  teleported = false;

  readonly entities = new Map<string, RemoteEntity>();
  readonly areaTiles = new Map<string, string>();

  private ws: WebSocket | null = null;
  private seq = 0;
  private pending: Array<{ seq: number; input: MoveInput }> = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly url: string,
    private readonly name: string,
    private readonly clientId: string,
  ) {}

  connect(): void {
    this.status = "connecting";
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      const resumeToken = sessionStorage.getItem(RESUME_KEY) ?? undefined;
      this.sendRaw({
        type: "hello",
        protocol: PROTOCOL_VERSION,
        name: this.name,
        clientId: this.clientId,
        ...(resumeToken ? { resumeToken } : {}),
      });
    };

    ws.onmessage = (event) => {
      const msg = decodeServerMessage(String(event.data));
      if (msg) this.handle(msg);
    };

    ws.onclose = () => {
      this.status = "closed";
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
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
        this.entities.clear();
        this.areaTiles.clear();
        this.teleported = true;
        if (!this.pingTimer) {
          this.pingTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.sendRaw({ type: "ping", t: performance.now() });
            }
          }, 2000);
        }
        return;
      }
      case "snapshot":
        this.applySnapshot(msg);
        return;
      case "pong":
        this.rttMs = performance.now() - msg.t;
        return;
      case "error":
        console.error(`[server] ${msg.code}: ${msg.message}`);
        return;
    }
  }

  private applySnapshot(snap: ServerSnapshot): void {
    if (!this.world) return;

    // Self: adopt authoritative state, replay unacked inputs.
    this.body = {
      x: snap.self.x,
      y: snap.self.y,
      z: snap.self.z,
      zVel: snap.self.zVel,
      grounded: snap.self.grounded,
      fallPeak: snap.self.z,
      kx: snap.self.kx,
      ky: snap.self.ky,
    };
    this.pending = this.pending.filter((p) => p.seq > snap.lastSeq);
    for (const p of this.pending) stepBody(this.world, this.body, p.input, TICK_DT);

    this.hp = snap.self.hp;
    this.maxHp = snap.self.maxHp;
    this.fx = snap.self.fx;
    this.downed = snap.self.downed ?? false;
    this.inventory = snap.inventory;
    this.selectedSlot = snap.selectedSlot;
    this.party = snap.party;

    const now = performance.now();
    for (const entity of snap.entities) {
      let remote = this.entities.get(entity.id);
      if (!remote) {
        remote = { snap: entity, samples: [] };
        this.entities.set(entity.id, remote);
      }
      remote.snap = entity;
      remote.samples.push({ t: now, x: entity.x, y: entity.y, z: entity.z });
      while (remote.samples.length > 0 && now - remote.samples[0]!.t > 1000) {
        remote.samples.shift();
      }
    }
    for (const id of snap.left) this.entities.delete(id);

    for (const tile of snap.areas) this.applyAreaTile(tile);

    for (const event of snap.events) this.applyEvent(event);
  }

  private applyAreaTile(tile: AreaTileUpdate): void {
    const key = `${tile.x},${tile.y}`;
    if (tile.defId === null) this.areaTiles.delete(key);
    else this.areaTiles.set(key, tile.defId);
  }

  private applyEvent(event: GameEvent): void {
    switch (event.t) {
      case "toast":
        this.toasts.push({ msg: event.msg, until: performance.now() + 5000 });
        if (this.toasts.length > 5) this.toasts.shift();
        return;
      case "chat":
        this.chatLog.push({ channel: event.channel, name: event.name, text: event.text });
        if (this.chatLog.length > 8) this.chatLog.shift();
        return;
      case "invite":
        this.pendingInvite = { from: event.from, name: event.name };
        return;
      case "stash":
        this.stash = event.slots;
        return;
      case "teleported":
        this.teleported = true;
        this.pending = [];
        this.entities.clear();
        this.areaTiles.clear();
        return;
      case "hit":
      case "death":
      case "status":
        this.visualEvents.push(event);
        return;
    }
  }

  /** Called by the scene at the fixed tick rate. Predicts and sends. */
  sampleInput(input: MoveInput): void {
    if (!this.world || !this.body || this.status !== "connected") return;
    this.seq++;
    stepBody(this.world, this.body, input, TICK_DT);
    this.pending.push({ seq: this.seq, input });
    if (this.pending.length > 60) this.pending.shift();
    this.sendRaw({
      type: "input",
      seq: this.seq,
      moveX: input.moveX as -1 | 0 | 1,
      moveY: input.moveY as -1 | 0 | 1,
      jump: input.jump,
    });
  }

  // ── intents ──────────────────────────────────────────────────────

  attack(dirX: number, dirY: number): void {
    this.sendRaw({ type: "attack", dirX, dirY });
  }

  useSlot(slot: number, targetX?: number, targetY?: number): void {
    this.sendRaw({
      type: "useSlot",
      slot,
      ...(targetX !== undefined && targetY !== undefined ? { targetX, targetY } : {}),
    });
  }

  pickup(): void {
    this.sendRaw({ type: "pickup" });
  }

  drop(slot: number): void {
    this.sendRaw({ type: "drop", slot });
  }

  selectSlot(slot: number): void {
    this.selectedSlot = slot; // optimistic; server echoes next snapshot
    this.sendRaw({ type: "selectSlot", slot });
  }

  interact(): void {
    this.sendRaw({ type: "interact" });
  }

  craft(recipe: string): void {
    this.sendRaw({ type: "craft", recipe });
  }

  stashOp(op: "put" | "take", index: number): void {
    this.sendRaw({ type: "stash", op, index });
  }

  partyOp(op: "invite" | "accept" | "leave", target?: string): void {
    if (op === "accept") this.pendingInvite = null;
    this.sendRaw({ type: "party", op, ...(target !== undefined ? { target } : {}) });
  }

  chat(channel: "party" | "local", text: string): void {
    this.sendRaw({ type: "chat", channel, text });
  }

  drainVisualEvents(): VisualEvent[] {
    const out = this.visualEvents;
    this.visualEvents = [];
    return out;
  }

  /** Peer positions rendered `delayMs` in the past, lerped. */
  interpolated(delayMs: number): Array<{ id: string; snap: EntitySnapshot; x: number; y: number; z: number }> {
    const t = performance.now() - delayMs;
    const out: Array<{ id: string; snap: EntitySnapshot; x: number; y: number; z: number }> = [];
    for (const [id, remote] of this.entities) {
      const s = remote.samples;
      if (s.length === 0) continue;
      let pos: Sample = s[s.length - 1]!;
      for (let i = s.length - 1; i > 0; i--) {
        const a = s[i - 1]!;
        const b = s[i]!;
        if (a.t <= t && t <= b.t) {
          const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
          pos = { t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
          break;
        }
      }
      if (t < s[0]!.t) pos = s[0]!;
      out.push({ id, snap: remote.snap, x: pos.x, y: pos.y, z: pos.z });
    }
    return out;
  }

  private sendRaw(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encodeMessage(msg));
  }
}
