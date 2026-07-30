# v0.7.1 Render Presentation Assessment

Run the deterministic comparison with:

```text
npm run benchmark:render
```

The benchmark uses dungeon seed `228182761`, floor 1, and the same 64×36-tile
camera window for both modes. Classic represents `main`'s behavior: every
planned terrain quad is submitted and the bounded player ground light may own
up to 491 objects.

| Metric | Classic baseline | Toon |
| --- | ---: | ---: |
| Candidate terrain quads | 3,772 | 3,772 |
| Submitted terrain quads | 3,772 | 44 |
| Player ground-light objects | up to 491 | 0 |
| Visibility-mask objects | 0 | 1 |
| Exact terrain LOS checks | 0 | 41 |

Toon submitted 98.8% fewer terrain quads in this occluded corridor view. Its
angular wall-shadow sweep evaluated 2,720 bounded camera cells, then used the
engine's exact monotonic-elevation LOS rule for the 41 cells not already hidden,
including opaque targets. That retained 21 visible tiles and completed in
0.84 ms median across 25 warm samples on the development host. Timing is
machine-specific; the object and quad counts are deterministic.

The matching 1280×720 headless-Chromium smoke at world position `(1.5, 1.5)`
also completed without browser errors. Classic submitted all 1,136 candidate
quads and owned 17 active ground-light objects; Toon submitted 44 quads, owned
one mask, and owned zero ground-light objects. Toon also remained aligned during
a captured cosmetic camera-rotation frame. The modes measured 54 and 55 FPS
respectively under the headless browser's ceiling, so this smoke proves runtime
wiring and work reduction rather than a meaningful FPS delta on powerful
hardware.

## Constrained-device budgets

The automatically selected phone/slow-hardware profile changes real production
limits rather than advisory memory estimates:

| Budget | Desktop | Constrained |
| --- | ---: | ---: |
| Cached terrain plans | 32 | 16 |
| Retained orientation roots | 4 | 2 |
| Retained world chunks | 96 | 48 |
| Fire / poison / steam rigs | 24 / 12 / 10 | 10 / 5 / 4 |
| Poison bubbles | 192 | 72 |
| Active entity-status rigs | 32 | 16 |
| Fire sparks / poison gas per rig | 4 / 6 | 2 / 3 |

The constrained profile also disables ambient-occlusion and biome-tint passes,
culls offscreen entities and area effects, and emits expensive area particles
at 2.25× the desktop interval. Advanced Settings → Graphics → Performance
profile can force this same profile on weak laptops that automatic hardware
detection misses; changing it reloads the scene so every renderer shares the
same profile.

## Interpretation

This proves that Toon submits materially less terrain and uses fewer light
objects than the current worktree's Classic path, whose full-world submission
behavior matches `main`. It does not execute a separate `origin/main` build and
is not a claim about every GPU or scene. Final acceptance still requires
Austin's browser, phone, and slow-laptop playtests before deployment.
