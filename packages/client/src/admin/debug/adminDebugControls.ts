import {
  DEBUG_FLAG_NAMES,
  type DebugFlag,
  type DebugFlags,
} from "@dc2d/engine";
import { title } from "../adminPagePrimitives.js";

export interface AdminDebugControls {
  readonly root: HTMLElement;
  readonly inputs: Readonly<Record<DebugFlag, HTMLInputElement>>;
}

export function createAdminDebugControls(): AdminDebugControls {
  const root = document.createElement("section");
  root.style.cssText = panelStyle();
  root.append(title("Debug overlays"), description());
  const inputs = debugInputs(root);
  return { root, inputs };
}

export function readAdminDebugFlags(
  controls: AdminDebugControls,
): DebugFlags {
  return Object.fromEntries(DEBUG_FLAG_NAMES.map((flag) => [flag, controls.inputs[flag].checked])) as DebugFlags;
}

export function writeAdminDebugFlags(
  controls: AdminDebugControls,
  flags: DebugFlags,
): void {
  for (const flag of DEBUG_FLAG_NAMES) controls.inputs[flag].checked = flags[flag];
}

export function setAdminDebugEnabled(
  controls: AdminDebugControls,
  enabled: boolean,
): void {
  for (const flag of DEBUG_FLAG_NAMES) controls.inputs[flag].disabled = !enabled;
}

function debugInputs(root: HTMLElement): Readonly<Record<DebugFlag, HTMLInputElement>> {
  const entries = DEBUG_FLAG_NAMES.map((flag) => [flag, checkbox(flag)] as const);
  for (const [, input] of entries) root.append(input.parentElement!);
  return Object.fromEntries(entries) as Record<DebugFlag, HTMLInputElement>;
}

function checkbox(flag: DebugFlag): HTMLInputElement {
  const label = document.createElement("label");
  label.style.cssText = "display:flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid #394152;border-radius:4px";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.adminDebugFlag = flag;
  label.append(input, document.createTextNode(debugLabel(flag)));
  return input;
}

function description(): HTMLElement {
  const element = document.createElement("p");
  element.textContent = "Visible only in this authenticated control surface; controls never alter simulation behavior.";
  element.style.cssText = "width:100%;margin:0;color:#aeb8ca";
  return element;
}

function panelStyle(): string {
  return "display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:14px;background:#1b1f2a;border:1px solid #394152;border-radius:6px";
}

function debugLabel(flag: DebugFlag): string {
  const labels: Record<DebugFlag, string> = {
    hurtboxes: "Hurtboxes",
    attacks: "Active hitboxes",
    hitboxPreview: "Weapon hitbox preview",
    guards: "Active guards",
    lineOfSight: "Current line of sight",
    behavior: "AI behavior",
    search: "Search state",
    navigation: "Navigation path",
  };
  return labels[flag];
}
