import type Phaser from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InputController } from "./index.js";
import type {
  InputConnection,
  InputHooks,
  InputHud,
  InputPanels,
  InputQueries,
  Keys,
} from "./state.js";

class FakeKey {
  isDown = false;
  private readonly listeners = new Map<string, Array<() => void>>();

  on(event: string, listener: () => void): this {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  emit(event: "down" | "up"): void {
    this.isDown = event === "down";
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
}

const keyboardKeys = vi.hoisted(() => new Map<string, FakeKey>());

vi.mock("./keys.js", () => ({
  createKeys: () => {
    const key = (name: string) => {
      const existing = keyboardKeys.get(name);
      if (existing) return existing;
      const created = new FakeKey();
      keyboardKeys.set(name, created);
      return created;
    };
    const names = [
      "W", "A", "S", "D", "SPACE", "G", "E", "R", "C", "F", "ESC",
      "SHIFT", "I", "TAB", "ENTER", "O", "K",
    ];
    const keys = Object.fromEntries(names.map((name) => [name, key(name)]));
    return {
      keys: keys as unknown as Keys,
      cursors: {
        left: key("left"),
        right: key("right"),
        up: key("up"),
        down: key("down"),
        space: key("space"),
      },
    };
  },
  readMoveInput: () => ({
    moveX: 0,
    moveY: 0,
    jump: false,
    run: false,
  }),
}));

vi.mock("./movementEdges.js", () => ({
  bindKeyboardMovementEdges: vi.fn(),
}));
vi.mock("./pointerBindings.js", () => ({
  bindInputPointerEdges: vi.fn(),
}));

const noop = () => undefined;

function dependencies(dead = true) {
  const conn = {
    dead,
    downed: false,
    canAct: false,
    hotbar: [],
    inventory: [],
    stash: null,
    pendingInvite: false,
    weapon: null,
    respawnNow: vi.fn(),
    sendInputEdge: vi.fn(),
    interact: noop,
    pickup: noop,
    attack: noop,
    useSlot: noop,
    useSlotOnPlayer: noop,
    useItem: noop,
    throwTorch: noop,
    craft: noop,
    stashOp: noop,
    partyOp: noop,
    assignSlot: noop,
    equip: noop,
    drop: noop,
    fistbump: noop,
    descend: noop,
    suicide: noop,
    pushToast: noop,
    heightAt: () => 0,
  } as unknown as InputConnection & { dead: boolean };
  const panels = {
    craftOpen: false,
    stashOpen: false,
    inventoryOpen: false,
    gameplayBlocked: false,
    selectedInventoryItem: null,
    toggleStash: () => false,
    toggleCraft: noop,
    closeAll: noop,
  } satisfies InputPanels;
  const queries = {
    isThrowable: () => false,
    isConsumable: () => false,
    attackCooldownMs: () => 0,
    recipeIdAt: () => undefined,
    nearestPlayerId: () => undefined,
    nearbyLootChest: () => undefined,
    isStashNearby: () => false,
    isCraftTableNearby: () => false,
    worldInteraction: () => null,
    isStairwayNearby: () => false,
    downedPartyMemberInRange: () => undefined,
  } satisfies InputQueries;
  const hooks = {
    onSwing: noop,
    onToggleBorders: noop,
    onToggleChat: noop,
    onToggleInventory: noop,
    onOpenChat: noop,
    onToggleContacts: noop,
    onCloseOverlays: () => false,
    onToggleSessionMenu: noop,
  } satisfies InputHooks;
  const hud = { hitTest: () => null } satisfies InputHud;
  return { conn, panels, queries, hooks, hud };
}

function fakeScene() {
  const shutdown: Array<() => void> = [];
  return {
    time: { now: 0 },
    input: {
      keyboard: { addKey: () => new FakeKey() },
    },
    events: {
      once: (_event: string, listener: () => void) => shutdown.push(listener),
    },
  } as unknown as Phaser.Scene;
}

beforeEach(() => {
  keyboardKeys.clear();
  vi.stubGlobal("document", { activeElement: null });
  vi.stubGlobal("HTMLInputElement", class {}); vi.stubGlobal("HTMLTextAreaElement", class {});
});

describe("Phaser respawn production path", () => {
  it("drives one hold from the real E listener through controller polling", () => {
    const scene = fakeScene();
    const { conn, panels, queries, hooks, hud } = dependencies();
    const controller = new InputController(
      scene,
      conn,
      panels,
      hud,
      queries,
      hooks,
      16,
    );
    const interact = keyboardKeys.get("E");
    expect(interact).toBeDefined();
    interact?.emit("down");
    scene.time.now = 1_500;
    controller.pollRespawnHold();
    expect(controller.respawnHoldProgress()).toBe(0.5);
    expect(conn.respawnNow).not.toHaveBeenCalled();

    scene.time.now = 3_000;
    controller.pollRespawnHold();
    controller.pollRespawnHold();
    expect(conn.respawnNow).toHaveBeenCalledOnce();
  });

  it("clears progress on key release and authoritative death loss", () => {
    const scene = fakeScene();
    const { conn, panels, queries, hooks, hud } = dependencies();
    const controller = new InputController(
      scene,
      conn,
      panels,
      hud,
      queries,
      hooks,
      16,
    );
    const interact = keyboardKeys.get("E");
    interact?.emit("down");
    scene.time.now = 1_500;
    controller.pollRespawnHold();
    interact?.emit("up");
    expect(controller.respawnHoldProgress()).toBe(0);

    interact?.emit("down");
    scene.time.now = 2_000;
    conn.dead = false;
    controller.pollRespawnHold();
    expect(controller.respawnHoldProgress()).toBe(0);
    expect(conn.respawnNow).not.toHaveBeenCalled();
  });
});
