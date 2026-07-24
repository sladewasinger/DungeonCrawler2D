/** Pure timing curve for easing newly visible torch halos into the additive light pool. */

export const TORCH_HALO_FADE_IN_MS = 250;

export function torchHaloFade(nowMs: number, visibleSinceMs: number): number {
  const progress = Math.max(0, Math.min(1, (nowMs - visibleSinceMs) / TORCH_HALO_FADE_IN_MS));
  return 1 - (1 - progress) ** 2;
}
