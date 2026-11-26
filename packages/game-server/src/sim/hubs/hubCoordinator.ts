/** WorldSim hub action dispatcher, kill/chest/discovery reward coordinator, and toast notifications. */
import { rollGoldDrop } from "@dc2d/content";
import type { ActiveBountyState, ActiveQuestState, ClientMessage, DangerTier, WorldChunkCache, WorldEvent } from "@dc2d/engine";
import { BountyAndQuestTracker } from "./bountyTracker.js";
import {
  executeBlacksmithReforge, executeBlacksmithUpgrade, executeMerchantBuy, executeMerchantSell,
  findNearestHubStation, isNearHubStationKind,
} from "./npcManager.js";
import { StashManager } from "./stashManager.js";
import type { CombatWorld } from "../combatSim.js";
import type { SimPlayer } from "../survival/worldPersistenceSync.js";

function emitNotice(opts: { readonly events: WorldEvent[]; readonly player: SimPlayer; readonly label: string; readonly subtitle?: string }): void {
  opts.events.push({ kind: "hubNotice", x: opts.player.x, y: opts.player.y, actorId: opts.player.id, label: opts.label, ...(opts.subtitle ? { subtitle: opts.subtitle } : {}) });
}

function checkReadyBounties(opts: { readonly prev: readonly ActiveBountyState[]; readonly next: readonly ActiveBountyState[]; readonly player: SimPlayer; readonly events: WorldEvent[] }): void {
  for (let i = 0; i < opts.next.length; i++) {
    const b = opts.next[i]; const p = opts.prev[i];
    if (b && p && b.accepted && !b.claimed && p.progress < p.required && b.progress >= b.required) {
      emitNotice({ events: opts.events, player: opts.player, label: "Bounty Ready — Return to Hub", subtitle: b.title });
    }
  }
}

interface HubDispatchCtx {
  readonly hubs: WorldHubCoordinator; readonly worldSeed: number;
  readonly msg: ClientMessage; readonly player: SimPlayer; readonly cache: WorldChunkCache; readonly events: WorldEvent[];
}
type HubHandler = (c: HubDispatchCtx) => boolean;

function applyTradeResult(c: HubDispatchCtx, res: { readonly ok: boolean; readonly gold: number; readonly inventory: SimPlayer["inventory"]; readonly message: string }): boolean {
  emitNotice({ events: c.events, player: c.player, label: res.message });
  if (!res.ok) return false;
  c.player.gold = res.gold; c.player.inventory = res.inventory; c.player.hubRev += 1;
  return true;
}

function checkNearOrWarn(c: HubDispatchCtx, station: "merchant" | "blacksmith" | "bounty-board" | "guide" | "stash", msg: string): boolean {
  if (isNearHubStationKind(c.cache, c.player, [station])) return true;
  emitNotice({ events: c.events, player: c.player, label: msg });
  return false;
}

const HUB_HANDLERS: Partial<Record<ClientMessage["t"], HubHandler>> = {
  interactNpc: (c) => { if (!findNearestHubStation(c.cache, c.player)) emitNotice({ events: c.events, player: c.player, label: "Move closer to interact" }); else c.player.hubRev += 1; return false; },
  merchantBuy: (c) => c.msg.t === "merchantBuy" && checkNearOrWarn(c, "merchant", "Move closer to Merchant") && applyTradeResult(c, executeMerchantBuy({ gold: c.player.gold, inventory: c.player.inventory, offerId: c.msg.offerId, count: c.msg.count, worldSeed: c.worldSeed })),
  merchantSell: (c) => c.msg.t === "merchantSell" && checkNearOrWarn(c, "merchant", "Move closer to Merchant") && applyTradeResult(c, executeMerchantSell({ gold: c.player.gold, inventory: c.player.inventory, slotIndex: c.msg.slotIndex })),
  blacksmithReforge: (c) => c.msg.t === "blacksmithReforge" && checkNearOrWarn(c, "blacksmith", "Move closer to Blacksmith") && applyTradeResult(c, executeBlacksmithReforge({ gold: c.player.gold, inventory: c.player.inventory, slotIndex: c.msg.slotIndex, rollSeed: c.worldSeed + c.player.gold + c.player.hubRev * 31 })),
  blacksmithUpgrade: (c) => c.msg.t === "blacksmithUpgrade" && checkNearOrWarn(c, "blacksmith", "Move closer to Blacksmith") && applyTradeResult(c, executeBlacksmithUpgrade({ gold: c.player.gold, inventory: c.player.inventory, slotIndex: c.msg.slotIndex })),
  stashTransfer: (c) => {
    if (c.msg.t !== "stashTransfer" || !isNearHubStationKind(c.cache, c.player, ["stash"])) return false;
    const ok = c.hubs.stash.transfer({ accountId: c.player.accountId, invSlots: c.player.inventory.slots, ...c.msg });
    if (ok) c.player.hubRev += 1;
    return ok;
  },
  stashQuickMove: (c) => {
    if (c.msg.t !== "stashQuickMove" || !isNearHubStationKind(c.cache, c.player, ["stash"])) return false;
    const ok = c.hubs.stash.quickMove({ accountId: c.player.accountId, invSlots: c.player.inventory.slots, ...c.msg });
    if (ok) c.player.hubRev += 1;
    return ok;
  },
  stashTakeAll: (c) => {
    if (!isNearHubStationKind(c.cache, c.player, ["stash"])) return false;
    const moved = c.hubs.stash.takeAll({ accountId: c.player.accountId, invSlots: c.player.inventory.slots });
    if (moved > 0) c.player.hubRev += 1;
    return moved > 0;
  },
  bountyAccept: (c) => {
    if (c.msg.t !== "bountyAccept" || !checkNearOrWarn(c, "bounty-board", "Move closer to Bounty Board")) return false;
    const ok = c.hubs.tracker.acceptBounty(c.player.accountId, c.msg.bountyId);
    if (ok) c.player.hubRev += 1;
    return ok;
  },
  bountyClaim: (c) => {
    if (c.msg.t !== "bountyClaim" || !checkNearOrWarn(c, "bounty-board", "Move closer to Bounty Board")) return false;
    const r = c.hubs.tracker.claimBounty({ accountId: c.player.accountId, bountyId: c.msg.bountyId, gold: c.player.gold, inventory: c.player.inventory });
    if (!r.ok) { emitNotice({ events: c.events, player: c.player, label: r.error ?? "Cannot claim bounty" }); return false; }
    c.player.gold = r.gold; c.player.hubRev += 1; emitNotice({ events: c.events, player: c.player, label: `Bounty Claimed (+${r.rewardGold} Gold)` }); return true;
  },
  questAccept: (c) => {
    if (c.msg.t !== "questAccept" || !checkNearOrWarn(c, "guide", "Move closer to Floor Guide")) return false;
    const ok = c.hubs.tracker.acceptQuest(c.player.accountId, c.msg.questId);
    if (ok) c.player.hubRev += 1;
    return ok;
  },
  questClaim: (c) => {
    if (c.msg.t !== "questClaim" || !checkNearOrWarn(c, "guide", "Move closer to Floor Guide")) return false;
    const r = c.hubs.tracker.claimQuest({ accountId: c.player.accountId, questId: c.msg.questId, gold: c.player.gold, inventory: c.player.inventory });
    if (!r.ok) { emitNotice({ events: c.events, player: c.player, label: r.error ?? "Cannot claim quest" }); return false; }
    c.player.gold = r.gold; c.player.hubRev += 1; emitNotice({ events: c.events, player: c.player, label: `Quest Complete (+${r.rewardGold} Gold)` }); return true;
  },
};

export function attachHubCombatHooks(opts: {
  readonly combat: CombatWorld; readonly hubs: WorldHubCoordinator; readonly playerForId: (id: string) => SimPlayer | undefined;
}): void {
  const ev: WorldEvent[] = [];
  const flush = () => { for (const e of ev.splice(0)) opts.combat.pushEvent(e); };
  opts.combat.ecology.onCreatureKilled = (k) => {
    opts.hubs.onEnemyKilled({ killer: k.killerId ? opts.playerForId(k.killerId) : undefined, enemyKind: k.kind, dangerTier: k.dangerTier, isElite: k.isElite, x: k.x, y: k.y, events: ev });
    flush();
  };
  opts.combat.ecology.loot.onChestFirstOpen = (p, c) => {
    const sp = opts.playerForId(p.id);
    if (sp) { opts.hubs.onChestOpened({ player: sp, poiKind: c.poiKind, x: c.x, y: c.y, events: ev }); flush(); }
  };
  opts.combat.onDiscoveryEvent = (d) => { opts.hubs.onWorldObjective({ player: opts.playerForId(d.playerId), kind: d.kind, events: ev }); flush(); };
}

export class WorldHubCoordinator {
  readonly stash = new StashManager();
  readonly tracker: BountyAndQuestTracker;
  constructor(private readonly worldSeed: number) { this.tracker = new BountyAndQuestTracker(worldSeed); }

  hydrateAccount(accountId: string, saved?: {
    readonly stashSlots?: Parameters<StashManager["hydrate"]>[1] | undefined;
    readonly bounties?: readonly ActiveBountyState[] | undefined;
    readonly quests?: readonly ActiveQuestState[] | undefined;
  }): void {
    this.stash.hydrate(accountId, saved?.stashSlots);
    this.tracker.hydratePlayer(accountId, { bounties: saved?.bounties, quests: saved?.quests });
  }
  exportAccountExtras(accountId: string) { return { stashSlots: this.stash.snapshot(accountId), bounties: this.tracker.bountiesFor(accountId), quests: this.tracker.questsFor(accountId) }; }

  onEnemyKilled(opts: { readonly killer?: SimPlayer | undefined; readonly enemyKind: string; readonly dangerTier: DangerTier; readonly isElite: boolean; readonly x: number; readonly y: number; readonly events: WorldEvent[] }): void {
    if (!opts.killer) return;
    const unitRoll = (Math.abs(Math.sin((opts.x + opts.y) * 19.37)) * 100) % 1;
    const gold = rollGoldDrop({ tier: opts.dangerTier, isElite: opts.isElite, unitRoll });
    opts.killer.gold += gold; opts.killer.hubRev += 1;
    opts.events.push({ kind: "goldGain", x: opts.x, y: opts.y, actorId: opts.killer.id, value: gold });
    const prev = this.tracker.bountiesFor(opts.killer.accountId);
    if (this.tracker.recordKill(opts.killer.accountId, opts.enemyKind)) checkReadyBounties({ prev, next: this.tracker.bountiesFor(opts.killer.accountId), player: opts.killer, events: opts.events });
  }

  onChestOpened(opts: { readonly player: SimPlayer; readonly poiKind: string; readonly x: number; readonly y: number; readonly events: WorldEvent[] }): void {
    if (opts.poiKind === "player-chest") return;
    const gold = rollGoldDrop({ tier: 2, isElite: false, unitRoll: 0.45 });
    opts.player.gold += gold; opts.player.hubRev += 1;
    opts.events.push({ kind: "goldGain", x: opts.x, y: opts.y, actorId: opts.player.id, value: gold });
    const prev = this.tracker.bountiesFor(opts.player.accountId);
    if (this.tracker.recordObjective(opts.player.accountId, "clear-camp", 1)) checkReadyBounties({ prev, next: this.tracker.bountiesFor(opts.player.accountId), player: opts.player, events: opts.events });
  }

  onWorldObjective(opts: { readonly player?: SimPlayer | undefined; readonly kind: "discover" | "attune-waystone"; readonly events: WorldEvent[] }): void {
    if (!opts.player) return;
    const prev = this.tracker.bountiesFor(opts.player.accountId);
    if (this.tracker.recordObjective(opts.player.accountId, opts.kind, 1)) {
      opts.player.hubRev += 1;
      checkReadyBounties({ prev, next: this.tracker.bountiesFor(opts.player.accountId), player: opts.player, events: opts.events });
    }
  }

  handleMessage(opts: { readonly msg: ClientMessage; readonly player: SimPlayer; readonly cache: WorldChunkCache; readonly events: WorldEvent[] }): boolean {
    const fn = HUB_HANDLERS[opts.msg.t];
    return fn ? fn({ ...opts, hubs: this, worldSeed: this.worldSeed }) : false;
  }
}
