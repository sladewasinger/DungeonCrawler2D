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
 */

type Keys = Record<
  "W" | "A" | "S" | "D" | "SPACE" | "G" | "E" | "R" | "C" | "F" | "Q" | "ESC",
  Phaser.Input.Keyboard.Key
>;

export interface InputHooks {
  /** Cosmetic swing arc on left-click attack. */
  onSwing(dx: number, dy: number): void;
  /** [G] debug chunk-grid toggle. */
  onToggleBorders(): void;
}

export class InputController {
  private readonly keys: Keys;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  /** Mirrors the server's swing cooldown so the arc never lies. */
  private nextSwingAt = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly conn: Connection,
    private readonly panels: Panels,
    hud: Hud,
    hooks: InputHooks,
  ) {
    const keyboard = scene.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys("W,A,S,D,SPACE,G,E,R,C,F,Q,ESC") as Keys;

    this.keys.G.on("down", () => hooks.onToggleBorders());
    this.keys.E.on("down", () => {
      this.panels.openStashIfNearby(conn);
      conn.interact();
    });
    this.keys.R.on("down", () => conn.pickup());
    this.keys.C.on("down", () => this.panels.toggleCraft(conn));
    this.keys.Q.on("down", () => conn.drop(conn.selectedSlot));
    this.keys.F.on("down", () => {
      if (conn.pendingInvite) {
        conn.partyOp("accept");
        return;
      }
      const nearest = nearestPlayer(conn, 6);
      if (nearest) conn.partyOp("invite", nearest.id);
    });
    this.keys.ESC.on("down", () => this.panels.closeAll(conn));
    for (let i = 1; i <= 9; i++) {
      keyboard.addKey(48 + i).on("down", () => this.onNumberKey(i));
    }

    scene.input.mouse?.disableContextMenu();
    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!conn.body) return;
      // Clicks on UI act on the UI — never swing through the hotbar.
      const uiHit = hud.hitTest(pointer.x, pointer.y);
      if (uiHit !== null) {
        if (uiHit.startsWith("slot:")) conn.selectSlot(Number(uiHit.slice(5)));
        return;
      }
      const wx = pointer.worldX / TILE_PX;
      const wy = pointer.worldY / TILE_PX;
      if (pointer.rightButtonDown()) {
        const slot = conn.inventory[conn.selectedSlot];
        const def = slot ? content.items.get(slot.item) : undefined;
        if (def?.throwable) conn.useSlot(conn.selectedSlot, wx, wy);
        else conn.useSlot(conn.selectedSlot);
      } else {
        const now = performance.now();
        if (now < this.nextSwingAt) return;
        this.nextSwingAt = now + ATTACK_COOLDOWN_MS;
        const dx = wx - conn.body.x;
        const dy = wy - conn.body.y;
        conn.attack(dx, dy);
        hooks.onSwing(dx, dy);
      }
    });
    // Mouse wheel cycles the hotbar selection.
    scene.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        const dir = dy > 0 ? 1 : -1;
        conn.selectSlot((((conn.selectedSlot + dir) % 9) + 9) % 9);
      },
    );
  }

  /** Sampled at the fixed tick rate by the scene. */
  readInput(): MoveInput {
    const chatting = document.activeElement?.id === "chat-input";
    if (chatting || this.conn.downed) return { moveX: 0, moveY: 0, jump: false };
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

  /** Numbers act on the open panel first, then the hotbar. */
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
    conn.selectSlot(n - 1);
  }
}
