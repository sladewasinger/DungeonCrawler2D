/** Public compatibility surface for projectile and ballistic domain helpers. */
export {
  launchVelocity,
  resolveBallisticThrow,
  sampleBallisticThrow,
} from "./ballistics/resolution.js";
export {
  createBallisticFlight,
  throwLaunchOrigin,
  THROW_LAUNCH_HEIGHT,
} from "./ballistics/contract.js";
export type {
  BallisticFlight,
  BallisticPoint,
  BallisticThrow,
  BallisticThrowRequest,
  BallisticThrowSampleRequest,
} from "./ballistics/contract.js";
export { traceBallisticFlight } from "./ballistics/trace.js";
export type {
  BallisticTrace,
  BallisticTraceRequest,
} from "./ballistics/trace.js";
export { stepProjectile } from "./ballistics/step.js";
export type { ProjectileStep } from "./ballistics/step.js";
