# Final-gate worker stability

- Task: `2026-08-03-final-gate-worker-stability`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `vitest.config.ts; root test configuration; only the seven isolated-pass final-gate files and direct test-support paths; workflow records`
- Preserve: `Production code, all semantic/fixture fixes, unrelated test configuration, and release files.`

## Goal

Make the full suite reliably run the already-passing finite-world tests under measured bounded worker contention without global test-timeout increases or skips.

## Plan

- [x] Reproduce worker contention with the exact isolated-pass set under increasing bounded worker counts.
- [x] Apply the smallest scoped scheduler/fixture reuse correction justified by measurements.
- [x] Prove the target aggregate and representative mixed suite are stable; record configuration impact.

## Decisions

- No global/per-file timeout increase, skip, fake floor, or production cache.
- The seven contention-only files no longer reproduce contention after the
  reviewed fixture and semantic migrations. Exact measurements were:
  - `1` worker: `7` files / `25` tests passed in `5.07s`;
  - `2` workers: `7` files / `25` tests passed in `2.72s`;
  - `4` workers: `7` files / `25` tests passed in `1.83s`;
  - `7` workers: `7` files / `25` tests passed in `1.75s`.
- Under seven-file full concurrency, the slowest ordinary reported case was
  the floor-5 boss setup at `411ms`; no lightweight client case failed or
  approached the default budget.
- The repaired mixed 15-file aggregate passed at both measured bounds:
  - `4` workers: `15` files / `49` tests in `2.80s`;
  - `15` workers: `15` files / `49` tests in `2.10s`.
  The highest reported file test duration at 15 workers was `814ms`.
- Therefore the smallest justified scheduler correction is no configuration
  change. Adding a root `maxWorkers` cap now would mask neither a reproduced
  timeout nor duplicate generation and would reduce measured throughput. The
  existing finite-floor setup registration in `vitest.config.ts` is preserved
  untouched.

## Handoff

- Changed: Workflow evidence only. No test configuration, timeout, production,
  test, or test-support file changed in this card.
- Validation: Seven-file worker sweep passed at `1/2/4/7` workers; repaired
  15-file aggregate passed at `4/15` workers; `npm run lint:working-tree`
  passed, including configuration documentation and changed-folder checks.
- Remaining: Independent review. The parent still owns full `npm test` and the
  post-gate representative generation sweep; neither broad gate was run here.

## Review

### Round 1 — `2026-08-03` — `sol-auditor / /root/finite_fixture_audit`

- Outcome: clean.
- Evidence verification: the seven-file set passes at `1/2/4/7` workers in
  `4.97s/2.68s/1.84s/1.76s`; the repaired 15-file aggregate passes at `4/15`
  workers in `2.74s/2.06s`. Review measurements reproduce stable throughput
  improvement rather than contention as concurrency increases.
- Configuration verification: root Vitest configuration has no worker cap,
  timeout increase, retry, or skip override; the existing finite-floor setup
  registration remains intact. This card changed workflow evidence only.
- Validation: all six bounded review runs pass (`7` files / `25` tests at each
  sweep point; `15` files / `49` tests at each aggregate point), and `npm run
  lint:working-tree` passes, including configuration-documentation and
  changed-folder checks.
- Findings: none.
- Resolution: no scheduler change is justified; ready for parent finalization
  and the parent-owned full test gate and representative generation sweep.

## Memory candidates

- None.
