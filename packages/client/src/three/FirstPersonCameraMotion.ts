/** Adds bounded visual-only footfall and landing response to authoritative motion. */
import type { FirstPersonState } from "./movement.js";

const MAX_BOB = 0.018;
const LANDING_DIP = -0.035;
const RESPONSE = 16;

export class FirstPersonCameraMotion {
  private previous: FirstPersonState | null = null;
  private phase = 0;
  private landing = 0;
  private offset = 0;

  update(
    state: FirstPersonState,
    elapsed: number,
    reducedMotion: boolean,
  ): number {
    if (!this.previous || reducedMotion) {
      this.previous = state;
      this.offset = 0;
      this.landing = 0;
      return 0;
    }
    const distance = Math.hypot(
      state.x - this.previous.x,
      state.z - this.previous.z,
    );
    this.phase += distance * 8.5;
    if (!this.previous.grounded && state.grounded) this.landing = LANDING_DIP;
    const target = state.grounded && distance > 0.0001
      ? Math.sin(this.phase * Math.PI) * MAX_BOB
      : 0;
    const blend = 1 - Math.exp(-RESPONSE * Math.max(0, elapsed));
    this.landing += (0 - this.landing) * blend;
    this.offset += (target + this.landing - this.offset) * blend;
    this.previous = state;
    return this.offset;
  }
}
