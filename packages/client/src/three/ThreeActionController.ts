/** Tracks first-person hotbar selection and publishes discrete gameplay actions. */
import type { World } from "@dc2d/engine";
import type { Connection } from "../net/connection.js";
import type { ThreeInputSample } from "./ThreeInput.js";
import {
  throwSelectedItem,
  useSelectedOrInteract,
} from "./ThreeSelectedActions.js";

export class ThreeActionController {
  private selectedSlot: number | null = null;

  constructor(private readonly connection: Connection) {}

  selectHotbar = (slot: number | null): void => {
    this.selectedSlot = slot;
  };

  publish(world: World, sample: ThreeInputSample): void {
    const { yaw, attack, interact, throwItem, giveUp } = sample;
    if (attack) {
      this.connection.attack(-Math.sin(yaw), -Math.cos(yaw));
    }
    if (interact) {
      useSelectedOrInteract(this.connection, world, this.selectedSlot);
    }
    if (throwItem) {
      throwSelectedItem(this.connection, this.selectedSlot, yaw);
    }
    if (giveUp && this.connection.downed) this.connection.suicide();
  }
}
