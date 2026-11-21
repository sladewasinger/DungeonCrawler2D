# Final uncached determinism gate

- Task: `2026-08-03-final-uncached-determinism`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `tests/integration/finiteFloorRuntimeCache.test.ts; packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts; their direct trace-byte helper; workflow records`
- Preserve: `All production/cache/worker/config paths, seeds, fixtures, test behavior outside the two explicit generation-owned cases, and release files.`

## Goal

Keep both real uncached determinism assertions meaningful and stable under the final suite without a global timeout or fixture substitution.

## Plan

- [x] Linearize only test trace-byte serialization while retaining exact raw-byte equality.
- [x] Apply only a local 10-second budget to the two generation-owned determinism cases.
- [x] Prove isolated and two-worker shards stay below that budget; profile instead of raising it further.

## Decisions

- No global timeout, worker/config, production, cache, seed, fixture, skip, retry, or mock change.
- Keep runtime cache disabling, cache clearing, real generation, identity equality, and raw tile-plane equality unchanged.
- Materialize trace byte strings in explicit sequence, then compare their exact equality as a boolean so Vitest does not retain them as matcher operands for failure formatting.

## Handoff

- Changed:
  - `tests/integration/finiteFloorRuntimeCache.test.ts` gives only the explicitly uncached real-generation determinism case a 10-second local budget.
  - `packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts` explicitly serializes each complete trace before exact raw-string equality and gives only that generation-owned case a 10-second local budget.
- Preserved:
  - The runtime provider remains disabled during the authoritative generation.
  - Runtime identity and full raw `tiles` plane comparisons remain unchanged.
  - Trace snapshots still compare complete serialized raw planes and metadata, followed by the floor fingerprint comparison.
- Validation:
  - Isolated uncached runtime case: 1 passed / 7 skipped; case duration 2.318s.
  - Isolated trace-byte determinism case: 1 passed / 9 skipped; case duration 2.197s.
  - Exact two-worker determinism shard: 2 passed / 16 skipped; case durations 2.354s and 2.589s.
  - Complete two-file/two-worker shard: 2 files / 18 tests passed in 8.93s; determinism cases measured 2.238s and 2.054s.
  - `npm run typecheck --workspace @dc2d/engine` — passed.
  - `npm run lint:working-tree` — passed, including configuration and changed-folder checks.
- Remaining: independent review and parent-owned full gate.

## Review

### Round 1 — `2026-08-04` — `sol-auditor / /root/finite_fixture_audit`

- Outcome: clean.
- Budget verification: exactly the explicit uncached runtime case and trace
  byte-determinism case receive local `10_000ms` budgets. No global timeout,
  worker/config, retry, skip, seed, fixture, cache, or production change was
  introduced by this card.
- Runtime coverage verification: the installed runtime provider is disabled,
  process state is cleared, a real floor is generated, complete identity and
  the raw `tiles` plane are compared, and the prior provider is restored and
  rewarmed in `finally`.
- Trace coverage verification: the first trace request still performs real
  generation; complete snapshot metadata and all six typed planes are encoded.
  The result and repeat strings are materialized sequentially, then exact
  equality is passed to the matcher as a boolean, followed by the retained
  floor-fingerprint comparison.
- Validation: the complete two-file/two-worker shard passes (`2` files, `18`
  tests, `8.89s`); the runtime and trace determinism cases measure `2.161s` and
  `2.056s`, respectively. `npm run lint:working-tree` passes, including
  configuration-documentation and changed-folder checks.
- Findings: none.
- Resolution: ready for parent finalization and the parent-owned full gate.

## Memory candidates

- Large deterministic byte strings should be materialized sequentially and compared through a boolean identity result so exact coverage does not force assertion formatters to retain both payloads.
