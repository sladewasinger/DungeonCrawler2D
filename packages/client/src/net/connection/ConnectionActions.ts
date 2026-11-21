import type { AdminCommand } from "@dc2d/engine";
import type { Connection } from "./connection.js";
import { ConnectionState } from "./connectionState.js";
import { socialTargetId } from "./socialTargetResolver.js";
import {
  assignSlotIntent,
  attackIntent,
  chatIntent,
  craftIntent,
  debugGodIntent,
  debugNoclipIntent,
  debugTeleportIntent,
  descendIntent,
  dropIntent,
  equipIntent,
  fistbumpIntent,
  interactIntent,
  moderationIntent,
  lootChestIntent,
  partyOpIntent,
  pickupIntent,
  reviveIntent,
  rescueIntent,
  stashOpIntent,
  suicideIntent,
  throwTorchIntent,
  useItemIntent,
  useSlotOnPlayerIntent,
  useSlotIntent,
  whoIntent,
} from "./intents.js";

export class ConnectionActions extends ConnectionState {
  private get connection(): Connection {
    return this as unknown as Connection;
  }

  /** Admin token travels only in an authenticated WebSocket message body. */
  authenticateAdmin(token: string): void {
    this.connection.send({ type: "adminAuth", token });
  }

  resumeAdmin(sessionKey: string): void {
    this.connection.send({ type: "adminResume", sessionKey });
  }

  logoutAdmin(): void {
    this.connection.send({ type: "adminLogout" });
  }

  sendAdminCommand(command: AdminCommand, requestId?: string): void {
    this.connection.send({
      type: "adminCommand",
      command,
      ...(requestId ? { requestId } : {}),
    });
  }

  attack(dirX: number, dirY: number): void {
    this.connection.contextualActionsUsed.add("attack");
    attackIntent(this.connection, dirX, dirY);
  }
  throwTorch(dirX: number, dirY: number): void { throwTorchIntent(this.connection, dirX, dirY); }
  useSlot(slot: number, targetX?: number, targetY?: number): void {
    useSlotIntent({ conn: this.connection, slot, targetX, targetY });
  }
  useSlotOnPlayer(slot: number, targetId: string): void {
    useSlotOnPlayerIntent(this.connection, slot, targetId);
  }
  useItem(item: string): void { useItemIntent(this.connection, item); }
  pickup(): void { pickupIntent(this.connection); }
  drop(item: string): void { dropIntent(this.connection, item); }
  assignSlot(slot: number, item: string | null): void {
    assignSlotIntent(this.connection, slot, item);
  }
  equip(item: string | null): void { equipIntent(this.connection, item); }
  interact(): void { interactIntent(this.connection); }
  revive(targetId: string, held: boolean): void { reviveIntent(this.connection, targetId, held); }
  descend(): void { descendIntent(this.connection); }
  craft(recipe: string): void { craftIntent(this.connection, recipe); }
  stashOp(op: "put" | "take", index: number): void {
    stashOpIntent(this.connection, op, index);
  }
  lootChestOp(chestId: string, op: "open" | "take" | "takeAll" | "close", item?: string): void {
    lootChestIntent({ conn: this.connection, chestId, op, item });
  }
  closeLootChest(): void {
    const context = this.connection.stashContext;
    if (context.kind === "loot" && context.chestId) {
      this.lootChestOp(context.chestId, "close");
    }
    this.connection.stashContext = { kind: "personal", chestId: null };
  }
  partyOp(op: "invite" | "accept" | "decline" | "cancel" | "leave" | "kick", target?: string): void {
    partyOpIntent(this.connection, op, target);
  }

  partyCommand(
    op: "invite" | "accept" | "decline" | "cancel" | "leave" | "kick",
    targetName?: string,
  ): void {
    const targeted = op === "invite" || op === "cancel" || op === "kick";
    const target = targeted ? this.resolveSocialTarget(targetName) : undefined;
    if (targeted && !target) return;
    this.partyOp(op, target);
  }

  moderate(
    op: "mute" | "unmute" | "block" | "unblock" | "report",
    targetName: string,
    reason?: string,
  ): void {
    moderationIntent({ conn: this.connection, op, target: targetName, reason });
  }

  chat(channel: "party" | "local" | "global" | "dm", text: string, target?: string): void {
    chatIntent({ conn: this.connection, channel, text, target });
  }
  fistbump(targetId: string): void { fistbumpIntent(this.connection, targetId); }
  who(): void { whoIntent(this.connection); }
  suicide(): void { suicideIntent(this.connection); }
  rescue(): void { rescueIntent(this.connection); }
  debugTeleport(x: number, y: number): void { debugTeleportIntent(this.connection, x, y); }
  debugGod(on?: boolean): void { debugGodIntent(this.connection, on); }
  debugNoclip(on?: boolean): void { debugNoclipIntent(this.connection, on); }

  private resolveSocialTarget(nameOrId?: string): string | undefined {
    const connection = this.connection;
    if (!nameOrId) {
      connection.pushToast("Choose a player");
      return undefined;
    }
    const id = socialTargetId(connection, nameOrId);
    if (!id) connection.pushToast(`Player "${nameOrId}" is not visible or online`);
    return id;
  }
}
