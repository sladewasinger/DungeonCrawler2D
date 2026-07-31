import {
  DEBUG_FLAG_NAMES,
  type DebugFlag,
  type DebugFlags,
} from "@dc2d/engine";
import type { Connection } from "../../../net/connection/connection.js";
import type { HudWindowManager } from "../window/layout/HudWindows.js";
import { ADMIN_DEBUG_WINDOW_ID } from "./adminDebugWindow.js";

const LABELS: Record<DebugFlag, string> = {
  hurtboxes: "Hurtboxes",
  attacks: "Hitboxes",
  guards: "Active guards",
  lineOfSight: "Current line of sight",
  behavior: "AI behavior",
  search: "Search state",
  navigation: "Navigation path",
};

/** A private gameplay HUD panel; it never mounts visible controls for non-admins. */
export class AdminDebugPanel {
  readonly element = document.createElement("section");
  private readonly inputs = new Map<DebugFlag, HTMLInputElement>();
  private manager: HudWindowManager | null = null;
  private editing = false;

  constructor(
    private readonly connection: Connection,
    private readonly focusGame: () => void,
  ) {
    this.element.hidden = true;
    this.element.setAttribute("aria-label", "Admin debug overlays");
    this.element.style.cssText = [
      "box-sizing:border-box", "width:100%", "height:100%", "overflow:auto",
      "display:grid", "grid-template-columns:repeat(2,minmax(0,1fr))",
      "align-content:start", "gap:6px 12px",
      "padding:10px", "border:1px solid #3d74ae", "border-radius:7px",
      "background:rgba(8,15,26,.88)", "color:#eaf4ff", "font:12px system-ui,sans-serif",
      "pointer-events:auto",
    ].join(";");
    this.element.append(this.heading(), ...DEBUG_FLAG_NAMES.map((flag) => this.control(flag)));
    this.element.addEventListener("change", this.handleChange);
  }

  attach(manager: HudWindowManager): void {
    this.manager = manager;
  }

  update(): void {
    const active = this.connection.activeAdmin;
    this.manager?.setAvailable(ADMIN_DEBUG_WINDOW_ID, active);
    this.element.hidden = !active;
    if (!active) return;
    for (const flag of DEBUG_FLAG_NAMES) {
      const input = this.inputs.get(flag)!;
      input.checked = this.connection.activeAdminDebugFlags[flag];
      input.disabled = !adminDebugControlsEnabled(active, this.editing);
    }
  }

  setEditing(editing: boolean): void {
    this.editing = editing;
    const enabled = adminDebugControlsEnabled(
      this.connection.activeAdmin,
      editing,
    );
    for (const input of this.inputs.values()) input.disabled = !enabled;
  }

  dispose(): void {
    this.element.removeEventListener("change", this.handleChange);
    this.element.remove();
  }

  private readonly handleChange = (): void => {
    if (!adminDebugControlsEnabled(this.connection.activeAdmin, this.editing)) return;
    this.publish();
    this.focusGame();
  };

  private heading(): HTMLElement {
    const heading = document.createElement("strong");
    heading.textContent = "ADMIN OVERLAYS";
    heading.style.cssText = "grid-column:1/-1;color:#66b3ff";
    return heading;
  }

  private control(flag: DebugFlag): HTMLLabelElement {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.adminDebugFlag = flag;
    this.inputs.set(flag, input);
    label.append(input, ` ${LABELS[flag]}`);
    return label;
  }

  private publish(): void {
    if (!adminDebugControlsEnabled(this.connection.activeAdmin, this.editing)) return;
    publishAdminDebugFlags(this.connection, this.flags());
  }

  private flags(): DebugFlags {
    return Object.fromEntries(
      DEBUG_FLAG_NAMES.map((flag) => [flag, this.inputs.get(flag)!.checked]),
    ) as DebugFlags;
  }
}

type AdminDebugPublisher = Pick<
  Connection,
  "activeAdminDebugFlags" | "sendAdminCommand"
>;

/** Holds the requested state through the round trip; snapshots remain authoritative. */
export function publishAdminDebugFlags(
  connection: AdminDebugPublisher,
  flags: DebugFlags,
): void {
  connection.activeAdminDebugFlags = { ...flags };
  connection.sendAdminCommand({ op: "debug", flags });
}

export function adminDebugControlsEnabled(
  activeAdmin: boolean,
  editing: boolean,
): boolean {
  return activeAdmin && !editing;
}
