/** Renders labeled party bearings and distances for the first-person HUD. */
import type { Connection } from "../net/connection.js";
import { resolvePartyNavigation } from "../ui/partyNavigation.js";
import type { FirstPersonState } from "./movement.js";

const MAX_VISIBLE_MEMBERS = 6;

export class ThreePartyTracker {
  readonly element = document.createElement("div");
  private readonly rows: HTMLDivElement[] = [];

  constructor(parent: HTMLElement) {
    this.element.style.cssText =
      "position:absolute;top:12px;left:50%;translate:-50% 0;display:grid;gap:4px;" +
      "min-width:150px;padding:7px 9px;background:rgba(12,13,22,.62);border:1px solid rgba(113,117,139,.6);" +
      "font:11px monospace;pointer-events:none";
    this.element.hidden = true;
    for (let index = 0; index < MAX_VISIBLE_MEMBERS; index += 1) {
      const row = document.createElement("div");
      row.hidden = true;
      this.rows.push(row);
      this.element.append(row);
    }
    parent.append(this.element);
  }

  update(connection: Connection, player: FirstPersonState, yaw: number): void {
    const members = connection.party?.members.slice(0, MAX_VISIBLE_MEMBERS) ?? [];
    this.element.hidden = members.length === 0;
    if (members.length === 0) return;
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
      row.textContent = `${navigation.arrow} ${member.name} · ${navigation.distance}m${member.downed ? " · DOWNED" : ""}`;
      row.style.color = member.downed ? "#e96a6a" : "";
    });
  }
}
