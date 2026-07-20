/**
 * HUD widget registry facade: owns the registered-widget set and the current
 * layout override layer, and orchestrates resolve/persist/reset. Every HUD
 * element registers here instead of positioning itself — "no fixed-position
 * UI, ever" (docs/VISUAL_DIRECTION.md).
 */
import { HUD_SCALE } from "../hudScale.js";
import shippedDefaultLayout from "./default-layout.json" with { type: "json" };
import { resolveLayout } from "./layout.js";
import { mergeLayoutConfigs } from "./mergeLayout.js";
import { loadPersistedLayout, savePersistedLayout } from "./storage.js";
import {
  createRegistryState,
  type LayoutConfig,
  type ResolvedWidgetLayout,
  type Viewport,
  type WidgetDefinition,
  type WidgetOverride,
  type WidgetRegistryState,
} from "./state.js";

const STORAGE_KEY = "dc2d.hud.layout";

/** Applies a full layout config as the current override layer, replacing any prior overrides. */
function applyConfig(state: WidgetRegistryState, config: LayoutConfig): void {
  state.overrides.clear();
  for (const [id, override] of Object.entries(config.widgets)) {
    state.overrides.set(id, override);
  }
  state.hudScale = config.hudScale ?? HUD_SCALE;
}

export class WidgetRegistry {
  private readonly state: WidgetRegistryState = createRegistryState();

  constructor() {
    applyConfig(this.state, shippedDefaultLayout as LayoutConfig);
  }

  /** A widget registers its identity + shipped default once, typically in its constructor. */
  register(definition: WidgetDefinition): void {
    this.state.definitions.set(definition.id, definition);
  }

  unregister(id: string): void {
    this.state.definitions.delete(id);
  }

  /** Every currently-registered widget's shipped definition — edit-HUD's catalog panel
   * (ui/hudEdit/catalogPanel.ts) iterates this to list every window, hidden ones included. */
  listDefinitions(): WidgetDefinition[] {
    return [...this.state.definitions.values()];
  }

  /** The current override for one widget, if any — edit-HUD reads this to know a widget's live anchor/offset/visible. */
  getOverride(id: string): WidgetOverride | undefined {
    return this.state.overrides.get(id);
  }

  /** The active global HUD scale — edit-HUD needs this to convert a drag's real on-screen
   * offset back into the pre-hudScale unit every stored/default offset is authored in
   * (resolveLayout re-multiplies by this on every read; storing the already-scaled
   * value would double it). */
  getHudScale(): number {
    return this.state.hudScale;
  }

  /** Applies a partial override (e.g. from a drag in the future HUD editor). */
  setOverride(id: string, override: WidgetOverride): void {
    const existing = this.state.overrides.get(id) ?? {};
    this.state.overrides.set(id, { ...existing, ...override });
  }

  /** Drops back to the shipped default for one widget, or every widget when id is omitted. */
  resetToDefault(id?: string): void {
    const defaults = shippedDefaultLayout as LayoutConfig;
    if (id === undefined) {
      applyConfig(this.state, defaults);
      return;
    }
    const override = defaults.widgets[id];
    if (override) this.state.overrides.set(id, override);
    else this.state.overrides.delete(id);
  }

  resolve(viewport: Viewport): Map<string, ResolvedWidgetLayout> {
    return resolveLayout(this.state, viewport);
  }

  /** Persists the current override layer to localStorage (a no-op outside the browser). */
  persist(): void {
    const config: LayoutConfig = { version: 1, widgets: Object.fromEntries(this.state.overrides) };
    savePersistedLayout(STORAGE_KEY, config);
  }

  /**
   * Loads a previously-persisted layout, merged over the shipped default-layout.json
   * (mergeLayout.ts) rather than replacing it outright — a widget the saved blob
   * predates (shipped after the user's last save) still resolves to its shipped
   * placement instead of silently losing its layout.
   */
  loadPersisted(): void {
    const persisted = loadPersistedLayout(STORAGE_KEY);
    if (!persisted) return;
    applyConfig(this.state, mergeLayoutConfigs(shippedDefaultLayout as LayoutConfig, persisted));
  }
}
