/** Tracks first-person hotbar selection and publishes discrete gameplay actions. */
import { INTERACT_RANGE, PICKUP_RANGE, type World } from "@dc2d/engine";
import { GiveUpGesture } from "../../input/gestures/giveUp.js";
import { ReviveGesture } from "../../input/gestures/revive.js";
import type { Connection } from "../../net/connection/connection.js";
import { canOpenLootChest, nearestLootChest } from "../../net/queries/lootChestQuery.js";
import { nearestDownedPartyMember } from "../../scenes/dungeon/world/contentQueries.js";
import { resolveStairwayPrompt } from "../../scenes/dungeon/world/stairwayProximity.js";
import type { ThreeInputSample } from "../input/ThreeInput.js";
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
  private readonly giveUp = new GiveUpGesture();

  constructor(
    private readonly connection: Connection,
    private readonly panels?: ThreeInteractionPanels,
  ) {}

  selectHotbar = (slot: number | null): void => {
    this.selectedSlot = slot;
  };

  publish(world: World, sample: ThreeInputSample): void {
    if (this.connection.dead) {
      this.giveUp.end(performance.now());
      return;
    }
    if (this.connection.downed) {
      this.publishGiveUp(sample);
      return;
    }
    this.giveUp.end(performance.now());
    const { yaw, attack, throwItem, bandageOther } = sample;
    if (attack) {
      this.connection.attack(-Math.sin(yaw), -Math.cos(yaw));
    }
    this.publishInteraction(world, sample);
    if (throwItem) {
      throwSelectedItem(this.connection, this.selectedSlot, yaw);
    }
    if (bandageOther) this.bandageNearestPlayer();
  }

  giveUpHoldProgress(): number {
    return this.giveUp.progress(this.connection.downed, performance.now());
  }

  private publishGiveUp(sample: ThreeInputSample): void {
    const nowMs = performance.now();
    if (sample.interactPressed) this.giveUp.begin(true, nowMs);
    if (!sample.interactHeld) {
      this.giveUp.end(nowMs);
      return;
    }
    if (this.giveUp.poll(true, nowMs)) this.connection.suicide();
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
    if (!sample.interactHeld) {
      const targetId = this.revive.end(nowMs);
      if (targetId) this.connection.revive(targetId, false);
    }
  }

  private publishInteractionPress(world: World, nowMs: number): void {
    const body = this.connection.body;
    if (body && resolveStairwayPrompt(world, body.x, body.y)) {
      useSelectedOrInteract({ connection: this.connection, world, slot: this.selectedSlot, panels: this.panels });
      return;
    }
    if (this.publishLootChest()) return;
    if (this.beginRevive(nowMs)) return;
    useSelectedOrInteract({
      connection: this.connection,
      world,
      slot: this.selectedSlot,
      panels: this.panels,
      pickupNearby: this.pickupNearby(),
    });
  }

  private beginRevive(nowMs: number): boolean {
    const target = this.nearbyDownedPartyMember();
    if (!this.revive.begin(target?.id, nowMs)) return false;
    this.connection.revive(target?.id ?? "", true);
    return true;
  }

  private nearbyDownedPartyMember(): { id: string; x: number; y: number; downed: boolean } | undefined {
    const body = this.connection.body;
    if (!body) return undefined;
    return nearestDownedPartyMember({
      members: [...this.connection.entities.values()]
        .map(({ snap }) => snap)
        .filter((snap) => snap.kind === "player" && snap.downed)
        .map((snap) => ({ id: snap.id, x: snap.x, y: snap.y, downed: true })),
      fromX: body.x,
      fromY: body.y,
      maxDistance: INTERACT_RANGE,
    });
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
