/**
 * Shared state and integration contract for the input subsystem: the plain
 * data every sibling module reads/writes, plus the interfaces net/ui modules
 * must satisfy to plug in (input never imports net/connection or ui/hud/panels
 * directly, so this subsystem ports and tests standalone).
 */
import type Phaser from "phaser";

/** The chord of keys the controller listens to, resolved once at construction. */
export type Keys = Record<
  | "W" | "A" | "S" | "D" | "SPACE" | "G" | "E" | "R" | "C" | "F" | "ESC" | "SHIFT" | "I" | "TAB"
  | "ENTER" | "O" | "K",
  Phaser.Input.Keyboard.Key
>;

/** A pending world-target throw, previewed from the cursor until the next click. */
export interface ThrowPreview {
  slot: number;
  targetX: number;
  targetY: number;
}

/** Mutable input state, held once by the facade and threaded through helpers. */
export interface InputState {
  keys: Keys;
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  /** Mirrors the server's swing cooldown so the swing arc never lies. */
  nextSwingAt: number;
  selectedSlot: number | null;
}

/** The subset of the network connection input needs to read and act on. */
export interface InputConnection {
  readonly body: { x: number; y: number } | null | undefined;
  readonly canAct: boolean;
  readonly downed: boolean;
  readonly hotbar: readonly (string | undefined)[];
  readonly inventory: readonly { item: string; qty: number }[];
  readonly stash: unknown;
  readonly pendingInvite: boolean;
  /** Equipped weapon definition in the character slot; null means fists. */
  readonly weapon: string | null;
  /**
   * Real terrain height at a world tile, for `cursorWorldTile`'s tallest-first aim
   * pick (docs/ELEVATION-PROJECTION.md section 4) — undefined where no world is bound
   * yet (reconnect gap) or in test fakes, both of which fall back to flat (h=0) aim,
   * byte-identical to pre-E3 behavior.
   */
  readonly heightAt?: (wx: number, wy: number) => number;
  interact(): void;
  pickup(): void;
  attack(dx: number, dy: number): void;
  useSlot(index: number, targetX?: number, targetY?: number): void;
  useItem(item: string): void;
  /** Throws a hotbar torch toward an aim direction. */
  throwTorch(dirX: number, dirY: number): void;
  craft(recipeId: string): void;
  stashOp(op: "put" | "take", index: number): void;
  partyOp(op: "accept" | "invite", targetId?: string): void;
  assignSlot(slot: number, item: string | null): void;
  equip(item: string | null): void;
  drop(item: string): void;
  /** Hold-F contact gesture intent (Epic 7.10) — server gates range/rate/mutuality. */
  fistbump(targetId: string): void;
  /** Descends/ascends a nearby stairway (Epic 7.14) — server validates range. */
  descend(): void;
  /** Sends the existing server-authoritative suicide intent after a deliberate hold. */
  suicide(): void;
  /**
   * Client-local UI feedback for an action the client can already tell will do
   * nothing (no crafting table nearby, out of torches...) — never a substitute for
   * the real intent, which still gets sent regardless (Epic 7.13 onboarding lane's
   * "failed actions give no feedback" fix). Renders through the shared top-center
   * toast stack (ui/widgets/hud/toastStack.ts).
   */
  pushToast(msg: string): void;
}

/** Resolves whether the HUD's own layer consumed a pointer event. */
export interface InputHud {
  /** Returns a hit id (e.g. "slot:2") or null when the click passed through to the world. */
  hitTest(x: number, y: number): string | null;
}

/** Panel open/close state the number-key and E/C bindings act on. */
export interface InputPanels {
  readonly craftOpen: boolean;
  readonly stashOpen: boolean;
  /** True while the inventory window (ui/widgets/hud/inventoryWindow.ts) is open. */
  readonly inventoryOpen: boolean;
  /** The inventory row currently selected for the [1-9] bind flow, or null. */
  readonly selectedInventoryItem: string | null;
  openStashIfNearby(conn: InputConnection): void;
  toggleCraft(conn: InputConnection): void;
  closeAll(conn: InputConnection): void;
}

/** Content/world lookups the controller needs but doesn't own. */
export interface InputQueries {
  isThrowable(itemDefId: string): boolean;
  isConsumable(itemDefId: string): boolean;
  attackCooldownMs(weaponId: string | null): number;
  recipeIdAt(index: number): string | undefined;
  nearestPlayerId(conn: InputConnection, maxDistance: number): string | undefined;
  isStashNearby(conn: InputConnection): boolean;
  isCraftTableNearby(conn: InputConnection): boolean;
  /** True when the tile under the player's feet is a door — mirrors the server's exact
   * useDoor() gate (game-server/src/sim/actions/interact.ts) so the client can tell
   * [E] would open a door without waiting on a round trip. */
  isDoorNearby(conn: InputConnection): boolean;
  /** True when a StairwayDown/StairwayUp landmark (Epic 7.14) is within interact
   * range — takes priority over every other [E] action. */
  isStairwayNearby(conn: InputConnection): boolean;
  /** Nearest downed party member in interact range — gates hold-E revive (Epic 7.12), or undefined. */
  downedPartyMemberInRange(conn: InputConnection): { id: string } | undefined;
}

export interface InputHooks {
  /** Cosmetic swing arc on left-click (or touch ATTACK button) attack. */
  onSwing(dx: number, dy: number): void;
  /** Legacy debug hook retained for gallery tooling. */
  onToggleBorders(): void;
  /** Tapping the touch layout's chat toggle chip (docs mobile pass — chat collapses to avoid the joystick corner). */
  onToggleChat(): void;
  /** [I]/[Tab], or the touch layout's bag button — opens/closes the inventory window. */
  onToggleInventory(): void;
  /** [Enter] — opens the chat input box (a no-op while it's already open/focused). */
  onOpenChat(): void;
  /** [o], or the chip beside the chat tabs — opens/closes the contacts window. */
  onToggleContacts(): void;
  /** [Esc] — closes the chat input box and contacts window (inventory closes via InputPanels). */
  onCloseOverlays(): void;
}

/** Movement/keys pause while any text input has focus (chat, search). */
export function isTypingInInput(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}
