import type { Connection } from "./connection.js";
import {
  assignSlotIntent,
  attackIntent,
  chatIntent,
  craftIntent,
  debugGodIntent,
  debugTeleportIntent,
  descendIntent,
  dropIntent,
  equipIntent,
  fistbumpIntent,
  interactIntent,
  moderationIntent,
  partyOpIntent,
  pickupIntent,
  stashOpIntent,
  suicideIntent,
  throwTorchIntent,
  useItemIntent,
  useSlotIntent,
  whoIntent,
} from "./intents.js";

export class ConnectionActions {
  private get connection(): Connection {
    return this as unknown as Connection;
  }

  attack(dirX: number, dirY: number): void { attackIntent(this.connection, dirX, dirY); }
  throwTorch(dirX: number, dirY: number): void { throwTorchIntent(this.connection, dirX, dirY); }
  useSlot(slot: number, targetX?: number, targetY?: number): void {
    useSlotIntent(this.connection, slot, targetX, targetY);
  }
  useItem(item: string): void { useItemIntent(this.connection, item); }
  pickup(): void { pickupIntent(this.connection); }
  drop(item: string): void { dropIntent(this.connection, item); }
  assignSlot(slot: number, item: string | null): void {
    assignSlotIntent(this.connection, slot, item);
  }
  equip(item: string | null): void { equipIntent(this.connection, item); }
  interact(): void { interactIntent(this.connection); }
  descend(): void { descendIntent(this.connection); }
  craft(recipe: string): void { craftIntent(this.connection, recipe); }
  stashOp(op: "put" | "take", index: number): void {
    stashOpIntent(this.connection, op, index);
  }
  partyOp(op: "invite" | "accept" | "decline" | "leave" | "kick", target?: string): void {
    partyOpIntent(this.connection, op, target);
  }

  partyCommand(op: "leave" | "kick", targetName?: string): void {
    const target = op === "kick" ? this.resolveSocialTarget(targetName) : undefined;
    if (op === "kick" && !target) return;
    this.partyOp(op, target);
  }

  moderate(
    op: "mute" | "unmute" | "block" | "unblock" | "report",
    targetName: string,
    reason?: string,
  ): void {
    moderationIntent(this.connection, op, targetName, reason);
  }

  chat(channel: "party" | "local" | "global" | "dm", text: string, target?: string): void {
    chatIntent(this.connection, channel, text, target);
  }
  fistbump(targetId: string): void { fistbumpIntent(this.connection, targetId); }
  who(): void { whoIntent(this.connection); }
  suicide(): void { suicideIntent(this.connection); }
  debugTeleport(x: number, y: number): void { debugTeleportIntent(this.connection, x, y); }
  debugGod(on = true): void { debugGodIntent(this.connection, on); }

  private resolveSocialTarget(nameOrId?: string): string | undefined {
    const connection = this.connection;
    if (!nameOrId) {
      connection.pushToast("Choose a player");
      return undefined;
    }
    const lower = nameOrId.toLowerCase();
    const party = connection.party?.members.find(
      (member) => member.id === nameOrId || member.name.toLowerCase() === lower,
    );
    const entity = [...connection.entities.values()].find(
      (remote) => remote.snap.id === nameOrId || remote.snap.name?.toLowerCase() === lower,
    )?.snap;
    const contact = connection.contacts.find(
      (entry) => entry.id === nameOrId || entry.name.toLowerCase() === lower,
    );
    const id = party?.id ?? entity?.id ?? contact?.id;
    if (!id) connection.pushToast(`Player "${nameOrId}" is not visible or online`);
    return id;
  }
}
