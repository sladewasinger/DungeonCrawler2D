/**
 * Build metadata for the telemetry stack's on-screen stamp: the git short SHA
 * baked in at build time via vite's `define` (vite.config.ts's __BUILD_SHA__),
 * so a stuck-position bug report carries a build id along with seed+coords.
 */

// Only ever real at runtime after vite's `define` textually replaces this
// identifier — `typeof` on an undeclared global is safe (never throws), so
// dev-without-a-build and plain `vitest` (no vite `define` at all) fall
// through to the literal below instead of a ReferenceError.
declare const __BUILD_SHA__: string;

const DEV_FALLBACK = "dev";

export const BUILD_SHA: string = typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : DEV_FALLBACK;
