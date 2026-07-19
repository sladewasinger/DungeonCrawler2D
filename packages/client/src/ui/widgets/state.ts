/**
 * Shared types + state for the HUD widget registry: every HUD element
 * (health, hotbar, buffs, chat, party frames, minimap, ping/status) registers
 * itself with an id, default anchor/offset/scale/visibility — layout then
 * resolves from a JSON config instead of any fixed screen position.
 */

/** The nine standard screen anchors a widget can be pinned to. */
export type AnchorId =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface Offset {
  x: number;
  y: number;
}

/** What a widget registers with itself at creation time — its shipped default. */
export interface WidgetDefinition {
  id: string;
  defaultAnchor: AnchorId;
  defaultOffset: Offset;
  defaultScale: number;
  defaultVisible: boolean;
}

/** A per-widget override the layout config may carry (all fields optional). */
export interface WidgetOverride {
  anchor?: AnchorId;
  offset?: Offset;
  scale?: number;
  visible?: boolean;
}

/** The shape shipped as default-layout.json and persisted to localStorage. */
export interface LayoutConfig {
  version: 1;
  /** Global multiplier every widget's container scale and anchor offset is resolved against — defaults to HUD_SCALE when omitted (e.g. an older persisted config). */
  hudScale?: number;
  widgets: Record<string, WidgetOverride>;
}

/** A widget's fully-resolved placement for this frame: anchor point + offset in px, scale, visibility. */
export interface ResolvedWidgetLayout {
  anchor: AnchorId;
  x: number;
  y: number;
  scale: number;
  visible: boolean;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Registry state: shipped defaults per widget, the current override layer, and the active global HUD scale. */
export interface WidgetRegistryState {
  definitions: Map<string, WidgetDefinition>;
  overrides: Map<string, WidgetOverride>;
  hudScale: number;
}

export function createEmptyConfig(): LayoutConfig {
  return { version: 1, widgets: {} };
}

/** A bare state's hudScale starts neutral (1) — WidgetRegistry is the only caller that
 * applies an actual config (and its hudScale, defaulting to HUD_SCALE) on construction. */
export function createRegistryState(): WidgetRegistryState {
  return { definitions: new Map(), overrides: new Map(), hudScale: 1 };
}
