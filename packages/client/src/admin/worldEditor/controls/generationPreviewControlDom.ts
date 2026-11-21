import type {
  ApprovedGenerationConfig,
  ApprovedGenerationControl,
  GenerationPreviewDraft,
} from "./generationPreviewControls.js";
import { territoryField } from "./generationPreviewTerritoryField.js";
import {
  createGenerationPreviewControlActions,
  type GenerationPreviewControlActions,
} from "./generationPreviewControlActions.js";

export type ControlFieldKey = ApprovedGenerationControl | "seed" | "floor";

export interface GenerationPreviewControlDom extends GenerationPreviewControlActions {
  readonly fields: Map<ControlFieldKey, ControlFieldElement>;
}

export type ControlFieldElement = HTMLInputElement | HTMLSelectElement;

type NumericControl = Exclude<ApprovedGenerationControl, "territoryRoster">;
type FieldDefinition = readonly [string, NumericControl, number, "number" | "range", string];

export const GENERATION_PREVIEW_CONTROL_TEXT = {
  roomTargetCount: { label: "Room target", help: "Retained ordinary rooms across the floor." },
  roomSize: { label: "Room scale", help: "Base room size before territory scale and variation." },
  roomSizeVariation: { label: "Room variation", help: "Seeded size wiggle applied to each room." },
  mazeDensity: { label: "Maze openness", help: "How much remaining space becomes maze lattice." },
  connectorDensity: { label: "Connector reach", help: "How many disconnected regions receive bridge candidates." },
  minimumLoopPathSaving: { label: "Loop detour", help: "Minimum alternate-path saving for a real loop." },
  deadEndRemovalFraction: { label: "Dead-end removal", help: "Fraction of eligible dead ends pruned after connectivity." },
  territoryLayoutDensity: { label: "Territory structure", help: "Chance that authored territory structures are materialized." },
} as const;

export function createGenerationPreviewControlDom(
  draft: GenerationPreviewDraft,
): GenerationPreviewControlDom {
  const root = document.createElement("div");
  root.dataset.adminGenerationControls = "";
  const fields = new Map<ControlFieldKey, ControlFieldElement>();
  appendIdentityFields(root, draft, fields);
  appendGenerationFields(root, draft.config, fields);
  const actions = createGenerationPreviewControlActions();
  root.append(actions.root);
  return { ...actions, root, fields };
}

export function draftFromControlFields(
  fields: ReadonlyMap<ControlFieldKey, ControlFieldElement>,
  floor: number,
): GenerationPreviewDraft {
  const config = Object.fromEntries(
    APPROVED_NUMERIC_CONTROLS.map((key) => [key, numberValue(fields.get(key))]),
  ) as Omit<ApprovedGenerationConfig, "territoryRoster">;
  return {
    seed: numberValue(fields.get("seed")),
    floor,
    config: { ...config, territoryRoster: territoryRosterValue(fields.get("territoryRoster")) },
  };
}

function appendIdentityFields(
  root: HTMLElement,
  draft: GenerationPreviewDraft,
  fields: Map<ControlFieldKey, ControlFieldElement>,
): void {
  const group = fieldGroup("Preview input");
  group.append(numberField({ label: "Seed", key: "seed", value: draft.seed, fields }));
  group.append(territoryField(draft.config.territoryRoster, fields));
  root.append(group);
}

function appendGenerationFields(
  root: HTMLElement,
  config: ApprovedGenerationConfig,
  fields: Map<ControlFieldKey, ControlFieldElement>,
): void {
  const group = fieldGroup("Generation design");
  const definitions: readonly FieldDefinition[] = [
    [GENERATION_PREVIEW_CONTROL_TEXT.roomTargetCount.label, "roomTargetCount", config.roomTargetCount, "number", GENERATION_PREVIEW_CONTROL_TEXT.roomTargetCount.help],
    [GENERATION_PREVIEW_CONTROL_TEXT.roomSize.label, "roomSize", config.roomSize, "number", GENERATION_PREVIEW_CONTROL_TEXT.roomSize.help],
    [GENERATION_PREVIEW_CONTROL_TEXT.roomSizeVariation.label, "roomSizeVariation", config.roomSizeVariation, "number", GENERATION_PREVIEW_CONTROL_TEXT.roomSizeVariation.help],
    [GENERATION_PREVIEW_CONTROL_TEXT.mazeDensity.label, "mazeDensity", config.mazeDensity, "range", GENERATION_PREVIEW_CONTROL_TEXT.mazeDensity.help],
    [GENERATION_PREVIEW_CONTROL_TEXT.connectorDensity.label, "connectorDensity", config.connectorDensity, "range", GENERATION_PREVIEW_CONTROL_TEXT.connectorDensity.help],
    [GENERATION_PREVIEW_CONTROL_TEXT.minimumLoopPathSaving.label, "minimumLoopPathSaving", config.minimumLoopPathSaving, "number", GENERATION_PREVIEW_CONTROL_TEXT.minimumLoopPathSaving.help],
    [GENERATION_PREVIEW_CONTROL_TEXT.deadEndRemovalFraction.label, "deadEndRemovalFraction", config.deadEndRemovalFraction, "range", GENERATION_PREVIEW_CONTROL_TEXT.deadEndRemovalFraction.help],
    [GENERATION_PREVIEW_CONTROL_TEXT.territoryLayoutDensity.label, "territoryLayoutDensity", config.territoryLayoutDensity, "range", GENERATION_PREVIEW_CONTROL_TEXT.territoryLayoutDensity.help],
  ];
  for (const definition of definitions) group.append(numberFieldFromDefinition(definition, fields));
  root.append(group);
}

function fieldGroup(label: string): HTMLElement {
  const fieldset = document.createElement("fieldset");
  fieldset.dataset.adminGenerationFieldGroup = label.toLowerCase().replaceAll(" ", "-");
  const legend = document.createElement("legend");
  legend.textContent = label;
  fieldset.append(legend);
  return fieldset;
}

interface NumberFieldInput {
  readonly label: string;
  readonly key: ControlFieldKey;
  readonly value: number;
  readonly fields: Map<ControlFieldKey, ControlFieldElement>;
  readonly type?: "number" | "range";
  readonly help?: string;
}

function numberField(input: NumberFieldInput): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.dataset.adminGenerationControl = input.key;
  wrapper.textContent = input.label;
  if (input.help) {
    wrapper.title = input.help;
    wrapper.setAttribute("aria-label", `${input.label}: ${input.help}`);
  }
  const element = document.createElement("input");
  const type = input.type ?? "number";
  element.type = type;
  element.value = String(input.value);
  element.step = type === "range" ? "0.01" : "1";
  if (type === "range") { element.min = "0"; element.max = "1"; }
  element.dataset.generationControl = input.key;
  input.fields.set(input.key, element);
  wrapper.append(element);
  if (input.help) {
    const help = document.createElement("small");
    help.textContent = input.help;
    wrapper.append(help);
  }
  return wrapper;
}

function numberFieldFromDefinition(
  [label, key, value, type, help]: FieldDefinition,
  fields: Map<ControlFieldKey, ControlFieldElement>,
): HTMLElement {
  return numberField({ label, key, value, type, help, fields });
}

const APPROVED_NUMERIC_CONTROLS: readonly NumericControl[] = [
  "roomTargetCount", "roomSize", "roomSizeVariation", "mazeDensity", "connectorDensity",
  "minimumLoopPathSaving", "deadEndRemovalFraction", "territoryLayoutDensity",
];

function numberValue(input: ControlFieldElement | undefined): number {
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : 0;
}

function territoryRosterValue(input: ControlFieldElement | undefined): ApprovedGenerationConfig["territoryRoster"] {
  if (!input || !("selectedOptions" in input)) return [];
  return [...input.selectedOptions].map(({ value }) => value) as ApprovedGenerationConfig["territoryRoster"];
}
