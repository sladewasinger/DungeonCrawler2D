/** Tracks first-person hotbar selection and publishes discrete gameplay actions. */
import { INTERACT_RANGE, PICKUP_RANGE, type World } from "@dc2d/engine";
import { ReviveGesture } from "../input/revive.js";
import type { Connection } from "../net/connection.js";
import { nearestDownedPartyMember } from "../scenes/dungeon/contentQueries.js";
import { resolveStairwayPrompt } from "../scenes/dungeon/stairwayProximity.js";
import type { ThreeInputSample } from "./ThreeInput.js";
import {
  throwSelectedItem,
  type ThreeInteractionPanels,
  useSelectedOrInteract,
} from "./ThreeSelectedActions.js";

export class ThreeActionController {
  private selectedSlot: number | null = null;
  private readonly revive = new ReviveGesture();

  constructor(
    private readonly connection: Connection,
    private readonly panels?: ThreeInteractionPanels,
  ) {}

  selectHotbar = (slot: number | null): void => {
    this.selectedSlot = slot;
  };

  publish(world: World, sample: ThreeInputSample): void {
    const { yaw, attack, throwItem, giveUp } = sample;
    if (attack) {
      this.connection.attack(-Math.sin(yaw), -Math.cos(yaw));
    }
    this.publishInteraction(world, sample);
    if (throwItem) {
      throwSelectedItem(this.connection, this.selectedSlot, yaw);
    }
    if (giveUp && this.connection.downed) this.connection.suicide();
  }

  private publishInteraction(world: World, sample: ThreeInputSample): void {
    const nowMs = performance.now();
    if (sample.interactPressed) {
      const body = this.connection.body;
      if (body && resolveStairwayPrompt(world, body.x, body.y)) {
        useSelectedOrInteract(this.connection, world, this.selectedSlot, this.panels);
        return;
      }
      const target = body && this.connection.party
        ? nearestDownedPartyMember(
          this.connection.party.members,
          body.x,
          body.y,
          INTERACT_RANGE,
        )
        : undefined;
      if (!this.revive.begin(target?.id, nowMs)) {
        useSelectedOrInteract(
          this.connection,
          world,
          this.selectedSlot,
          this.panels,
          this.pickupNearby(),
        );
      }
    }
    if (sample.interactHeld) {
      if (this.revive.poll(nowMs)) this.connection.interact();
    } else {
      this.revive.end(nowMs);
    }
  }

  private pickupNearby(): boolean {
    const body = this.connection.body;
    if (!body) return false;
    return [...this.connection.entities.values()].some(({ snap }) =>
      snap.kind === "item" &&
      Math.hypot(snap.x - body.x, snap.y - body.y) <= PICKUP_RANGE
    );
  }
}
