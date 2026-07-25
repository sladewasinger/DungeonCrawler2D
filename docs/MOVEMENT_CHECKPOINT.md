# Semi-stable movement checkpoint

The local Git tag `movement-semi-stable` marks the user-tested movement state
restored from `30c2dcf`.

## What works

- Sustained walking and sprinting are smooth enough for continued playtesting.
- Client prediction, reconciliation smoothing, wall contact, and partial-tick
  rendering use the `30c2dcf` behavior.

## Known defect

Releasing movement can slide the local player backward by roughly one to
several 20 Hz ticks. Rapid taps and reversals expose the problem more often.
The client predicts tick-specific movement, while the server currently keeps
only the newest held input before each simulation tick and acknowledges by
sequence number.

## Recovery point

If the tick-addressed input redesign regresses movement, return to the
`movement-semi-stable` tag or revert commits made after it. Do not discard
unrelated rendering, UI, or content changes when restoring this checkpoint.
