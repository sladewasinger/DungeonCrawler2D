import {
  DEBUG_FLAG_NAMES,
  type DebugFlag,
  type DebugFlags,
} from "@dc2d/engine";
import type { Connection } from "../../../net/connection/connection.js";

const LABELS: Record<DebugFlag, string> = {
  hurtboxes: "Hurtboxes",
  attacks: "Attacks",
  guards: "Guards",
  lineOfSight: "Line of Sight",
  behavior: "Behavior",
  search: "Search",
  navigation: "Navigation",
};

/** A private gameplay HUD panel; it never mounts visible controls for non-admins. */
export class AdminDebugPanel {
  readonly element = document.createElement("section");
  private readonly inputs = new Map<DebugFlag, HTMLInputElement>();

  constructor(private readonly connection: Connection) {
    this.element.hidden = true;
    this.element.setAttribute("aria-label", "Admin debug overlays");
    this.element.style.cssText = [
      "position:absolute", "top:12px", "right:12px", "z-index:30",
      "display:grid", "grid-template-columns:repeat(2,max-content)", "gap:6px 12px",
      "padding:10px", "border:1px solid #3d74ae", "border-radius:7px",
      "background:rgba(8,15,26,.88)", "color:#eaf4ff", "font:12px system-ui,sans-serif",
      "pointer-events:auto",
    ].join(";");
    this.element.append(this.heading(), ...DEBUG_FLAG_NAMES.map((flag) => this.control(flag)));
    this.element.addEventListener("change", () => this.publish());
  }

  update(): void {
    const active = this.connection.activeAdmin;
    this.element.hidden = !active;
    if (!active) return;
    for (const flag of DEBUG_FLAG_NAMES) {
      this.inputs.get(flag)!.checked = this.connection.activeAdminDebugFlags[flag];
    }
  }

  dispose(): void {
    this.element.remove();
  }

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
    if (!this.connection.activeAdmin) return;
    this.connection.sendAdminCommand({ op: "debug", flags: this.flags() });
  }

  private flags(): DebugFlags {
    return Object.fromEntries(
      DEBUG_FLAG_NAMES.map((flag) => [flag, this.inputs.get(flag)!.checked]),
    ) as DebugFlags;
  }
}
