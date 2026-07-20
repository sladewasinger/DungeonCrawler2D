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
  | "ENTER" | "O",
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
  selectedThrowable: number | null;
}

/** The subset of the network connection input needs to read and act on. */
export interface InputConnection {
  readonly body: { x: number; y: number } | null | undefined;
  readonly canAct: boolean;
  readonly hotbar: readonly (string | undefined)[];
  readonly inventory: readonly { item: string }[];
  readonly stash: unknown;
  readonly pendingInvite: boolean;
  /** Equipped weapon def (character slot); null = fists. When it's itself throwable
   * (a torch), primary attack throws instead of swinging — see throwEquipped.ts. */
  readonly weapon: string | null;
  interact(): void;
  pickup(): void;
  attack(dx: number, dy: number): void;
  useSlot(index: number, targetX?: number, targetY?: number): void;
  /** Throws the equipped throwable toward an aim direction (not a clicked tile). */
  throwTorch(dirX: number, dirY: number): void;
  craft(recipeId: string): void;
  stashOp(op: "put" | "take", index: number): void;
  partyOp(op: "accept" | "invite", targetId?: string): void;
  assignSlot(slot: number, item: string | null): void;
  equip(item: string | null): void;
  drop(item: string): void;
  /** Hold-F contact gesture intent (Epic 7.10) — server gates range/rate/mutuality. */
  fistbump(targetId: string): void;
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
  recipeIdAt(index: number): string | undefined;
  nearestPlayerId(conn: InputConnection, maxDistance: number): string | undefined;
  isStashNearby(conn: InputConnection): boolean;
  isCraftTableNearby(conn: InputConnection): boolean;
  /** Nearest downed party member in interact range — gates hold-E revive (Epic 7.12), or undefined. */
  downedPartyMemberInRange(conn: InputConnection): { id: string } | undefined;
}

export interface InputHooks {
  /** Cosmetic swing arc on left-click (or touch ATTACK button) attack. */
  onSwing(dx: number, dy: number): void;
  /** [G] debug chunk-grid toggle. */
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
