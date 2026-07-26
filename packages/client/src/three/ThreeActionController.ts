/** Tracks first-person hotbar selection and publishes discrete gameplay actions. */
import { INTERACT_RANGE, PICKUP_RANGE, type World } from "@dc2d/engine";
import { RespawnGesture } from "../input/respawn.js";
import { ReviveGesture } from "../input/revive.js";
import type { Connection } from "../net/connection.js";
import { canOpenLootChest, nearestLootChest } from "../net/lootChestQuery.js";
import { nearestDownedPartyMember } from "../scenes/dungeon/contentQueries.js";
import { resolveStairwayPrompt } from "../scenes/dungeon/stairwayProximity.js";
import type { ThreeInputSample } from "./ThreeInput.js";
import {
  throwSelectedItem,
  type ThreeInteractionPanels,
  useSelectedOrInteract,
} from "./ThreeSelectedActions.js";

const nearestPlayerId = (
  connection: Connection,
  body: { x: number; y: number },
): string | undefined => [...connection.entities.values()]
  .filter(({ snap }) => snap.kind === "player")
  .map(({ snap }) => ({
    id: snap.id,
    distance: Math.hypot(snap.x - body.x, snap.y - body.y),
  }))
  .filter(({ distance }) => distance <= INTERACT_RANGE)
  .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))[0]?.id;

export class ThreeActionController {
  private selectedSlot: number | null = null;
  private readonly revive = new ReviveGesture();
  private readonly respawn = new RespawnGesture();

  constructor(
    private readonly connection: Connection,
    private readonly panels?: ThreeInteractionPanels,
  ) {}

  selectHotbar = (slot: number | null): void => {
    this.selectedSlot = slot;
  };

  publish(world: World, sample: ThreeInputSample): void {
    if (this.connection.dead) {
      this.publishRespawn(sample);
      return;
    }
    this.respawn.end(performance.now());
    const { yaw, attack, throwItem, bandageOther, giveUp } = sample;
    if (attack) {
      this.connection.attack(-Math.sin(yaw), -Math.cos(yaw));
    }
    this.publishInteraction(world, sample);
    if (throwItem) {
      throwSelectedItem(this.connection, this.selectedSlot, yaw);
    }
    if (bandageOther) this.bandageNearestPlayer();
    if (giveUp && this.connection.downed) this.connection.suicide();
  }

  respawnHoldProgress(): number {
    return this.respawn.progress(this.connection.dead, performance.now());
  }

  private publishRespawn(sample: ThreeInputSample): void {
    const nowMs = performance.now();
    if (sample.interactPressed) this.respawn.begin(true, nowMs);
    if (!sample.interactHeld) {
      this.respawn.end(nowMs);
      return;
    }
    if (this.respawn.poll(true, nowMs, sample.interactHeld)) this.connection.respawnNow();
  }

  private bandageNearestPlayer(): void {
    const body = this.connection.body;
    const slot = this.selectedSlot;
    if (!body || slot === null || this.connection.hotbar[slot] !== "bandage") return;
    if (!this.connection.inventory.some((stack) => stack.item === "bandage" && stack.qty > 0)) return;
    const targetId = nearestPlayerId(this.connection, body);
    if (targetId) this.connection.useSlotOnPlayer(slot, targetId);
  }

  private publishInteraction(world: World, sample: ThreeInputSample): void {
    const nowMs = performance.now();
    if (sample.interactPressed) this.publishInteractionPress(world, nowMs);
    if (sample.interactHeld) {
      if (this.revive.poll(nowMs)) this.connection.interact();
    } else {
      this.revive.end(nowMs);
    }
  }

  private publishInteractionPress(world: World, nowMs: number): void {
    const body = this.connection.body;
    if (body && resolveStairwayPrompt(world, body.x, body.y)) {
      useSelectedOrInteract(this.connection, world, this.selectedSlot, this.panels);
      return;
    }
    if (this.publishLootChest()) return;
    const target = body && this.connection.party
      ? nearestDownedPartyMember(
        this.connection.party.members,
        body.x,
        body.y,
        INTERACT_RANGE,
      )
      : undefined;
    if (this.revive.begin(target?.id, nowMs)) return;
    useSelectedOrInteract(
      this.connection,
      world,
      this.selectedSlot,
      this.panels,
      this.pickupNearby(),
    );
  }

  private publishLootChest(): boolean {
    const chest = nearestLootChest(this.connection);
    if (!chest) return false;
    this.connection.lootChestOp(chest.id, "open");
    if (canOpenLootChest(this.connection, chest)) this.panels?.toggleStash();
    return true;
  }

  private pickupNearby(): boolean {
    const body = this.connection.body;
    if (!body) return false;
    return [...this.connection.entities.values()].some(({ snap }) =>
      (snap.kind === "item" || (snap.kind === "torch" && snap.state === "placed")) &&
      Math.hypot(snap.x - body.x, snap.y - body.y) <= PICKUP_RANGE
    );
  }
}
