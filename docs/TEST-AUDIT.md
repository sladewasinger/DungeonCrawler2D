# Test audit

This audit records the test-suite cleanup performed with the domain-renderer
rename. The baseline run had 1,823 tests; the final run has 1,665 passing
tests. Removed tests were either dead islands, duplicate assertions, vacuous
invariants, or checks for retired implementation details.

## Individual test timing

The final JSON timing report found zero individual test cases over 500 ms.
The threshold is applied to each assertion/test case, not to the aggregate
runtime of a file.

## Broad test files

Four files still take over 500 ms in aggregate because they intentionally
exercise real multi-step or generated-world behavior. None contains an
individual test over the threshold.

| Suite | Duration | Why it remains broad |
| --- | ---: | --- |
| `floorRegistry.test.ts` | 0.73s | Drives the real cross-floor descent, death transfer, chat relay, and directory behavior. |
| `floorPersistence.test.ts` | 0.61s | Exercises file-backed restart and durable descent state. |
| `descentInvariant.test.ts` | 0.59s | Checks generated StairwayUp/Down positions and cross-chunk reachability over representative seeds. |
| `bossArenaInvariant.test.ts` | 0.57s | Generates multi-seed arena rings and verifies the gate reaches the network. |

The removed stack round-trip suite tested a conversion path with no runtime
callers. The stair invariant and pit-escapability scans tested generator
policy that will be enforced directly by future world generation. The spawn
seed sweep and chasm scan were broad live searches without enough value for
their cost. Other low-value removals eliminated literal-constant checks,
implementation-coupling checks, duplicate deterministic cases, and mutable
balance probes. Remaining broad suites use representative seed sets and
short test fixtures while retaining their behavioral assertions.

The latest run contains 1,665 passing tests, and every individual test was
under 500 ms.

## Coverage boundaries

The repository has deterministic headless HUD tests and renderer contract
tests, but no active browser automation job for screenshots or real DOM
templates. The old archived browser reference is not restored as a test.
The browser gallery remains the manual visual check for the renderer.

The public `terrain4Debug` query parameter remains as a compatibility entry
point. It is the only retained occurrence of the old name; implementation
modules, symbols, paths, and documentation use domain names instead.
