/** Pure action dispatchers for character, chat, consumables, drops, and sequence gates in WorldClient. */
import { CHAT_BUBBLE_DURATION_SEC, type CharacterAppearance, type ChatEntry, type ClientMessage, type DropItemRequest, type InventorySnapshot, type PlayerSnapshot, type WorldChestSnapshot } from "@dc2d/engine";
import { sanitizeCharacterName, saveCharacterPrefs } from "../characterPrefs.js";
import { applyDropToClientState, applyUseItemClient } from "../clientInventory.js";
import type { OfflineStateSlice, OfflineWorldController } from "../offline/offlineWorldController.js";
import type { ConnectionMode } from "../worldClientHelpers.js";
import { buildLocalChatDispatch } from "./worldClientSocket.js";
import { runClientChestTakeAll, runClientChestTransfer } from "./worldClientView.js";
import type { PendingGate } from "../actionGate.js";

export function dispatchCharacterAppearance(opts: {
  readonly req: { readonly name: string; readonly appearance: CharacterAppearance };
  readonly localPlayer: PlayerSnapshot;
  readonly seq: number;
  readonly send: (msg: ClientMessage) => void;
}): { readonly player: PlayerSnapshot; readonly gate?: PendingGate } {
  const name = sanitizeCharacterName(opts.req.name);
  saveCharacterPrefs({ name, appearance: opts.req.appearance });
  opts.send({ t: "setAppearance", name, appearance: opts.req.appearance, seq: opts.seq });
  return {
    player: { ...opts.localPlayer, name, appearance: opts.req.appearance },
    ...(opts.seq > 0 ? { gate: { pendingSeq: opts.seq, atMs: performance.now() } } : {}),
  };
}

export function dispatchDropAction(opts: {
  readonly inv: InventorySnapshot;
  readonly chests: readonly WorldChestSnapshot[];
  readonly req: DropItemRequest;
  readonly seq: number;
  readonly commit: (inv: InventorySnapshot, chests: readonly WorldChestSnapshot[]) => void;
  readonly send: (msg: ClientMessage) => void;
}): void {
  const next = applyDropToClientState({ inv: opts.inv, chests: opts.chests, req: opts.req });
  opts.commit(next.inv, [...next.chests]);
  opts.send({ t: "dropItem", ...opts.req, seq: opts.seq });
}

export function dispatchUseItemAction(opts: {
  readonly slotIndex: number;
  readonly inv: InventorySnapshot;
  readonly mode: ConnectionMode;
  readonly seq: number;
  readonly offline: OfflineWorldController;
  readonly slice: () => OfflineStateSlice;
  readonly updateInv: (next: InventorySnapshot) => void;
  readonly setPlayer: (p: PlayerSnapshot) => void;
  readonly send: (msg: ClientMessage) => void;
}): void {
  const itemId = opts.inv.slots[opts.slotIndex]?.itemId;
  opts.updateInv(applyUseItemClient(opts.inv, opts.slotIndex));
  if (opts.mode !== "server") {
    opts.setPlayer(opts.offline.useConsumable(opts.slice(), itemId));
    return;
  }
  opts.send({ t: "useItem", slotIndex: opts.slotIndex, seq: opts.seq });
}

export function dispatchChatAction(opts: {
  readonly rawText: string;
  readonly shout: boolean;
  readonly player: PlayerSnapshot;
  readonly mode: ConnectionMode;
  readonly seq: number;
  readonly send: (msg: ClientMessage) => void;
  readonly onLocalEcho: (echo: { readonly player: PlayerSnapshot; readonly entry: ChatEntry; readonly bubbleSec: number }) => void;
}): void {
  const out = buildLocalChatDispatch({ rawText: opts.rawText, shout: opts.shout, durationSec: CHAT_BUBBLE_DURATION_SEC, player: opts.player });
  if (!out) return;
  if (opts.mode === "server") {
    opts.send({ t: "chat", text: out.clean, ...(opts.shout ? { shout: true } : {}), seq: opts.seq });
    return;
  }
  opts.onLocalEcho({ ...out.echo, bubbleSec: CHAT_BUBBLE_DURATION_SEC });
}

export function dispatchChestTransferAction(opts: {
  readonly chests: readonly WorldChestSnapshot[];
  readonly inv: InventorySnapshot;
  readonly req: { readonly chestId: string; readonly from: "chest" | "inv"; readonly fromSlot: number; readonly to: "chest" | "inv"; readonly toSlot: number; readonly quick?: boolean | undefined };
  readonly seq: number;
  readonly commit: (inv: InventorySnapshot, chests: readonly WorldChestSnapshot[]) => void;
  readonly send: (msg: ClientMessage) => void;
}): boolean {
  const { next, rejectedQuick } = runClientChestTransfer({ chests: opts.chests, inv: opts.inv, req: opts.req });
  if (rejectedQuick) return false;
  if (next?.changed) opts.commit(next.inv, next.chests);
  opts.send({ t: "chestTransfer", ...opts.req, seq: opts.seq });
  return next ? next.changed : true;
}

export function dispatchChestTakeAllAction(opts: {
  readonly chests: readonly WorldChestSnapshot[];
  readonly chestId: string;
  readonly inv: InventorySnapshot;
  readonly seq: number;
  readonly commit: (inv: InventorySnapshot, chests: readonly WorldChestSnapshot[]) => void;
  readonly send: (msg: ClientMessage) => void;
}): boolean {
  const { next, blocked } = runClientChestTakeAll(opts.chests, opts.chestId, opts.inv);
  if (blocked) return false;
  if (next?.changed) opts.commit(next.inv, next.chests);
  opts.send({ t: "chestTakeAll", chestId: opts.chestId, seq: opts.seq });
  return true;
}
