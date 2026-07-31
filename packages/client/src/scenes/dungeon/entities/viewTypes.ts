import type { WorldView } from "@dc2d/engine";
import type { SelfCosmeticsState } from "../player/selfCosmetics.js";
import type { ItemEntityView, PlayerEntityView, RenderContext } from "../../../render/entities/geometry/index.js";
import type { InterpolatedEntity } from "../../../net/interpolation/interpolate.js";
import type { BlockFeedbackState } from "../../../combat/blockFeedback.js";

export interface RenderContextSource {
  readonly world: WorldView; readonly nowMs: number; readonly dtSeconds: number;
  readonly selfX: number; readonly selfY: number; readonly partyIds: ReadonlySet<string>;
  readonly target?: RenderContext | undefined;
}

export interface SelfPose {
  id: string; skin: import("@dc2d/engine").PlayerSkin; name: string;
  x: number; y: number; z: number; air: boolean;
}

export interface SelfVitals {
  hp: number; maxHp: number; fx: readonly string[]; downed: boolean;
  admin?: boolean;
  reviveProgress?: number; blocking: boolean; weaponId: string | null;
  blockFeedback?: BlockFeedbackState | null;
}

export interface SelfPlayerViewSource {
  readonly pose: SelfPose; readonly vitals: SelfVitals; readonly cosmetics: SelfCosmeticsState;
  readonly nowMs: number; readonly weaponAimAngle: number; readonly assistedAim: boolean;
  readonly target?: PlayerEntityView | undefined;
}

export interface ItemViewSource {
  readonly e: InterpolatedEntity; readonly target?: ItemEntityView | undefined;
  readonly context?: { readonly serverTick: number; readonly selfX: number; readonly selfY: number } | undefined;
}
