/** Client-side Sanctuary Hub & Fog state mirror, offline/online RPC dispatch, and UI sync helpers. */
import { FLOOR_GUIDE_QUESTS, generateFloorBounties } from "@dc2d/content";
import {
  applyFogChunkDeltas, createEmptyStashSlots, createFogState,
  type ActiveBountyState, type ActiveQuestState, type ClientMessage, type FogState,
  type InventorySlot, type InventorySnapshot, type PlayerSnapshot, type ServerMessage, type WorldEvent,
} from "@dc2d/engine";
import type { AudioEngine } from "../audio/audioEngine.js";
import type { HubModalController, HubUiCallbacks } from "../ui/hubs/hubModalController.js";
import {
  applyOfflineBlacksmithOp, applyOfflineGiveGold, applyOfflineMerchantBuy, applyOfflineMerchantSell,
  applyOfflineObjectiveAction, applyOfflineStashMove,
} from "./offline/offlineHubs.js";
import type { OfflineWorldController, OfflineStateSlice } from "./offline/offlineWorldController.js";
import type { AdminSendRequest, WorldViewState } from "./worldClientHelpers.js";

export interface ClientHubState {
  gold: number;
  fog: FogState;
  fogVersion: number;
  lastFogKey: string;
  stash: InventorySlot[];
  bounties: ActiveBountyState[];
  quests: ActiveQuestState[];
}

export interface HubActionClient {
  merchantBuy(offerId: string, count?: number): void;
  merchantSell(slotIndex: number): void;
  blacksmithReforge(slotIndex: number): void;
  blacksmithUpgrade(slotIndex: number): void;
  bountyAccept(bountyId: string): void;
  bountyClaim(bountyId: string): void;
  questAccept(questId: string): void;
  questClaim(questId: string): void;
  stashQuickMove(req: { readonly from: "stash" | "inv"; readonly slotIndex: number }): boolean;
  stashTakeAll(): boolean;
}

export interface HubActionBridgeDeps {
  readonly isServer: () => boolean;
  readonly nextSeq: () => number;
  readonly send: (msg: ClientMessage) => void;
  readonly getOfflineCtx: () => {
    readonly hub: ClientHubState;
    readonly inv: InventorySnapshot;
    readonly player: PlayerSnapshot;
    readonly worldSeed: number;
    readonly events: WorldEvent[];
  };
  readonly commitOfflineInv: (inv: InventorySnapshot) => void;
}

function buildDefaultBounties(worldSeed: number): ActiveBountyState[] {
  return generateFloorBounties(worldSeed).map((def) => ({
    id: def.id, title: def.title, description: def.summary, targetKind: def.targetKind ?? def.objectiveKind,
    progress: 0, required: def.targetCount, rewardGold: def.rewardGold,
    ...(def.rewardItem ? { rewardItemId: def.rewardItem.itemId, rewardCount: def.rewardItem.count } : {}),
    accepted: false, claimed: false,
  }));
}

function buildDefaultQuests(): ActiveQuestState[] {
  return FLOOR_GUIDE_QUESTS.map((def) => ({
    id: def.id, title: def.title, description: def.summary, dialogue: def.dialogue,
    hintText: "Explore outside Sanctuary to advance Floor Guide tasks.",
    progress: 0, required: def.targetCount, rewardGold: def.rewardGold,
    ...(def.rewardItem ? { rewardItemId: def.rewardItem.itemId, rewardCount: def.rewardItem.count } : {}),
    accepted: false, claimed: false,
  }));
}

export function createClientHubState(worldSeed: number): ClientHubState {
  return {
    gold: 0, fog: createFogState(), fogVersion: 0, lastFogKey: "",
    stash: createEmptyStashSlots(), bounties: buildDefaultBounties(worldSeed), quests: buildDefaultQuests(),
  };
}

export function resetClientHubState(hub: ClientHubState, worldSeed: number): void {
  hub.gold = 0; hub.fog = createFogState(); hub.fogVersion += 1; hub.lastFogKey = "";
  hub.stash = createEmptyStashSlots(); hub.bounties = buildDefaultBounties(worldSeed); hub.quests = buildDefaultQuests();
}

function syncGoldFromSnapshot(
  hub: ClientHubState,
  msg: Extract<ServerMessage, { t: "snapshot" }>,
  localPlayer: PlayerSnapshot | undefined,
): void {
  const nextGold = msg.selfInventory?.gold ?? localPlayer?.gold;
  if (nextGold !== undefined) hub.gold = nextGold;
}

export function applyServerHubSnapshot(
  hub: ClientHubState,
  msg: Extract<ServerMessage, { t: "snapshot" }>,
  localPlayer: PlayerSnapshot | undefined,
): void {
  syncGoldFromSnapshot(hub, msg, localPlayer);
  if (msg.selfFogDelta?.length) { applyFogChunkDeltas(hub.fog, msg.selfFogDelta); hub.fogVersion += 1; }
  if (msg.selfStash) hub.stash = msg.selfStash.map((s) => (s ? { ...s } : null));
  if (msg.selfBounties) hub.bounties = msg.selfBounties.map((b) => ({ ...b }));
  if (msg.selfQuests) hub.quests = msg.selfQuests.map((q) => ({ ...q }));
}

function dispatchOfflineMutation(
  deps: HubActionBridgeDeps,
  run: (ctx: ReturnType<HubActionBridgeDeps["getOfflineCtx"]>) => InventorySnapshot | null,
): boolean {
  const next = run(deps.getOfflineCtx());
  if (!next) return false;
  deps.commitOfflineInv(next);
  return true;
}

function dispatchHubCall(
  deps: HubActionBridgeDeps,
  msg: ClientMessage,
  offlineRun: (ctx: ReturnType<HubActionBridgeDeps["getOfflineCtx"]>) => InventorySnapshot | null,
): boolean {
  if (deps.isServer()) { deps.send(msg); return true; }
  return dispatchOfflineMutation(deps, offlineRun);
}

export function createHubActionClient(deps: HubActionBridgeDeps): HubActionClient {
  return {
    merchantBuy: (offerId, count = 1) => dispatchHubCall(deps, { t: "merchantBuy", offerId, count }, (ctx) => applyOfflineMerchantBuy(ctx, { offerId, count })),
    merchantSell: (slotIndex) => dispatchHubCall(deps, { t: "merchantSell", slotIndex }, (ctx) => applyOfflineMerchantSell(ctx, slotIndex)),
    blacksmithReforge: (slotIndex) => dispatchHubCall(deps, { t: "blacksmithReforge", slotIndex }, (ctx) => applyOfflineBlacksmithOp(ctx, { mode: "reforge", slotIndex })),
    blacksmithUpgrade: (slotIndex) => dispatchHubCall(deps, { t: "blacksmithUpgrade", slotIndex }, (ctx) => applyOfflineBlacksmithOp(ctx, { mode: "upgrade", slotIndex })),
    bountyAccept: (bountyId) => dispatchHubCall(deps, { t: "bountyAccept", bountyId }, (ctx) => applyOfflineObjectiveAction(ctx, { pool: "bounty", mode: "accept", id: bountyId })),
    bountyClaim: (bountyId) => dispatchHubCall(deps, { t: "bountyClaim", bountyId }, (ctx) => applyOfflineObjectiveAction(ctx, { pool: "bounty", mode: "claim", id: bountyId })),
    questAccept: (questId) => dispatchHubCall(deps, { t: "questAccept", questId }, (ctx) => applyOfflineObjectiveAction(ctx, { pool: "quest", mode: "accept", id: questId })),
    questClaim: (questId) => dispatchHubCall(deps, { t: "questClaim", questId }, (ctx) => applyOfflineObjectiveAction(ctx, { pool: "quest", mode: "claim", id: questId })),
    stashQuickMove: (req) => dispatchHubCall(deps, { t: "stashQuickMove", from: req.from, slotIndex: req.slotIndex }, (ctx) => applyOfflineStashMove(ctx, req)),
    stashTakeAll: () => dispatchHubCall(deps, { t: "stashTakeAll" }, (ctx) => applyOfflineStashMove(ctx, "takeAll")),
  };
}

export function buildHubUiCallbacks(client: HubActionClient, audio: AudioEngine): HubUiCallbacks {
  return {
    onMerchantBuy: (offerId, count) => { client.merchantBuy(offerId, count); audio.playUi("click"); },
    onMerchantSell: (slotIndex) => { client.merchantSell(slotIndex); audio.playUi("click"); },
    onBlacksmithReforge: (slotIndex) => { client.blacksmithReforge(slotIndex); audio.playUi("craft"); },
    onBlacksmithUpgrade: (slotIndex) => { client.blacksmithUpgrade(slotIndex); audio.playUi("craft"); },
    onBountyAccept: (bountyId) => { client.bountyAccept(bountyId); audio.playUi("open"); },
    onBountyClaim: (bountyId) => { client.bountyClaim(bountyId); audio.playUi("discover"); },
    onQuestAccept: (questId) => { client.questAccept(questId); audio.playUi("open"); },
    onQuestClaim: (questId) => { client.questClaim(questId); audio.playUi("discover"); },
    onStashQuickMove: (req) => { client.stashQuickMove(req); audio.playUi("click"); },
    onStashTakeAll: () => { client.stashTakeAll(); audio.playUi("equip"); },
  };
}

export function syncHubOverlayFrame(opts: {
  readonly hubs: HubModalController;
  readonly view: WorldViewState;
  readonly events: readonly WorldEvent[];
}): void {
  opts.hubs.sync({
    inv: opts.view.inventory, gold: opts.view.gold, worldSeed: opts.view.cache.worldSeed,
    stash: opts.view.stash, bounties: opts.view.bounties, quests: opts.view.quests,
  });
  if (!opts.hubs.isOpen()) return;
  for (const ev of opts.events) {
    if (ev.kind === "hubNotice" && ev.label) opts.hubs.showNotice(ev.label);
  }
}

export function tryOfflineAdminMutation(opts: {
  readonly req: AdminSendRequest;
  readonly offline: OfflineWorldController;
  readonly slice: OfflineStateSlice;
  readonly commit: (inv: InventorySnapshot) => void;
}): boolean {
  const { req, offline, slice, commit } = opts;
  if (req.action === "give" && req.itemId) {
    commit(offline.giveItem(slice, req.itemId, req.count ?? 1));
    return true;
  }
  if (req.action === "giveGold" && slice.hub) {
    commit(applyOfflineGiveGold({ hub: slice.hub, inv: slice.inventory, player: slice.player, events: slice.events }, req.count ?? 200));
    return true;
  }
  return false;
}
