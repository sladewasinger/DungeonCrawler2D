/** Wires keyboard, mouse, and touch events to server-authoritative intents. */
import type Phaser from "phaser";
import type { MoveInput } from "@dc2d/engine";
import { interactOrUse, throwPreviewTarget, throwSelected } from "./gameplay/gameplayActions.js";
import { createKeys } from "./controls/keys.js";
import { activeThrowableSlot, throwPreview as resolveThrowPreview } from "./gameplay/hotbar.js";
import { LifeGestures } from "./gestures/lifeGestures.js";
import { bindControllerEvents } from "./bindings/controllerEvents.js";
import { FistbumpGesture } from "./holds/fistbumpGesture.js";
import { inputModality, type InputModality } from "./controls/inputModality.js";
import type { InputConnection, InputHooks, InputHud, InputPanels, InputQueries, InputState, ThrowPreview } from "./controls/state.js";
import { createTouchInputState, resetTouchInputState, touchVisualSnapshot, type TouchInputState, type TouchVisualSnapshot } from "./touch/index.js";
import { readCurrentInput } from "./movement/readCurrentInput.js";
import { attackInKidMode, createKidModeState } from "./controls/kidMode.js";
export type { InputConnection, InputHooks, InputHud, InputPanels, InputQueries, ThrowPreview } from "./controls/state.js";
export type { TouchVisualSnapshot } from "./touch/index.js";

export interface InputControllerOptions {
  readonly scene: Phaser.Scene;
  readonly conn: InputConnection;
  readonly panels: InputPanels;
  readonly hud: InputHud;
  readonly queries: InputQueries;
  readonly hooks: InputHooks;
  readonly tilePx: number;
}

export class InputController {
  private readonly state: InputState;
  private readonly touch: TouchInputState = createTouchInputState();
  private readonly fistbump = new FistbumpGesture();
  /** Hold-E revive gesture (Epic 7.12) — gated by a downed party member in range. */
  private readonly lifeGestures = new LifeGestures();
  /** Cached projection of the shared observable, updated only by applyModality. */
  private touchActive = inputModality.current === "touch";
  private stopModality: () => void = () => undefined;
  private readonly scene: Phaser.Scene;
  private readonly queries: InputQueries;
  private readonly tilePx: number;

  private readonly conn: InputConnection;
  private readonly panels: InputPanels;

  constructor(options: InputControllerOptions) {
    const { scene, conn, panels, hud, queries, hooks, tilePx } = options;
    this.conn = conn;
    this.panels = panels;
    this.scene = scene; this.queries = queries; this.tilePx = tilePx;
    const { keys, cursors } = createKeys(scene);
    this.state = { keys, cursors, nextSwingAt: 0, selectedSlot: null, kidMode: createKidModeState() };
    this.configureEvents({ scene, conn, panels, hud, queries, hooks, tilePx });
  }

  private configureEvents(options: InputControllerOptions): void {
    const { scene, conn, panels, hud, queries, hooks, tilePx } = options;
    this.stopModality = bindControllerEvents({
      scene,
      conn,
      panels,
      hud,
      state: this.state,
      queries,
      hooks,
      touch: this.touch,
      tilePx,
      touchActive: () => this.touchActive,
      onGod: () => this.handleGDown(),
      onInteract: () => this.handleInteractDown(),
      onInteractReleased: () => this.lifeGestures.endInteract(this.conn, scene.time.now),
      onBandageDown: () => this.fistbump.down(this.scene.time.now),
      onBandageUp: () => this.fistbump.release(conn, queries, this.scene.time.now),
      onContextAction: () => this.handleInteractDown("pickup"),
      onThrowSelected: () => this.throwSelectedTouch(),
      onKidAttack: () => attackInKidMode({ state: this.state, conn, queries, hooks, nowMs: performance.now() }),
      onMovementEdge: () => this.sendCurrentMovementEdge(),
      onModality: (mode) => this.applyModality(mode),
    });
    scene.events.once("shutdown", this.stopModality);
  }

  /** [G] is a localhost/dev convenience when no hotbar slot is armed. A selected
   * slot retains the existing throw action, and production bundles never expose
   * the shortcut; the server-side /god command remains unchanged. */
  private handleGDown(): void {
    if (import.meta.env.DEV && this.state.selectedSlot === null) {
      this.conn.debugGod?.();
      return;
    }
    throwSelected({ scene: this.scene, conn: this.conn, queries: this.queries, state: this.state, touch: this.touch, touchActive: this.touchActive, tilePx: this.tilePx });
  }

  /** [E]: a nearby stairway (Epic 7.14) takes priority and sends descend() instead;
   * otherwise a downed party member starts hold-to-revive instead of firing instantly,
   * else this mirrors the server's doInteract() gate client-side, purely to toast
   * "nothing happened" rather than assert an outcome — interact() still always fires. */
  private handleInteractDown(fallback: "interact" | "pickup" = "interact"): void {
    if (this.conn.downed) {
      this.lifeGestures.beginGiveUp(true, this.scene.time.now);
      return;
    }
    if (this.conn.dead) return;
    interactOrUse({
      conn: this.conn,
      panels: this.panels,
      queries: this.queries,
      selectedSlot: this.state.selectedSlot,
      startRevive: (targetId) => this.lifeGestures.beginRevive(this.conn, targetId, this.scene.time.now),
      fallback,
    });
  }

  /** Call once per render frame: fires the revive intent exactly on the tick the hold
   * crosses REVIVE_HOLD_MS. */
  pollReviveHold(): void {
    if (this.cancelModalGestures()) return;
    this.lifeGestures.pollRevive(this.conn, this.scene.time.now);
  }

  /** Fires the suicide intent once after a complete hold while downed. */
  pollGiveUpHold(): void {
    if (this.cancelModalGestures()) return;
    this.lifeGestures.pollGiveUp(this.conn, this.scene.time.now);
  }

  giveUpHoldProgress(): number {
    return this.lifeGestures.giveUpProgress(this.conn.downed, this.scene.time.now);
  }

  /** HUD-facing read: the in-progress revive hold's target + 0..1 ring progress, or null when idle. */
  reviveHoldView(): { targetId: string; progress: number } | null { return this.lifeGestures.reviveHoldView(this.scene.time.now); }

  pollFistbumpHold(): void {
    if (this.cancelModalGestures()) return;
    this.fistbump.poll({ touchActive: this.touchActive, touch: this.touch, keyboardHeld: this.state.keys.F.isDown, reviveActive: this.lifeGestures.reviveActive(), conn: this.conn, queries: this.queries, nowMs: this.scene.time.now });
  }

  /** HUD-facing read: the in-progress hold's target + 0..1 ring progress, or null when idle. */
  fistbumpHoldView(): { targetId: string; progress: number } | null {
    return this.fistbump.view(this.scene.time.now);
  }

  /** Clears held touch state before desktop routing can observe it. */
  private applyModality(mode: InputModality): void {
    const touchActive = mode === "touch";
    if (touchActive === this.touchActive) return;
    if (!touchActive) {
      resetTouchInputState(this.touch);
      this.lifeGestures.endInteract(this.conn, this.scene.time.now);
      this.fistbump.resetTouch();
    }
    this.touchActive = touchActive;
    this.sendCurrentMovementEdge();
  }

  private sendCurrentMovementEdge(): void { this.conn.sendInputEdge?.(this.readInput()); }

  /** Sampled at the fixed tick rate by the scene. Keyboard/touch author SCREEN-space
   * intent (screen-up = "forward") — camera-relative controls remap it to WORLD space
   * here, the one choke point before Connection.sampleInput's predicted stepBody. */
  readInput(): MoveInput {
    return readCurrentInput({ scene: this.scene, panels: this.panels, state: this.state, conn: this.conn, touch: this.touch, touchActive: this.touchActive, tilePx: this.tilePx });
  }

  private cancelModalGestures(): boolean {
    if (!this.panels.gameplayBlocked) return false;
    this.lifeGestures.endInteract(this.conn, this.scene.time.now);
    this.lifeGestures.cancel(this.scene.time.now, this.fistbump.holdForCancellation());
    this.fistbump.cancel(this.touchActive, this.touch);
    return true;
  }

  private throwSelectedTouch(): void {
    throwSelected({ scene: this.scene, conn: this.conn, queries: this.queries, state: this.state, touch: this.touch, touchActive: true, tilePx: this.tilePx });
  }

  /** Current armed-throw trajectory preview, for the scene to render, or null. */
  throwPreview(): ThrowPreview | null {
    const pointerWorld = throwPreviewTarget({
      scene: this.scene, conn: this.conn, state: this.state, tilePx: this.tilePx,
    });
    return resolveThrowPreview({ state: this.state, conn: this.conn, queries: this.queries, pointerWorld });
  }

  /** The hotbar slot currently armed for a world-target throw, or null — HUD pulse hook. */
  armedThrowableSlot(): number | null { return activeThrowableSlot(this.state, this.conn, this.queries); }

  /** Hotbar slot selected by keyboard/touch, regardless of its item category. */
  selectedHotbarSlot(): number | null { return this.state.selectedSlot; }

  setHotbarSlot(index: number | null): void { this.state.selectedSlot = index; }

  /** Live joystick/button state for the touch HUD widgets to render, or null when touch isn't active. */
  touchVisual(): TouchVisualSnapshot | null {
    return this.touchActive ? touchVisualSnapshot(this.touch) : null;
  }
}
