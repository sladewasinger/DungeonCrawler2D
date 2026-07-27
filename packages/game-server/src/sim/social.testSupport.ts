import {
  LEVEL,
  World,
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  newEntityId,
  type RawContent,
} from "@dc2d/engine";
import { PlayerStore } from "../store.js";
import { createSimState, type PlayerSlot, type SimState } from "./state.js";

const EMPTY_CONTENT: RawContent = {
  statuses: [],
  rules: [],
  areas: [],
  items: [],
  enemies: [],
  recipes: [],
};

export function makeSocialSlot(name: string, x: number, y: number): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, 0), {
    id: newEntityId("p"),
    name,
    hp: 10,
    maxHp: 10,
    tags: new Set(["player"]),
  });
  return { entity, ...socialSlotState(name) };
}

function socialSlotState(name: string): Omit<PlayerSlot, "entity"> {
  return {
    ...socialIdentity(name),
    ...socialSessionState(),
    ...socialGameplayState(),
  };
}

function socialIdentity(name: string): Pick<PlayerSlot, "clientId" | "stored" | "resumeToken"> {
  return {
    clientId: `client-${name}`,
    stored: { slot: 0, name, stash: [], contacts: [], localProfileId: `local-test-${name}` },
    resumeToken: `token-${name}`,
  };
}

function socialSessionState(): Pick<
  PlayerSlot,
  "lastSeq" | "pendingInputs" | "pendingActions" | "connected" | "reapAtTick" | "known" |
  "inventory" | "hotbar" | "weapon" | "outbox" | "returnStack" | "partyId" | "respawnAtTick" |
  "needsFullAreas" | "downedAtTick"
> {
  return {
    lastSeq: -1,
    pendingInputs: [],
    pendingActions: [],
    connected: true,
    reapAtTick: Number.MAX_SAFE_INTEGER,
    known: new Set(),
    inventory: [],
    hotbar: [],
    weapon: null,
    outbox: [],
    returnStack: [],
    partyId: null,
    respawnAtTick: null,
    needsFullAreas: true,
    downedAtTick: null,
  };
}

function socialGameplayState(): Pick<
  PlayerSlot,
  "attackReadyAtTick" | "attackStartedAtTick" | "god" | "forceDeath" | "chatTimestamps" |
  "lastFistbumpOfferAtTick" | "spawnGraceUntilTick" | "pendingTransfer"
> {
  return {
    attackReadyAtTick: 0,
    attackStartedAtTick: Number.NEGATIVE_INFINITY,
    god: false,
    forceDeath: false,
    chatTimestamps: [],
    lastFistbumpOfferAtTick: Number.NEGATIVE_INFINITY,
    spawnGraceUntilTick: 0,
    pendingTransfer: null,
  };
}

export function makeSocialState(): SimState {
  const world = new World(hashString("social-test"), 1, LEVEL.Sandbox);
  const content = buildContentRegistry(EMPTY_CONTENT);
  return createSimState({ world, content, store: new PlayerStore(null), rngSeed: 1, opts: {} });
}
