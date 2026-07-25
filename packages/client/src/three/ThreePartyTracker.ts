/** Renders labeled party bearings and distances inside a managed HUD window. */
import { INTERACT_RANGE } from "@dc2d/engine";
import type { Connection } from "../net/connection.js";
import { resolvePartyNavigation } from "../ui/partyNavigation.js";
import { partyPresence } from "../ui/partyPresence.js";
import type { FirstPersonState } from "./movement.js";
import { HUD_PANEL, createHudTitle } from "./ThreeHudStyles.js";

const MAX_VISIBLE_MEMBERS = 6;

export class ThreePartyTracker {
  readonly element = document.createElement("div");
  private readonly title = createHudTitle("Party");
  private readonly rows: HTMLDivElement[] = [];

  constructor() {
    this.element.style.cssText = `${HUD_PANEL};display:grid;align-content:start;gap:4px`;
    this.element.append(this.title);
    for (let index = 0; index < MAX_VISIBLE_MEMBERS; index += 1) {
      const row = document.createElement("div");
      row.hidden = true;
      this.rows.push(row);
      this.element.append(row);
    }
  }

  update(
    connection: Connection,
    player: FirstPersonState,
    yaw: number,
  ): void {
    const members = connection.party?.members.slice(0, MAX_VISIBLE_MEMBERS) ?? [];
    this.title.textContent = connection.party?.leaderId === connection.welcome?.playerId
      ? "Party · You lead"
      : "Party";
    this.element.style.visibility = members.length > 0 ? "visible" : "hidden";
    const viewBearingDeg = (-yaw * 180) / Math.PI;
    this.rows.forEach((row, index) => {
      const member = members[index];
      row.hidden = !member;
      if (!member) return;
      const presence = partyPresence(member.name, member.disconnected === true);
      if (member.disconnected) {
        row.textContent = presence.label;
        row.style.color = presence.color ?? "";
        return;
      }
      const navigation = resolvePartyNavigation(
        { x: player.x, y: player.z },
        member,
        viewBearingDeg,
      );
      const leader = connection.party?.leaderId === member.id ? " · LEADER" : "";
      const downed = member.downed
        ? navigation.distance <= INTERACT_RANGE ? " · REVIVE [E]" : " · DOWNED"
        : "";
      row.textContent =
        `${navigation.arrow} ${presence.label} · ${navigation.distance}m${leader}${downed}`;
      row.style.color = member.downed ? "#e96a6a" : "";
    });
  }
}
