# Second final-gate failure reproduction

- Task: `2026-08-03-final-gate-second-reproduction`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `only the eight current final-gate failing test files and nearest test-support paths; workflow records`
- Preserve: `All production code, unrelated tests/configuration, and prior recovery cards.`

## Goal

Reproduce and classify the second final-gate failure set before any repair.

## Plan

- [x] Run exact isolated reproductions and small mixed aggregates.
- [x] Classify cache/trace, population construction, reconnect, and projectile failures.
- [x] Record follow-on scope; make no production changes.

## Decisions

- No product defect is presumed from a full-suite failure.
- Every isolated command used
  `npx vitest run <file> --maxWorkers=1 --reporter=verbose` with the root
  finite runtime/trace setup files intact.

### Exact isolated classification

| File | Exact result | Classification |
| --- | --- | --- |
| `finiteFloorRuntimeCache.test.ts` | `8/8` passed in `5.94s`; the explicit uncached determinism case took `2.877s` | Cache-lifecycle contention participant. No isolated semantic failure; retain every cold/warm/corruption/lease/peer/uncached contract. |
| `worldChunkCache.test.ts` | `10/10` passed in `5.57s`; authoritative generated-floor handoff took `4.707s` | Prompt clone/fixture cost near the ordinary budget, not a product mismatch. In the required two-worker cache aggregate this exact case timed out at `5.110s`. |
| `finiteFloorGenerationTrace.test.ts` | `10/10` passed in `9.28s`; module import took `4.41s`, byte determinism `2.663s`, and stage isolation `591ms` | Import/trace setup contention participant. No isolated assertion mismatch; preserve uncached trace and immutable plane/metadata coverage. |
| `repopulation.test.ts` | `1/4` failed in `193ms`: deeper-floor occupied-area count expected `16`, received `0` | Stale floor-2 population fixture/spawn envelope. Prompt setup result, not a tuning or repopulation product defect. |
| `reconnect.test.ts` | `1/6` failed in `170ms`: disconnected-player grace case throws `no tile satisfying the predicate found near (28, 28)` | Stale finite arena anchor in one lifecycle fixture. The other five identity, invite, boundary, return-stack, and reaping cases pass. |
| `reflectionPosition.test.ts` | `1/6` failed in `59ms`: swept-step case throws `missing flat north projectile approach` | Stale authored geometry search: the test scans fixed coordinates `136..263` while using the current bounded Combat Sandbox. Other reflection/contact cases pass. |
| `populationCohesion.test.ts` | `5/9` failed promptly (`32-58ms`): two zero-pack/pair assertion failures and three invalid/native/floor-one fixture failures | Stale fixed chunk/terrain population fixture. Pure roster and territory ownership cases pass; no enemy tuning or pack product defect is established. |
| `population/nearSpawn.test.ts` | `4/7` failed promptly (`36-60ms`): counts `2 vs 8` and `4 vs 2`, missing required pair, and missing valid boundary anchor | Stale near-spawn center/terrain envelope fixture. Cap/overlap cases that do not require the missing geometry pass; no population product defect is established. |

### Aggregate evidence

- The three cache/engine files pass together with one worker: `3` files,
  `28` tests, `20.20s`. This rules out a deterministic cache cleanup or
  isolation assertion failure in the same-worker ordering tested.
- With two workers, the cache aggregate reproduces exactly one infrastructure
  failure: `worldChunkCache.test.ts > accepts an already generated authoritative
  floor handoff` times out at `5.110s`; the other `27` cases pass. Its isolated
  `4.707s` baseline leaves too little contention margin. No timeout increase is
  authorized.
- The five server files run together with one worker in `4.62s` and reproduce
  the same `12` prompt failures / `20` passes seen in isolation. There is no
  hook, import, or worker-starvation explanation for those server failures.

### Follow-on routing

- Create one bounded cache-lifecycle fixture-cost card for the three
  cache/engine files and the exact helpers named by the master roadmap. It must
  preserve caller/public-floor isolation and explicit uncached coverage while
  making the handoff case pass under two workers; do not add a timeout or stop
  cloning.
- Create one population-fixture card for `repopulation.test.ts`,
  `populationCohesion.test.ts`, `population/nearSpawn.test.ts`, and their
  existing finite/population test support. Derive valid floor-1/floor-2 spawn,
  remote-pack, boundary, and territory geometry from prepared metadata; retain
  all tuning-derived count, cap, pair, roster, and Sandbox no-op assertions.
- Create separate lifecycle-only and projectile-only fixture cards for the
  reconnect anchor and reflection north-approach search. Neither failure
  authorizes changes to reconnect or projectile production behavior.
- Product defects established by this checkpoint: none.

## Handoff

- Changed: This workflow evidence record only. No production, test,
  test-support, cache, tuning, or configuration file changed.
- Validation: Eight exact isolated runs; one-worker three-file cache aggregate;
  two-worker three-file cache aggregate; one-worker five-file server aggregate;
  `npm run lint:working-tree` passes.
- Remaining: Independent review, then parent-created bounded follow-up cards
  using the routing above. Full suite, typecheck, and generation sweep remain
  parent-owned and were intentionally not run.

## Review

### Round 1 — `2026-08-03` — `sol-auditor / /root/finite_fixture_audit`

- Outcome: clean.
- Cache classification verification: all three cache/engine files pass in the
  recorded serial ordering, while only the authoritative floor-handoff case
  crosses the default budget under two-worker load (`4.707s` isolated,
  `5.110s` contended). That evidence supports a bounded fixture-cost/cache-
  lifecycle card and does not establish an isolation or product mismatch.
- Server classification verification: a review rerun of the five-file
  single-worker aggregate reproduced the same `12` prompt failures and `20`
  passes in `4.64s`. The reconnect and projectile failures stop in stale
  coordinate searches; the population failures use fixed or unsuitable
  floor/chunk envelopes while roster, cap, no-op, and unrelated lifecycle and
  projectile contracts remain green.
- Routing verification: cache lifecycle, population geometry, reconnect
  lifecycle, and projectile geometry remain separate bounded domains; no
  production change, assertion weakening, timeout increase, or worker change
  is authorized by this checkpoint.
- Validation: the bounded five-file server reproduction produced the exact
  recorded failure set; `npm run lint:working-tree` passes, including
  configuration-documentation and changed-folder checks. The cache commands
  were not rerun because the recorded serial/parallel timings and exact timed-
  out case are sufficient for this evidence-and-classification-only review.
- Findings: none.
- Resolution: ready for parent finalization and creation of the routed bounded
  follow-on cards.

## Memory candidates

- None.
