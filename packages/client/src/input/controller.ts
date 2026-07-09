import { content } from "@dc2d/content";
import { ATTACK_COOLDOWN_MS, type MoveInput } from "@dc2d/engine";
import Phaser from "phaser";
import type { Connection } from "../net/connection";
import { TILE_PX } from "../render/constants";
import type { Hud } from "../ui/hud";
import type { Panels } from "../ui/panels";
import { nearestPlayer, stashNearby, tableNearby } from "../ui/queries";

/**
 * Keyboard/mouse → intents. Nothing here changes game state directly:
 * every handler either sends an intent through the Connection or flips
 * local UI state (panels, chunk grid). The server decides what happens.
 *
 * Combat/use model: LEFT CLICK swings the EQUIPPED weapon; number keys
 * 1–9 USE whatever is bound to that hotbar slot (consumables fire
 * immediately, throwables launch at the mouse cursor).
 */

type Keys = Record<
  "W" | "A" | "S" | "D" | "SPACE" | "G" | "E" | "R" | "C" | "F" | "ESC",
  Phaser.Input.Keyboard.Key
>;

export interface InputHooks {
  /** Cosmetic swing arc on left-click attack. */
  onSwing(dx: number, dy: number): void;
  /** [G] debug chunk-grid toggle. */
  onToggleBorders(): void;
}

/** Movement/keys pause while any text input has focus (chat, search). */
function typingInInput(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

export class InputController {
  private readonly keys: Keys;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly scene: Phaser.Scene;
  /** Mirrors the server's swing cooldown so the arc never lies. */
  private nextSwingAt = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly conn: Connection,
    private readonly panels: Panels,
    hud: Hud,
    hooks: InputHooks,
  ) {
    this.scene = scene;
    const keyboard = scene.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys("W,A,S,D,SPACE,G,E,R,C,F,ESC") as Keys;

    const guarded = (fn: () => void) => () => {
      if (!typingInInput()) fn();
    };
    this.keys.G.on("down", guarded(() => hooks.onToggleBorders()));
    this.keys.E.on(
      "down",
      guarded(() => {
        this.panels.openStashIfNearby(conn);
        conn.interact();
      }),
    );
    this.keys.R.on("down", guarded(() => conn.pickup()));
    this.keys.C.on("down", guarded(() => this.panels.toggleCraft(conn)));
    this.keys.F.on(
      "down",
      guarded(() => {
        if (conn.pendingInvite) {
          conn.partyOp("accept");
          return;
        }
        const nearest = nearestPlayer(conn, 6);
        if (nearest) conn.partyOp("invite", nearest.id);
      }),
    );
    this.keys.ESC.on("down", () => this.panels.closeAll(conn));
    for (let i = 1; i <= 9; i++) {
      keyboard.addKey(48 + i).on("down", guarded(() => this.onNumberKey(i)));
    }

    scene.input.mouse?.disableContextMenu();
    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!conn.body) return;
      // Clicks on UI act on the UI — never swing through the hotbar.
      const uiHit = hud.hitTest(pointer.x, pointer.y);
      if (uiHit !== null) {
        if (uiHit.startsWith("slot:")) this.useHotbar(Number(uiHit.slice(5)));
        return;
      }
      if (pointer.rightButtonDown()) return; // reserved
      const now = performance.now();
      if (now < this.nextSwingAt) return;
      this.nextSwingAt = now + ATTACK_COOLDOWN_MS;
      const dx = pointer.worldX / TILE_PX - conn.body.x;
      const dy = pointer.worldY / TILE_PX - conn.body.y;
      conn.attack(dx, dy);
      hooks.onSwing(dx, dy);
    });
  }

  /** Sampled at the fixed tick rate by the scene. */
  readInput(): MoveInput {
    if (typingInInput() || this.conn.downed) return { moveX: 0, moveY: 0, jump: false };
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;
    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      jump: this.keys.SPACE.isDown || this.cursors.space.isDown,
    };
  }

  /** Use the item bound to a hotbar slot (throwables aim at the mouse). */
  private useHotbar(index: number): void {
    const { conn } = this;
    const defId = conn.hotbar[index];
    if (!defId) return;
    const def = content.items.get(defId);
    if (def?.throwable) {
      const pointer = this.scene.input.activePointer;
      conn.useSlot(index, pointer.worldX / TILE_PX, pointer.worldY / TILE_PX);
    } else {
      conn.useSlot(index);
    }
  }

  /** Numbers act on the open panel first, then USE the hotbar slot. */
  private onNumberKey(n: number): void {
    const { conn, panels } = this;
    if (panels.craftOpen && tableNearby(conn)) {
      const recipe = [...content.recipes.values()][n - 1];
      if (recipe) conn.craft(recipe.id);
      return;
    }
    if (panels.stashOpen && conn.stash && stashNearby(conn)) {
      conn.stashOp("take", n - 1);
      return;
    }
    this.useHotbar(n - 1);
  }
}
