/**
 * Input facade: wires keyboard/mouse/touch Phaser events to intents sent through
 * the network connection. Nothing here mutates game state directly — every
 * handler either sends an intent or flips local UI state; the server decides
 * what happens. Touch is a virtual input source merged into the same MoveInput
 * shape keyboard produces (input/touch/*) — prediction never sees a forked
 * intent type. Split along key-chord / hotbar / pointer / touch seams to stay
 * under the file-size cap.
 */
import type Phaser from "phaser";
import type { MoveInput } from "@dc2d/engine";
import { screenDirToWorld, screenMoveToWorld } from "./cameraRelative.js";
import { bindBandageKey, interactOrUse, throwSelected, withPointerFacing } from "./gameplayActions.js";
import { createKeys, readMoveInput } from "./keys.js";
import { createHoldState, FISTBUMP_RANGE_TILES, holdCrossedThreshold, holdDown, holdProgress, holdUp, syncHoldSource, type HoldState } from "./fistbump.js";
import { guardedAction } from "./inputGuard.js";
import { activeThrowableSlot, onNumberKey, throwPreview as resolveThrowPreview } from "./hotbar.js";
import { LifeGestures } from "./lifeGestures.js";
import { bindKeyboardMovementEdges } from "./movementEdges.js";
import { cursorWorldTile } from "./pointer.js";
import { bindInputPointerEdges } from "./pointerBindings.js";
import { inputModality, type InputModality } from "./inputModality.js";
import type { InputConnection, InputHooks, InputHud, InputPanels, InputQueries, InputState, ThrowPreview } from "./state.js";
import { createTouchInputState, isButtonHeld, mergeMoveInputs, resetTouchInputState, touchMoveInput, touchVisualSnapshot, updateLastFacing, type TouchInputState, type TouchVisualSnapshot } from "./touch/index.js";
import { getViewOrientation } from "../render/view/index.js";
export type { InputConnection, InputHooks, InputHud, InputPanels, InputQueries, ThrowPreview } from "./state.js";
export type { TouchVisualSnapshot } from "./touch/index.js";
export class InputController {
  private readonly state: InputState;
  private readonly touch: TouchInputState = createTouchInputState();
  /** Hold-vs-tap F discrimination (Epic 7.10) — a tap keeps party invite/accept as-is. */
  private readonly fistbumpHold: HoldState = createHoldState();
  /** Nearby-player id tracked while F is held, for both firing and the HUD ring. */
  private fistbumpTargetId: string | null = null;
  /** Edge-detection for the touch interact button, which has no keydown/keyup events. */
  private touchFistbumpHeld = false;
  /** Hold-E revive gesture (Epic 7.12) — gated by a downed party member in range. */
  private readonly lifeGestures = new LifeGestures();
  /** Cached projection of the shared observable, updated only by applyModality. */
  private touchActive = inputModality.current === "touch";
  private readonly stopModality: () => void;
  private readonly scene: Phaser.Scene;
  private readonly queries: InputQueries;
  private readonly tilePx: number;

  constructor(
    scene: Phaser.Scene,
    private readonly conn: InputConnection,
    private readonly panels: InputPanels,
    hud: InputHud,
    queries: InputQueries,
    hooks: InputHooks,
    /** World px per tile — passed in so input never depends on the render module. */
    tilePx: number,
  ) {
    this.scene = scene;
    this.queries = queries;
    this.tilePx = tilePx;
    const { keys, cursors } = createKeys(scene);
    this.state = { keys, cursors, nextSwingAt: 0, selectedSlot: null };
    this.bindKeys(keys, queries, hooks);
    bindKeyboardMovementEdges(this.state, () => this.sendCurrentMovementEdge());
    bindInputPointerEdges({
      scene, state: this.state, conn, hud, queries, hooks, tilePx,
      touch: this.touch,
      touchActive: () => this.touchActive,
      onInteractReleased: () => this.lifeGestures.endInteract(scene.time.now),
      onContextAction: () => this.handleInteractDown("pickup"),
      onThrowSelected: () => this.throwSelectedTouch(),
      onMovementEdge: () => this.sendCurrentMovementEdge(),
    });
    this.stopModality = inputModality.subscribe((mode) => this.applyModality(mode));
    scene.events.once("shutdown", this.stopModality);
  }

  private bindKeys(keys: InputState["keys"], queries: InputQueries, hooks: InputHooks): void {
    const { conn, panels, state } = this;
    const blocked = () => panels.gameplayBlocked;
    keys.G.on("down", guardedAction(() => throwSelected(this.scene, conn, queries, state, this.touch, this.touchActive, this.tilePx), blocked));
    keys.E.on("down", guardedAction(() => this.handleInteractDown(), blocked));
    keys.E.on("up", () => this.lifeGestures.endInteract(this.scene.time.now));
    keys.K.on("down", guardedAction(() => this.lifeGestures.beginGiveUp(conn.downed, this.scene.time.now), blocked));
    keys.K.on("up", () => this.lifeGestures.endGiveUp(this.scene.time.now));
    keys.R.on("down", guardedAction(() => conn.pickup(), blocked));
    keys.C.on("down", guardedAction(() => panels.toggleCraft(conn), blocked));
    bindBandageKey(keys.F, conn, queries, () => state.selectedSlot, () => holdDown(this.fistbumpHold, this.scene.time.now), () => this.releaseFistbumpHold(conn, queries), blocked);
    keys.ESC.on("down", () => {
      state.selectedSlot = null;
      const panelsWereOpen = panels.inventoryOpen || panels.craftOpen || panels.stashOpen;
      panels.closeAll(conn);
      const overlayWasOpen = hooks.onCloseOverlays();
      if (!panelsWereOpen && !overlayWasOpen) hooks.onToggleSessionMenu();
    });
    keys.I.on("down", guardedAction(() => hooks.onToggleInventory(), blocked));
    keys.TAB.on("down", guardedAction(() => hooks.onToggleInventory(), blocked));
    keys.ENTER.on("down", guardedAction(() => hooks.onOpenChat(), blocked));
    keys.O.on("down", guardedAction(() => hooks.onToggleContacts(), blocked));
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) throw new Error("scene has no keyboard plugin");
    for (let i = 1; i <= 9; i++) {
      keyboard.addKey(48 + i).on("down",
        guardedAction(() => onNumberKey(state, conn, panels, queries, keys, i), blocked));
    }
  }

  /** [E]: a nearby stairway (Epic 7.14) takes priority and sends descend() instead;
   * otherwise a downed party member starts hold-to-revive instead of firing instantly,
   * else this mirrors the server's doInteract() gate client-side, purely to toast
   * "nothing happened" rather than assert an outcome — interact() still always fires. */
  private handleInteractDown(fallback: "interact" | "pickup" = "interact"): void {
    if (this.conn.dead) {
      this.lifeGestures.beginRespawn(this.scene.time.now);
      return;
    }
    interactOrUse(this.conn, this.panels, this.queries, this.state.selectedSlot, (targetId) => this.lifeGestures.beginRevive(targetId, this.scene.time.now), fallback);
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

  pollRespawnHold(): void {
    if (this.cancelModalGestures()) return;
    this.lifeGestures.pollRespawn(this.conn, this.scene.time.now, this.state.keys.E.isDown);
  }

  respawnHoldProgress(): number { return this.lifeGestures.respawnProgress(this.conn.dead, this.scene.time.now); }

  /** HUD-facing read: the in-progress revive hold's target + 0..1 ring progress, or null when idle. */
  reviveHoldView(): { targetId: string; progress: number } | null { return this.lifeGestures.reviveHoldView(this.scene.time.now); }

  /** A quick tap keeps today's party invite/accept flow; a hold already fired (or missed
   * its window with no target) and does nothing further here. */
  private releaseFistbumpHold(conn: InputConnection, queries: InputQueries): void {
    const result = holdUp(this.fistbumpHold, this.scene.time.now);
    this.fistbumpTargetId = null;
    if (result !== "tap") return;
    if (conn.pendingInvite) {
      conn.partyOp("accept");
      return;
    }
    const nearest = queries.nearestPlayerId(conn, 6);
    if (nearest) conn.partyOp("invite", nearest);
  }

  /** Call once per render frame: fires the fistbump intent exactly on the tick the hold
   * crosses its threshold, and keeps the tracked nearby target fresh for the HUD ring. */
  pollFistbumpHold(): void {
    if (this.cancelModalGestures()) return;
    const nowMs = this.scene.time.now;
    this.pollTouchFistbumpEdge(nowMs);
    if (!this.isFistbumpHoldSourceDown()) return;
    this.fistbumpTargetId = this.queries.nearestPlayerId(this.conn, FISTBUMP_RANGE_TILES) ?? null;
    if (this.fistbumpTargetId && holdCrossedThreshold(this.fistbumpHold, nowMs)) {
      this.conn.fistbump(this.fistbumpTargetId);
    }
  }

  private isFistbumpHoldSourceDown(): boolean {
    return this.state.keys.F.isDown ||
      (this.touchActive && !this.lifeGestures.reviveActive() && isButtonHeld(this.touch, "interact"));
  }

  /** The touch interact button has no keydown/keyup events, so its hold-vs-tap
   * edges for the fistbump gesture are detected here instead, every frame. */
  private pollTouchFistbumpEdge(nowMs: number): void {
    if (!this.touchActive) return;
    const held = !this.lifeGestures.reviveActive() && isButtonHeld(this.touch, "interact");
    const nextHeld = syncHoldSource(this.fistbumpHold, this.touchFistbumpHeld, held, nowMs);
    if (this.touchFistbumpHeld && !nextHeld) this.fistbumpTargetId = null;
    this.touchFistbumpHeld = nextHeld;
  }

  /** HUD-facing read: the in-progress hold's target + 0..1 ring progress, or null when idle. */
  fistbumpHoldView(): { targetId: string; progress: number } | null {
    if (!this.fistbumpTargetId) return null;
    const progress = holdProgress(this.fistbumpHold, this.scene.time.now);
    return progress > 0 ? { targetId: this.fistbumpTargetId, progress } : null;
  }

  /** Clears held touch state before desktop routing can observe it. */
  private applyModality(mode: InputModality): void {
    const touchActive = mode === "touch";
    if (touchActive === this.touchActive) return;
    if (!touchActive) {
      resetTouchInputState(this.touch);
      this.lifeGestures.endInteract(this.scene.time.now);
      this.touchFistbumpHeld = false;
    }
    this.touchActive = touchActive;
    this.sendCurrentMovementEdge();
  }

  private sendCurrentMovementEdge(): void { this.conn.sendInputEdge?.(this.readInput()); }

  /** Sampled at the fixed tick rate by the scene. Keyboard/touch author SCREEN-space
   * intent (screen-up = "forward") — camera-relative controls remap it to WORLD space
   * here, the one choke point before Connection.sampleInput's predicted stepBody. */
  readInput(): MoveInput {
    if (this.panels.gameplayBlocked) return { moveX: 0, moveY: 0, jump: false, run: false };
    const keyboardMove = readMoveInput(this.state, this.conn);
    if (!this.touchActive) return { ...withPointerFacing(screenMoveToWorld(keyboardMove, getViewOrientation()), this.scene, this.conn, this.tilePx), block: this.scene.input.activePointer.rightButtonDown() };
    const merged = mergeMoveInputs(keyboardMove, touchMoveInput(this.touch));
    updateLastFacing(this.touch, merged.moveX, merged.moveY);
    const move = screenMoveToWorld(merged, getViewOrientation());
    const facing = screenDirToWorld(this.touch.lastFacing, getViewOrientation());
    return { ...move, faceX: facing.x, faceY: facing.y };
  }

  private cancelModalGestures(): boolean {
    if (!this.panels.gameplayBlocked) return false;
    this.lifeGestures.cancel(this.scene.time.now, this.fistbumpHold);
    this.fistbumpTargetId = null;
    this.touchFistbumpHeld = this.touchActive && isButtonHeld(this.touch, "interact");
    return true;
  }

  private throwSelectedTouch(): void {
    throwSelected(this.scene, this.conn, this.queries, this.state,
      this.touch, true, this.tilePx);
  }

  /** Current armed-throw trajectory preview, for the scene to render, or null. */
  throwPreview(): ThrowPreview | null {
    const pointer = this.scene.input.activePointer;
    const cursorWorld = cursorWorldTile(this.scene.cameras.main, pointer, this.tilePx, this.conn.heightAt);
    return resolveThrowPreview(this.state, this.conn, this.queries, cursorWorld);
  }

  /** The hotbar slot currently armed for a world-target throw, or null — HUD pulse hook. */
  armedThrowableSlot(): number | null {
    return activeThrowableSlot(this.state, this.conn, this.queries);
  }

  /** Hotbar slot selected by keyboard/touch, regardless of its item category. */
  selectedHotbarSlot(): number | null { return this.state.selectedSlot; }

  setHotbarSlot(index: number | null): void { this.state.selectedSlot = index; }

  /** Live joystick/button state for the touch HUD widgets to render, or null when touch isn't active. */
  touchVisual(): TouchVisualSnapshot | null {
    return this.touchActive ? touchVisualSnapshot(this.touch) : null;
  }
}
