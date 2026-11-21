# Shared finite test-fixture contract

- Task: `2026-08-03-finite-fixture-contract`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `vitest setup; tests/support/finiteFloorRuntime*; tests/support/finiteFloorTrace*; their two integration contract tests; workflow records`
- Preserve: `All current dirty paths outside this scope; production generator/runtime code, product tests, admin/editor work, release files, and existing workflow cards.`

## Goal

Provide identity-validated, isolated reusable finite-floor runtime and trace fixtures so later test migrations do not duplicate eager generation. Preserve explicit uncached generation coverage.

## Plan

- [x] Implement separate runtime-floor and trace artifact contracts with full identity, bounds, content-fingerprint, lease, partial-artifact, and caller-isolation validation.
- [x] Add focused contract regressions, retaining explicit uncached runtime and trace determinism assertions.
- [x] Record cold/warm timings and changed-file lint before review.

## Decisions

- Austin requires the persistent `sol-coder`; Luna and Spark are prohibited for this finite-dungeon work.
- No timeout increase, skip, fake floor, or production cache is allowed.
- Cache keys and admission derive generator version and configuration identity from the normalized request, not a repository constant; serialized runtime artifacts use fixture-contract version 3 and full-floor-authenticated trace artifacts use version 4.
- Validated runtime floors and trace results are canonicalized once in fixture memory. Runtime callers receive deep isolated floor clones; trace callers receive isolated floor clones and immutable snapshot views without rehashing every large plane on each warm read.
- The shared lease waits for an identity-valid complete artifact rather than mere path existence, so an active peer cannot expose a partial target as complete; writes remain atomic temp-file renames under the OS temp root.
- Lease ownership records are fully written to unique pending inodes, then published with an atomic no-overwrite hard link; a claimable lock path can therefore never expose this fixture's empty or partial ownership JSON.

## Handoff

- Changed: `vitest.config.ts`; `tests/support/finiteFloorRuntimeCacheSetup.ts`; `tests/support/finiteFloorRuntimeLease.ts`; `tests/support/finiteFloorTraceCacheSetup.ts`; `tests/support/finiteFloorTraceImmutable.ts`; `tests/support/finiteFloorTraceSnapshotValidation.ts`; `tests/support/finiteFloorTraceValidation.ts`; `tests/integration/finiteFloorRuntimeCache.test.ts`; `tests/integration/finiteFloorTraceCache.test.ts`.
- Validation: cold `TMPDIR=/tmp/dc2d-finite-contract-validation-2 npx vitest run tests/integration/finiteFloorRuntimeCache.test.ts tests/integration/finiteFloorTraceCache.test.ts --maxWorkers=1` passed 2 files / 14 tests in 98.943s wall (45.999s user, 3.790s sys). The identical warm command passed 2 files / 14 tests in 22.755s wall (28.086s user, 2.915s sys); the post-type-fix warm rerun passed in 22.783s wall. These contract files retain one explicitly uncached runtime identity/content comparison and one explicitly uncached trace determinism comparison under the ordinary five-second per-test budget.
- Validation: scoped root setup/typecheck command over `vitest.config.ts`, both integration contracts, and all `tests/support/finiteFloorRuntime*` / `finiteFloorTrace*` files passed with strict NodeNext TypeScript settings. `npm run lint:working-tree` passed; it reported only the three unchanged legacy folder-size baselines.
- Validation after review fixes: genuinely cold `TMPDIR=/tmp/dc2d-finite-contract-review-fix-2 npx vitest run tests/integration/finiteFloorRuntimeCache.test.ts tests/integration/finiteFloorTraceCache.test.ts --maxWorkers=1` passed 2 files / 15 tests in 38.977s wall, with import reduced to 8.59s from the reviewer's 69.33s absent-root baseline. The warm run passed in 23.076s wall. The scoped strict NodeNext TypeScript command and `npm run lint:working-tree` both passed after the final peer-lock fixture adjustment.
- Validation after review round 2: the same focused command passed 2 files / 16 tests in 22.658s warm wall time, including the deterministic overlapping-publication regression. The scoped strict NodeNext TypeScript command and `npm run lint:working-tree` passed; lint reported only the unchanged legacy folder-size baselines.
- Remaining: Parent-owned final gates and roadmap reconciliation; no review findings remain.

## Review

### Round 1 — `changes-requested`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - **P1 — first use of an absent cache root burns two full lease waits.** `tests/support/finiteFloorRuntimeCacheSetup.ts:29-50`, `tests/support/finiteFloorTraceCacheSetup.ts:30-53`, and `tests/support/finiteFloorRuntimeLease.ts:62-70`: both cache constructors leave the root absent, `tryAcquire()` catches the lock-file ENOENT as contention, and directory creation occurs only later in `write()`. The reader therefore polls for the full 30-second completion window before doing generation. An isolated cold focused run exposed this twice: its import phase took 69.33s and the complete 2-file run took 98.57s. The contract tests mask the defect by passing roots already created by `mkdtempSync()` (`finiteFloorRuntimeCache.test.ts:112-115`, `finiteFloorTraceCache.test.ts:80-83`). Establish the root before claiming, and cover a genuinely absent runtime and trace cache root without a 30-second wait.
  - **P2 — lease release can delete a successor's lock.** `tests/support/finiteFloorRuntimeLease.ts:47-50,62-76`: lease ownership is not token-validated. After the fixed 30-second timestamp is considered stale, a successor may delete and recreate the lock, but the original owner's later `release()` unconditionally unlinks whatever lock is now at that path. Any allowed generation that outlives the stale window can therefore erase its successor's lease and admit duplicate eager generation, contrary to the shared-generation goal. Preserve and verify an ownership token on release (and keep long-running ownership live or otherwise make takeover safe), with a regression for predecessor release after successor takeover.
  - **P2 — trace admission does not authenticate all returned floor metadata.** `tests/support/finiteFloorTraceCacheSetup.ts:55-58,97-103`, `tests/support/finiteFloorTraceValidation.ts:18-24,60-64`, and `tests/support/finiteFloorTraceSnapshotValidation.ts:105-118`: the serialized trace artifact fingerprints only `trace.trace`. Admission recomputes the floor's plane-only identity fingerprint and compares the final snapshot's six planes plus five metadata collections, but it never authenticates returned floor-only metadata such as stairways, safe rooms, arenas, spawn, topology, or territory profiles. A disk artifact can therefore change those fields without changing `contentFingerprint` and still be admitted. Include the complete returned floor artifact in the stored content contract (or explicitly validate every returned metadata domain), and add a corruption regression for a floor-only metadata field.
- Validation:
  - `npm run lint:working-tree` passed. Only the three unchanged legacy folder-size baselines were reported.
  - Cold isolated `TMPDIR=/tmp/dc2d-finite-contract-review npx vitest run tests/integration/finiteFloorRuntimeCache.test.ts tests/integration/finiteFloorTraceCache.test.ts --maxWorkers=1` passed 2 files / 14 tests in 98.57s; the 69.33s import phase is relevant evidence for the P1 finding.
- Resolutions:
  - `[P1] Resolved. The shared lease creates the artifact parent before its atomic lock claim. Both runtime and trace cold-miss contracts now start from a genuinely absent child root and assert that ownership returns within one second; confirmed-cold import fell from 69.33s to 8.59s.`
  - `[P2 lease] Resolved. Lease records now carry UUID ownership tokens and process/thread/timestamp identity. Release removes only the matching token, live owner processes are not aged out, and stale replacement uses an atomic rename. The predecessor-release regression forces successor takeover and proves the predecessor cannot remove the successor's lock.`
  - `[P2 trace content] Resolved. Trace v4 envelopes store and recompute a fingerprint of the complete serialized finite-floor artifact in addition to the trace fingerprint and semantic admission checks. A floor-only spawn metadata corruption now fails admission.`

### Round 2 — `changes-requested`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Resolution verification:
  - The absent-root P1 is resolved: both contract tests start from a missing child root, and the cold review import completed in 8.75s rather than the round 1 69.33s baseline.
  - The trace-content P2 is resolved: the v4 envelope fingerprints the complete serialized floor artifact, and the floor-only spawn corruption regression is present and passing.
  - The recorded predecessor-release ordering is resolved: UUID tokens prevent a predecessor from deleting a successor lock that is already published.
- Findings:
  - **P2 — a newly claimed lock can be retired before its ownership record is fully published.** `tests/support/finiteFloorRuntimeLease.ts:79-100,106-113`: `writeFileSync(lease, ..., { flag: "wx" })` creates the directory entry before its JSON bytes are guaranteed visible, while a concurrent claimant maps any empty, partial, or otherwise unreadable record to `null` and immediately renames/unlinks it without applying the stale window. The first writer can finish against the renamed inode and return its token while the second publishes a new lock and also returns ownership, reintroducing duplicate eager generation despite token-aware release. Publish a complete record atomically before it becomes claimable, or retain unreadable records until their filesystem age exceeds the stale threshold, and add a simultaneous-claim regression.
- Validation:
  - `npm run lint:working-tree` passed. Only the three unchanged legacy folder-size baselines were reported.
  - Cold isolated `TMPDIR=/tmp/dc2d-finite-contract-rereview npx vitest run tests/integration/finiteFloorRuntimeCache.test.ts tests/integration/finiteFloorTraceCache.test.ts --maxWorkers=1` passed 2 files / 15 tests in 38.92s with an 8.75s import phase.
- Resolutions:
  - `[P2 lease publication] Resolved. Each claimant writes complete ownership JSON to a token-specific pending file, then uses atomic `linkSync()` publication with no overwrite before removing the pending name. Overlapping claimants may both prepare records, but only one can link the lock path. The regression pauses one claimant immediately before publication, lets a competitor publish, and proves the original returns unavailable while the competitor is the sole owner.`

### Round 3 — `approved`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings: None.
- Resolution verification:
  - Round 1 absent-root ownership remains resolved; cold import completed in 8.54s and both missing-child-root checks passed.
  - Round 1 token-aware successor preservation remains resolved; the stale-predecessor release regression passed.
  - Round 1 trace content authentication remains resolved; identity, bounds, trace content, floor-only metadata, and partial-artifact rejection all passed.
  - Round 2 atomic lease publication is resolved: claimants write complete JSON to unique pending inodes, publish via no-overwrite `linkSync()`, and the deterministic overlapping-claim regression proves exactly one owner.
- Validation:
  - `npm run lint:working-tree` passed. Only the three unchanged legacy folder-size baselines were reported.
  - Cold isolated `TMPDIR=/tmp/dc2d-finite-contract-review-round3 npx vitest run tests/integration/finiteFloorRuntimeCache.test.ts tests/integration/finiteFloorTraceCache.test.ts --maxWorkers=1` passed 2 files / 16 tests in 38.08s with an 8.54s import phase.
- Resolutions: All recorded review findings are resolved; the card is ready for parent-owned finalization.

## Memory candidates

- None.
