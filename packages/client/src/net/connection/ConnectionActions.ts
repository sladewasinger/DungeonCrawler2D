import type { Connection } from "./connection.js";
import { ConnectionState } from "./connectionState.js";
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
  lootChestIntent,
  partyOpIntent,
  pickupIntent,
  reviveIntent,
  stashOpIntent,
  suicideIntent,
  throwTorchIntent,
  useItemIntent,
  useSlotOnPlayerIntent,
  useSlotIntent,
  whoIntent,
} from "./intents.js";

const socialTargetId = (
  connection: Connection,
  nameOrId: string,
): string | undefined => {
  const lower = nameOrId.toLowerCase();
  const matches = socialTargetMatcher(nameOrId, lower);
  return partyTargetId(connection, matches)
    ?? entityTargetId(connection, matches)
    ?? contactTargetId(connection, matches)
    ?? outgoingTargetId(connection, matches);
};

function socialTargetMatcher(nameOrId: string, lower: string) {
  return (id: string | undefined, name: string | undefined): boolean =>
    id === nameOrId || name?.toLowerCase() === lower;
}

type SocialTargetMatcher = ReturnType<typeof socialTargetMatcher>;

function partyTargetId(connection: Connection, matches: SocialTargetMatcher): string | undefined {
  return connection.party?.members.find(({ id, name }) => matches(id, name))?.id;
}

function entityTargetId(connection: Connection, matches: SocialTargetMatcher): string | undefined {
  return [...connection.entities.values()].find(({ snap }) => matches(snap.id, snap.name))?.snap.id;
}

function contactTargetId(connection: Connection, matches: SocialTargetMatcher): string | undefined {
  return connection.contacts.find(({ id, name }) => matches(id, name))?.id;
}

function outgoingTargetId(connection: Connection, matches: SocialTargetMatcher): string | undefined {
  return [...connection.outgoingPartyInvites].find(([id, name]) => matches(id, name))?.[0];
}

export class ConnectionActions extends ConnectionState {
  private get connection(): Connection {
    return this as unknown as Connection;
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
  debugTeleport(x: number, y: number): void { debugTeleportIntent(this.connection, x, y); }
  debugGod(on?: boolean): void { debugGodIntent(this.connection, on); }

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
