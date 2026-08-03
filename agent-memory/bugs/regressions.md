# Bugs and Regressions

Use this file for confirmed, recurring runtime defects: the observable symptom,
the underlying cause, and the concrete regression check that prevents a repeat.
Read it for bug fixes, incident investigation, and behavior changes that touch
an existing subsystem.

## Finite topology region-ID reuse

- Symptom: a deterministic floor-3 prewarm could fail because a required
  ordinary walkable component was disconnected from the spawn component.
- Cause: retained room admission can leave gaps in deliberate room IDs after
  rejected candidates are refilled, and maze allocation used retained-room
  count instead of the maximum retained room region ID.
- Prevention: start maze region allocation after the maximum retained room
  region ID so unrelated carved components cannot reuse a retained room ID.
- Evidence: [floor-3 prewarm topology](../../agent-workflow/archive/2026-08/2026-08-03-floor3-prewarm-topology.md)
  focused artifact and topology review.
- Last confirmed: 2026-08-03

## Finite generation must validate admitted rooms

- Symptom: a seeded finite floor could report success with fewer ordinary rooms
  than the configured target.
- Cause: room placement stopped at the pre-admission candidate count, while
  later entrance admission could discard candidates without refilling them.
- Prevention: treat room admission as part of the retained-room contract and
  assert the final admitted count in generation tests before exposing a floor
  or preview.
- Evidence: [finite-room-placement](../../agent-workflow/02_implementation/2026-08-03-finite-room-placement.md)
  review found the P1 defect even though the initial topology tests passed.
- Last confirmed: 2026-08-03

## Keep failed generation out of usable preview state

- Symptom: a failed generation attempt could leave a stale or partial visual
  result that looked like a valid dungeon.
- Cause: preview state was not cleared atomically when generation failed.
- Prevention: represent success and failure as explicit preview states and
  clear the prior trace before publishing a new attempt.
- Evidence: [generation-preview-acceptance](../../agent-workflow/01_plan/2026-08-03-generation-preview-acceptance.md)
  acceptance criteria.
- Last confirmed: 2026-08-03

## Superseded floor loads must cancel their workers

- Symptom: a newer floor snapshot could replace an older in-flight load while
  the stale worker continued generating until completion.
- Cause: the stale result was ignored by the monotonic load-attempt check, but
  replacing the callback did not invoke the prior worker's cancellation path.
- Prevention: cancel and clear the previous load before starting a newer one,
  and test stale resolve/reject callbacks against the newer loading state.
- Evidence: [cold-transition-acceptance](../../agent-workflow/archive/2026-08/2026-08-03-cold-transition-acceptance.md)
  Luna review round 1 and correction round.
- Last confirmed: 2026-08-03

## Admin spectator must use normal terrain materials

- Symptom: the live spectator camera follows the selected player but renders a
  debug/grid or otherwise incorrect tileset instead of normal gameplay
  terrain.
- Evidence: Austin's 2026-08-03 live admin/game side-by-side capture.
- Prevention: compare spectator terrain materials and retained terrain roots
  with the normal game view in an isolated-port browser acceptance run.
- Status: investigation pending.

Add entries using the schema in [`../CONTEXT.md`](../CONTEXT.md). Keep task-specific
notes in the task artifact instead of here.
