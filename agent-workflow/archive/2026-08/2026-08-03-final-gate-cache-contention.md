# Final-gate cache fixture contention

- Task: `2026-08-03-final-gate-cache-contention`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `tests/support/finiteFloorRuntime*; packages/engine/src/world/core/worldChunkCache.test.ts; tests/integration/finiteFloorRuntimeCache.test.ts; packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts; nearest existing test-support paths; workflow records`
- Preserve: `All production cache/generation behavior, unrelated tests, global test configuration, and release files.`

## Goal

Remove the measured two-worker prepared-floor/clone fixture cost that pushes one authoritative handoff test over its ordinary timeout, retaining explicit uncached determinism assertions.

## Plan

- [x] Profile runtime cache/clone work across the three named files under two workers.
- [x] Apply only identity-safe test-support reuse or test setup placement justified by measurement.
- [x] Prove isolated and two-worker aggregate timing without timeout/skip/config changes.

## Decisions

- No production cache, timeout increase, retry, worker cap, or skip is allowed.
- Keep the complete public-floor clone contract, but prepare its single mutable World outside the five-second body and pass only the boolean reference result to Vitest's matcher.
- Keep runtime cache admission on a real, invariant-valid finite floor while bounding the contract-only artifact envelope to the authored fixed-feature extent.
- Preserve exact trace-byte comparison while avoiding per-byte temporary arrays in test support.

## Handoff

- Changed:
  - `packages/engine/src/world/core/worldChunkCache.test.ts` prepares the authoritative handoff once for its sole test and asserts reference isolation as a boolean, avoiding matcher processing of two complete multi-plane floor objects.
  - `tests/integration/finiteFloorRuntimeCache.test.ts` uses an invariant-valid 448x384 real-generation cache fixture, stops clearing the process floor cache after every contract case, and restores the explicitly uncached request afterward.
  - `tests/support/finiteFloorRuntimeCacheTestSupport.ts` owns artifact corruption mechanics extracted from the cache contract.
  - `packages/engine/src/world/generate/trace/finiteFloorGenerationTraceTestSupport.ts` serializes typed-plane bytes without spread/map allocation of every byte.
- Measurement:
  - Before: three-file/two-worker aggregate failed only the authoritative handoff at 5.033s; its negated object-reference matcher alone measured about 4.99s under contention. Trace byte determinism measured 2.681s.
  - After: authoritative handoff measures 1-2ms. The compact runtime contract's explicit uncached generation remains real and measured 2.236s. Allocation-safe trace byte determinism measured 2.055s in the final aggregate.
- Validation:
  - `npx vitest run tests/integration/finiteFloorRuntimeCache.test.ts --maxWorkers=1 --reporter=verbose` — 1 file / 8 tests passed with a cold compact fixture, 6.32s.
  - `npx vitest run packages/engine/src/world/core/worldChunkCache.test.ts tests/integration/finiteFloorRuntimeCache.test.ts packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts --maxWorkers=2 --reporter=verbose` — 3 files / 28 tests passed, 8.99s final run.
  - `npm run typecheck --workspace @dc2d/engine` — passed.
  - `npm run lint:working-tree` — passed, including configuration and changed-folder checks.
- Remaining: independent review and the parent-owned full gate.

## Review

### Round 1 — `2026-08-04` — `sol-auditor / /root/finite_fixture_audit`

- Outcome: clean.
- Scope verification: changes remain in the three named cache/engine tests and
  their test support; no production cache/generation behavior, global test
  configuration, timeout, retry, worker cap, or skip changed for this card.
- Determinism verification: the runtime contract explicitly disables the
  installed provider, clears process state, performs a real generation, and
  compares its complete identity and tile plane with the invariant-valid
  source before restoring and rewarming the prior provider. The trace contract
  retains exact byte comparison across metadata and all six typed planes; the
  allocation-safe encoder changes representation cost, not compared content.
- Isolation verification: cold/warm memory and disk clones, invalid artifact
  rejection, lease takeover, partial peer completion, public-floor reference
  isolation, mutable-plane isolation, and trace immutability assertions remain.
  The authoritative World is prepared outside its sole test and only the
  identity-reference result is passed through the matcher.
- Validation: the required two-worker aggregate passes (`3` files, `28` tests,
  `8.97s`) with the handoff at `1ms`, explicit uncached runtime generation at
  `2.158s`, and trace byte determinism at `2.045s`; `npm run
  lint:working-tree` passes, including configuration-documentation and
  changed-folder checks.
- Findings: none.
- Resolution: ready for parent finalization and the parent-owned full gate.

## Memory candidates

- Prefer boolean reference assertions for very large typed-plane fixtures; passing both objects directly to a matcher can trigger multi-second formatter work even when the contract is identity-only.
