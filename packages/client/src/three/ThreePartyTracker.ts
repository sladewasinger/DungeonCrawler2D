/** Renders labeled party bearings and distances inside a managed HUD window. */
import type { Connection } from "../net/connection.js";
import { resolvePartyNavigation } from "../ui/partyNavigation.js";
import type { FirstPersonState } from "./movement.js";
import { HUD_PANEL, createHudTitle } from "./ThreeHudStyles.js";

const MAX_VISIBLE_MEMBERS = 6;

export class ThreePartyTracker {
  readonly element = document.createElement("div");
  private readonly rows: HTMLDivElement[] = [];

  constructor() {
    this.element.style.cssText = `${HUD_PANEL};display:grid;align-content:start;gap:4px`;
    this.element.append(createHudTitle("Party"));
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
    this.element.style.visibility = members.length > 0 ? "visible" : "hidden";
    const viewBearingDeg = (-yaw * 180) / Math.PI;
    this.rows.forEach((row, index) => {
      const member = members[index];
      row.hidden = !member;
      if (!member) return;
      const navigation = resolvePartyNavigation(
        { x: player.x, y: player.z },
        member,
        viewBearingDeg,
      );
      row.textContent =
        `${navigation.arrow} ${member.name} · ${navigation.distance}m` +
        `${member.downed ? " · DOWNED" : ""}`;
      row.style.color = member.downed ? "#e96a6a" : "";
    });
  }
}
