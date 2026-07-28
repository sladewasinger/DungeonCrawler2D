# Test audit

This audit records the test-suite cleanup performed with the domain-renderer
rename. The baseline run had 1,823 tests; the final run has 1,750 passing
tests. Removed tests were either dead islands, duplicate assertions, vacuous
invariants, or checks for retired implementation details.

## Deliberately broad tests

These suites remain because they exercise generation or simulation behavior
that a small unit fixture would not cover. Their durations are from the final
full run on the development machine.

| Suite | Duration | Why it remains broad |
| --- | ---: | --- |
| `spawnSafety.seedSweep.test.ts` | 57s | Runs the real server simulation across 20 seeds, including join and respawn grace windows under hostile pressure. |
| `stairsEscapability.test.ts` | 9.7s | Uses a fine-grained 0.2-tile flood to verify that every scanned pit ramp can be climbed out. |
| `stacksRoundtrip.test.ts` | 7.6s | Generates a multi-seed, multi-floor height corpus and compares serialized height bytes exactly. |
| `stairsInvariant.test.ts` | 6.7s | Scans a multi-seed region for stair height, cluster, and footprint invariants. |
| `chasm.test.ts` | 5.9s | Searches generated space for a rare chasm, then checks its bridge, pocket sealing, and collision boundary. |

The seed sweep is the only remaining test over one minute in the baseline
history. It was inspected and renamed from a misleading fuzz-test name; its
runtime is dominated by intentional live-simulation ticks rather than an
unbounded assertion loop. The other broad suites were reduced by caching
generated chunks, early-exiting neighbor searches, removing repeated seed
work, and replacing per-cell approximate assertions with exact byte checks.

## Coverage boundaries

The repository has deterministic headless HUD tests and renderer contract
tests, but no active browser automation job for screenshots or real DOM
templates. The old archived browser reference is not restored as a test.
The browser gallery remains the manual visual check for the renderer.

The public `terrain4Debug` query parameter remains as a compatibility entry
point. It is the only retained occurrence of the old name; implementation
modules, symbols, paths, and documentation use domain names instead.
