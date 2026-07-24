# 2D movement stutter/rubber-banding investigation

## Scope

The repository contains only two commits in the last two days:

- `9bef91c` (`2026-07-21`): **Fix lint errors**. This is a grafted/root commit in the
  available checkout and introduces the client, server, engine, and most of the 2D
  movement path, so there is no earlier local implementation to diff against.
- `d5a9de7` (`2026-07-21`): **Declare SkeletonUtils module**. This only adds a
  TypeScript declaration in `packages/client/src/three/three.d.ts`; it cannot explain
  2D movement behavior.

Therefore the likely regression is in the movement architecture introduced by
`9bef91c`, rather than in the second commit.

## Most likely cause: reconciliation races the render interpolation

The 2D client predicts movement locally in `Connection.sampleInput()` and then
replaces `conn.body` with the latest authoritative server body in
`packages/client/src/net/apply.ts:33-65`. It replays unacknowledged inputs immediately
after that replacement.

The scene's render interpolation state is separate. In
`packages/client/src/scenes/dungeon/index.ts:186-209`, `prevStep` is recorded before
each local prediction, and the camera/render pose is interpolated from that saved
position to the current `conn.body`. A network snapshot can arrive between frames and
replace/reconcile `conn.body`, but it does not reset or update `state.prevStep`.
Consequently, the next render can interpolate from a pre-snapshot local position to a
corrected authoritative/replayed position. Repeated corrections appear exactly as
rubber-banding or small backward/forward steps, especially with latency, packet jitter,
or collision differences between client and server.

This is the strongest input-adjacent explanation: input prediction is functioning, but
the render interpolation has no explicit handoff when authoritative state changes.

## Other plausible contributors

### Fixed-step catch-up can amplify visible corrections

`packages/client/src/scenes/dungeon/fixedStep.ts:15-23` consumes every tick owed by
`accumulatorMs + deltaMs`, with no maximum step count or delta clamp. A long frame can
run many predictions in one update. `sampleFixedStepInput()` then calls
`readInput()` and `conn.sampleInput()` once per owed tick
(`packages/client/src/scenes/dungeon/index.ts:186-200`). This can produce a burst of
movement, delay rendering, and make the next server correction more noticeable.

### Input is sampled in bursts, not continuously

`packages/client/src/input/keys.ts:30-42` reads the current held-key state only when a
fixed simulation step is due. If a frame misses several steps, the same current
keyboard/touch state is reused for each catch-up step. This is deterministic, but it
means a key press/release that occurs between render frames is not represented as
individual input transitions and can look uneven under load.

### Prediction history is capped at 60 entries

`packages/client/src/net/prediction.ts:16-22` drops the oldest pending input once the
queue exceeds 60 entries. If the client falls more than 60 ticks behind, reconciliation
cannot replay the complete unacknowledged history, causing a larger snap. This is
probably a secondary symptom, but it can turn a temporary stall into visible
rubber-banding.

### Rendering load can masquerade as input stutter

The 2D frame path performs terrain, entity, lighting, torch-flame, and VFX work every
frame. In particular, `packages/client/src/scenes/dungeon/frameSync.ts:164-197`
updates lighting, filters active torches, tracks motion, and updates VFX. The file
itself notes that continuous flame emitters for roughly 140 resident torches were a
significant baseline cost. A frame-time spike enters the fixed-step catch-up path above,
so rendering pressure and prediction corrections can reinforce each other even when
keyboard processing is correct.

## Less likely input-specific findings

- `InputController.readInput()` (`packages/client/src/input/index.ts:233-242`) merges
  keyboard and touch input and applies the camera-relative transform once before
  `sampleInput()`. There is no obvious per-frame accumulation or duplicate keyboard
  event in this path.
- Late touch activation installs drag listeners only after flipping `touchActive`
  (`packages/client/src/input/index.ts:221-230`), so the guarded activation itself
  should not repeatedly register listeners.
- Camera-relative movement uses exact quarter-turn transforms in
  `packages/client/src/input/cameraRelative.ts` and `render/view/viewTransform.ts`;
  this can cause a directional jump when the view rotates, but should not cause
  ordinary straight-line movement to stutter.

## Recommended confirmation steps

1. Log every snapshot application with the authoritative position, the predicted
   position before replacement, and the distance between `state.prevStep` and the
   post-reconcile body. Spikes that align with visible backward/forward motion would
   confirm the interpolation handoff issue.
2. Log `deltaMs`, fixed-step count, accumulator size, pending prediction length, and
   snapshot `lastSeq`. Reproductions with multiple catch-up steps or a queue near 60
   indicate frame-time/network pressure rather than a key event problem.
3. Temporarily render the raw predicted body (no `interpolateSelfPose()`). If the
   stutter largely disappears, keep input sampling and focus on reconciliation/render
   state synchronization.
4. Temporarily disable torch flames/lighting and compare frame time. If the issue
   improves without changing input, rendering load is triggering the fixed-step
   behavior.
5. Test with an artificial RTT/jitter profile. A strong correlation between jitter and
   corrections distinguishes network reconciliation from local keyboard handling.

## Conclusion

The evidence does not point to a simple keyboard listener bug. The leading explanation
is that authoritative snapshot reconciliation mutates `conn.body` asynchronously while
the 2D renderer continues interpolating from an older `prevStep`. Unbounded fixed-step
catch-up and frame-time spikes are likely amplifiers. Input processing should still be
instrumented, but the first fix investigation should target the snapshot-to-render
handoff and the fixed-step budget.
