import type {
  EffectEvent,
  ItemDef,
} from "@dc2d/engine";
import type {
  PlayerAction,
  PlayerSlot,
  SimState,
} from "../state/state.js";

export interface ItemUseContext {
  sim: SimState;
  slot: PlayerSlot;
  defId: string;
  effectEvents: EffectEvent[];
}

export interface ItemThrowContext extends ItemUseContext {
  tags: readonly string[];
  targetX: number;
  targetY: number;
}

export type ThrowableDef = NonNullable<ItemDef["throwable"]>;
export type UseSlotAction = Extract<PlayerAction, { type: "useSlot" }>;

export interface SlottedItemContext extends ItemUseContext {
  readonly tags: readonly string[];
  readonly throwable: ThrowableDef | undefined;
  readonly action: UseSlotAction;
}

export interface ThrowableItemContext extends SlottedItemContext {
  readonly throwable: ThrowableDef;
  readonly action: UseSlotAction & {
    targetX: number;
    targetY: number;
  };
}

export interface ItemActionContext {
  sim: SimState;
  slot: PlayerSlot;
  action: PlayerAction;
  effectEvents: EffectEvent[];
}
