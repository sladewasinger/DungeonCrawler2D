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
import { createKeys, readMoveInput } from "./keys.js";
import {
  createHoldState,
  FISTBUMP_RANGE_TILES,
  holdCrossedThreshold,
  holdDown,
  holdProgress,
  holdUp,
  type HoldState,
} from "./fistbump.js";
import { activeThrowableSlot, onNumberKey, throwPreview as resolveThrowPreview } from "./hotbar.js";
import { cursorWorldTile, handlePointerDown, handlePointerMove, handlePointerUp } from "./pointer.js";
import { ReviveGesture } from "./revive.js";
import type { InputConnection, InputHooks, InputHud, InputPanels, InputQueries, InputState, ThrowPreview } from "./state.js";
import {
  createTouchInputState,
  isButtonHeld,
  mergeMoveInputs,
  touchMoveInput,
  touchVisualSnapshot,
  updateLastFacing,
} from "./touch/index.js";
import type { TouchInputState, TouchVisualSnapshot } from "./touch/index.js";
import { isTouchDevice } from "./touchDetect.js";

export type {
  InputConnection,
  InputHooks,
  InputHud,
  InputPanels,
  InputQueries,
  ThrowPreview,
} from "./state.js";
export type { TouchVisualSnapshot } from "./touch/index.js";

/** Guards a key handler so typing in a chat/search box never fires game actions. */
function guarded(fn: () => void): () => void {
  return () => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
    fn();
  };
}

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
  private readonly revive = new ReviveGesture();
  /** Not readonly: late/emulated touch (e.g. Chrome's device toolbar toggled
   * after boot) flips this reactively — see activateTouchIfNeeded. */
  private touchActive: boolean = isTouchDevice();
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
    this.state = { keys, cursors, nextSwingAt: 0, selectedThrowable: null };
    this.bindKeys(keys, queries, hooks);
    this.bindPointer(hud, queries, hooks, tilePx);
  }

  private bindKeys(keys: InputState["keys"], queries: InputQueries, hooks: InputHooks): void {
    const { conn, panels, state } = this;
    keys.G.on("down", guarded(() => hooks.onToggleBorders()));
    keys.E.on("down", guarded(() => this.handleInteractDown()));
    keys.E.on("up", guarded(() => this.revive.end(this.scene.time.now)));
    keys.R.on("down", guarded(() => conn.pickup()));
    keys.C.on("down", guarded(() => panels.toggleCraft(conn)));
    keys.F.on("down", guarded(() => holdDown(this.fistbumpHold, this.scene.time.now)));
    keys.F.on("up", guarded(() => this.releaseFistbumpHold(conn, queries)));
    keys.ESC.on("down", () => {
      state.selectedThrowable = null;
      panels.closeAll(conn);
      hooks.onCloseOverlays();
    });
    keys.I.on("down", guarded(() => hooks.onToggleInventory()));
    keys.TAB.on("down", guarded(() => hooks.onToggleInventory()));
    keys.ENTER.on("down", guarded(() => hooks.onOpenChat()));
    keys.O.on("down", guarded(() => hooks.onToggleContacts()));
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) throw new Error("scene has no keyboard plugin");
    for (let i = 1; i <= 9; i++) {
      keyboard.addKey(48 + i).on("down", guarded(() => onNumberKey(state, conn, panels, queries, keys, i)));
    }
  }

  /** [E]: a nearby stairway (Epic 7.14) takes priority and sends descend() instead;
   * otherwise a downed party member starts hold-to-revive instead of firing instantly,
   * else this mirrors the server's doInteract() gate client-side, purely to toast
   * "nothing happened" rather than assert an outcome — interact() still always fires. */
  private handleInteractDown(): void {
    const { conn, panels, queries } = this;
    if (queries.isStairwayNearby(conn)) return conn.descend();
    const target = queries.downedPartyMemberInRange(conn);
    if (this.revive.begin(target?.id, this.scene.time.now)) return;
    if (queries.isStashNearby(conn)) panels.openStashIfNearby(conn);
    else if (!queries.isDoorNearby(conn)) conn.pushToast("Nothing to interact with here");
    conn.interact();
  }

  /** Call once per render frame: fires the revive intent exactly on the tick the hold
   * crosses REVIVE_HOLD_MS. */
  pollReviveHold(): void {
    if (this.revive.poll(this.scene.time.now)) this.conn.interact();
  }

  /** HUD-facing read: the in-progress revive hold's target + 0..1 ring progress, or null when idle. */
  reviveHoldView(): { targetId: string; progress: number } | null {
    return this.revive.holdView(this.scene.time.now);
  }

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
    const nowMs = this.scene.time.now;
    this.pollTouchFistbumpEdge(nowMs);
    if (!this.isFistbumpHoldSourceDown()) return;
    this.fistbumpTargetId = this.queries.nearestPlayerId(this.conn, FISTBUMP_RANGE_TILES) ?? null;
    if (this.fistbumpTargetId && holdCrossedThreshold(this.fistbumpHold, nowMs)) {
      this.conn.fistbump(this.fistbumpTargetId);
    }
  }

  private isFistbumpHoldSourceDown(): boolean {
    return this.state.keys.F.isDown || (this.touchActive && isButtonHeld(this.touch, "interact"));
  }

  /** The touch interact button has no keydown/keyup events (see pointer.ts's "touch:interact"
   * press, which fires pickup/interact immediately as it always has) — so its hold-vs-tap
   * edges for the fistbump gesture are detected here instead, every frame. */
  private pollTouchFistbumpEdge(nowMs: number): void {
    if (!this.touchActive) return;
    const held = isButtonHeld(this.touch, "interact");
    if (held && !this.touchFistbumpHeld) holdDown(this.fistbumpHold, nowMs);
    else if (!held && this.touchFistbumpHeld) {
      holdUp(this.fistbumpHold, nowMs);
      this.fistbumpTargetId = null;
    }
    this.touchFistbumpHeld = held;
  }

  /** HUD-facing read: the in-progress hold's target + 0..1 ring progress, or null when idle. */
  fistbumpHoldView(): { targetId: string; progress: number } | null {
    if (!this.fistbumpTargetId) return null;
    const progress = holdProgress(this.fistbumpHold, this.scene.time.now);
    return progress > 0 ? { targetId: this.fistbumpTargetId, progress } : null;
  }

  private bindPointer(hud: InputHud, queries: InputQueries, hooks: InputHooks, tilePx: number): void {
    this.scene.input.mouse?.disableContextMenu();
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.activateTouchIfNeeded(pointer);
      const viewport = { width: this.scene.scale.width, height: this.scene.scale.height };
      handlePointerDown(
        this.state,
        {
          conn: this.conn,
          hud,
          queries,
          hooks,
          tilePx,
          touch: this.touch,
          touchActive: this.touchActive,
          viewport,
          camera: this.scene.cameras.main,
        },
        pointer,
      );
    });
    if (this.touchActive) this.bindTouchDragListeners();
  }

  /**
   * Boot-time isTouchDevice() (the fast path, above) never runs again, so a
   * browser that only starts reporting touch after boot — Chrome's device
   * toolbar toggled mid-session, or any other late-arriving touch input —
   * would otherwise never get drag/release tracking for the joystick. Flips
   * touchActive and wires the deferred listeners on the first touch pointer,
   * before this same pointerdown is routed (so it's handled as touch, not a
   * desktop click).
   */
  private activateTouchIfNeeded(pointer: Phaser.Input.Pointer): void {
    if (this.touchActive || !pointer.wasTouch) return;
    this.touchActive = true;
    this.bindTouchDragListeners();
  }

  private bindTouchDragListeners(): void {
    this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => handlePointerMove(this.touch, pointer));
    this.scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => handlePointerUp(this.touch, pointer));
    this.scene.input.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => handlePointerUp(this.touch, pointer));
  }

  /** Sampled at the fixed tick rate by the scene. */
  readInput(): MoveInput {
    const keyboardMove = readMoveInput(this.state, this.conn);
    if (!this.touchActive) return keyboardMove;
    const merged = mergeMoveInputs(keyboardMove, touchMoveInput(this.touch));
    updateLastFacing(this.touch, merged.moveX, merged.moveY);
    return merged;
  }

  /** Current armed-throw trajectory preview, for the scene to render, or null. */
  throwPreview(): ThrowPreview | null {
    const pointer = this.scene.input.activePointer;
    const cursorWorld = cursorWorldTile(this.scene.cameras.main, pointer, this.tilePx);
    return resolveThrowPreview(this.state, this.conn, this.queries, cursorWorld);
  }

  /** The hotbar slot currently armed for a world-target throw, or null — HUD pulse hook. */
  armedThrowableSlot(): number | null {
    return activeThrowableSlot(this.state, this.conn, this.queries);
  }

  /** Live joystick/button state for the touch HUD widgets to render, or null when touch isn't active. */
  touchVisual(): TouchVisualSnapshot | null {
    return this.touchActive ? touchVisualSnapshot(this.touch) : null;
  }
}
