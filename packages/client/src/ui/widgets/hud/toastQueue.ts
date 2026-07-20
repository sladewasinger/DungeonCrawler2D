/**
 * Pure view-model for the top-center toast stack: which of Connection's recent
 * toasts (net/apply.ts's "toast" events, plus client-pushed local ones —
 * Connection.pushToast) are still live right now, newest first, each fading
 * out over its last FADE_MS before expiry. No Phaser — toastStack.ts renders this.
 */
import type { ToastData } from "./fakeData.js";

/** How long before a toast's `until` the alpha starts ramping down to 0. */
export const TOAST_FADE_MS = 400;

export interface ToastView {
  msg: string;
  /** 0..1, ramping down over the toast's final TOAST_FADE_MS. */
  alpha: number;
}

/** Still-live toasts (until > nowMs), most recent first, with a fade-out alpha. */
export function visibleToasts(toasts: readonly ToastData[], nowMs: number): ToastView[] {
  return toasts
    .filter((toast) => toast.until > nowMs)
    .map((toast) => ({ msg: toast.msg, alpha: Math.min(1, (toast.until - nowMs) / TOAST_FADE_MS) }))
    .reverse();
}
