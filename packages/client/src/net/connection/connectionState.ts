import {
  LEVEL,
  MOVE_SPEED,
  PLAYER_MAX_STAMINA,
  WireMetrics,
  World,
  type ActiveStatusSnapshot,
  type BodyState,
  type InvStack,
  type LevelId,
  type PlayerSkin,
  type ServerSnapshot,
  type ServerWelcome,
} from "@dc2d/engine";
import type { ChatLine, ContactInfo, DeathVisualEvent, NpcSpeech, Toast, VisualEvent } from "./connectionTypes.js";
import type { RemoteEntity } from "../interpolation/interpolate.js";
import { InterpolationDelay } from "../interpolation/interpolationDelay.js";
import { MovementCadence } from "../movement/movementCadence.js";
import type { MovementTraceRecorder } from "../movement/movementTrace.js";
import { Prediction } from "../prediction/prediction.js";
import { PredictionCorrection } from "../prediction/predictionCorrection.js";
import { SnapshotRevisionState } from "../snapshots/snapshotState.js";
import { ServerTimeline } from "../interpolation/serverTimeline.js";

export class ConnectionState {
  world: World | null = null;
  welcome: ServerWelcome | null = null;
  body: BodyState | null = null;
  rttMs = 0;
  status: "connecting" | "connected" | "closed" = "closed";
  serverTick = 0;
  readonly snapshotRevisions = new SnapshotRevisionState();
  hasReceivedSnapshot = false;
  hp = 0;
  maxHp = 1;
  stamina = PLAYER_MAX_STAMINA;
  maxStamina = PLAYER_MAX_STAMINA;
  blocking = false;
  staminaRecoveryDelaySeconds = 0;
  staminaExhausted = false;
  healthRegenerationDelaySeconds = 0;
  movementSpeed = MOVE_SPEED;
  readonly contextualActionsUsed = new Set<"attack" | "block">();
  fx: string[] = [];
  statusEffects: ActiveStatusSnapshot[] = [];
  downed = false;
  downedUntilTick: number | null = null;
  respawnAtTick: number | null = null;
  reviveProgress = 0;
  reviverName: string | null = null;
  xp = 0;
  charLevel = 1;
  xpForNext = 0;
  floor = 1;
  inventory: InvStack[] = [];
  hotbar: Array<string | null> = [];
  weapon: string | null = null;
  party: ServerSnapshot["party"] = null;
  stash: Array<{ item: string; qty: number }> | null = null;
  stashContext: { kind: "personal" | "loot"; chestId: string | null } = { kind: "personal", chestId: null };
  pendingInvite: { from: string; name: string } | null = null;
  readonly outgoingPartyInvites = new Map<string, string>();
  toasts: Toast[] = [];
  chatLog: ChatLine[] = [];
  chatSeq = 0;
  contacts: ContactInfo[] = [];
  mutedPlayers = new Set<string>();
  blockedPlayers = new Set<string>();
  visualEvents: VisualEvent[] = [];
  deathVisualEvents: DeathVisualEvent[] = [];
  npcSpeech: NpcSpeech | null = null;
  roomDoors: ServerSnapshot["roomDoors"] = [];
  teleported = false;
  justRespawned = false;
  readonly entities = new Map<string, RemoteEntity>();
  readonly areaTiles = new Map<string, string>();
  readonly areaTileLayers = new Map<string, readonly string[]>();
  readonly prediction = new Prediction();
  readonly movementCadence = new MovementCadence();
  readonly predictionCorrection = new PredictionCorrection();
  readonly serverTimeline = new ServerTimeline();
  readonly interpolationDelay = new InterpolationDelay();
  readonly networkMetrics = new WireMetrics();
  movementTrace: MovementTraceRecorder | null = null;
  ws: WebSocket | null = null;
  pingTimer: ReturnType<typeof setInterval> | null = null;
  reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  shouldReconnect = false;
  level: LevelId = LEVEL.Dungeon;
  skin: PlayerSkin = "knight_f";
  reconnectAttempts = 0;
  sessionExpired = false;
  updateRequired = false;
  updateRequiredMessage = "";

  constructor(readonly url: string, public name: string, readonly clientId: string) {}
}
