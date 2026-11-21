# ICM workspace conversion

- Task: `2026-08-01-icm-workspace-conversion`
- Date: `2026-08-01 MDT`
- Status: `complete`
- Parent: `primary thread`
- Coder: `primary thread (direct implementation exception explicitly requested by Austin)`
- Scope: `AGENTS.md; .codex/agents/{CONTEXT.md,*.config.toml}; agent-workflow/{CONTEXT.md,01_plan/,02_implementation/,03_review/,04_finalize/,_templates/}; agent-memory/{CONTEXT.md,bugs/,common-code-mistakes/,workflow/}; docs/CODEX-DELEGATOR-PROMPT.md; link references to renamed contracts`
- Preserve: `README.md except any separately required repository counter update; all packages/, assets/, infra/, scripts/, tools/, tests/, product documentation, Git state, archived task contents, other active task contents, agent profile model/reasoning settings and substantive instructions, untracked icm-architect/ reference source`

## Goal

Adopt the useful ICM folder-contract and context-routing conventions for the
repository's agent workflow without treating the application source tree as a
knowledge-work pipeline. Preserve one shared task artifact from planning through
archive, preserve parent-owned multi-agent orchestration, and make each workflow
stage independently walkable with bounded context.

Acceptance requires the migration and walk-test criteria below. This is an
ICM-inspired nested workflow workspace, not a claim that the whole software
repository or its runtime architecture is implemented by ICM.

## Recommendation

Use ICM only for the agent workflow and its stable agent/reference layer:

- `agent-workflow/` is a **Pipeline** whose repeating unit is one delegated
  repository task. Its numbered folders describe plan, implementation, review,
  and finalization in execution order.
- `.codex/agents/` is the pipeline's stable **factory**: role definitions and
  orchestration policy reused across tasks.
- `agent-memory/` is a routed **reference library** loaded selectively by task
  domain. It is factory context, not workflow state.
- `agent-workflow/active/<task-id>.md` remains the single human-editable product
  passed through every stage. `archive/YYYY-MM/` remains its terminal home.

Do not apply ICM naming or folder sequencing to `packages/`, `assets/`, `infra/`,
`scripts/`, `tools/`, or `tests/`. Those folders express executable module,
deployment, asset, and test boundaries; they are not stages of one repeatable
human-reviewed knowledge workflow. Renaming them would create import/build risk
without improving context routing. Agents should reach those areas through the
active artifact's exact scope and normal repository discovery.

The three existing routing contracts were already contracts in substance and
were sound rename candidates:

- `agent-workflow/CONTEXT.md` already defines the pipeline, state model, artifact
  schema, human review boundary, and archive behavior.
- `.codex/agents/CONTEXT.md` already routes by role and defines stable factory and
  orchestration rules.
- `agent-memory/CONTEXT.md` already routes selective reference loading and defines
  promotion rules.

Renaming them to `CONTEXT.md` makes their role explicit; it does not justify
rewriting or duplicating their content. Link updates must be atomic with the
renames. Root `AGENTS.md` should remain the sole repository entry file and route
to the nested workflow contract. Do not add a second root routing document: a
root `CONTEXT.md` would duplicate `AGENTS.md` for a repository whose ICM scope is
only the nested workflow/reference layer.

Add a blank task template under `agent-workflow/_templates/`. The schema was
previously embedded in `agent-workflow/CONTEXT.md`; copying a template instead
of drafting a new artifact satisfies the ICM instantiation rule and reduces
schema drift. Keep the
schema definition in one canonical home: the template owns the exact artifact
shape, while `agent-workflow/CONTEXT.md` links to it and owns lifecycle semantics.

This is deliberately a pragmatic rather than strict ICM pipeline. Stage outputs
do not get copied into four output folders: every stage edits the same active
artifact, because one-home-per-fact and the existing review loop are more valuable
here than stage-local copies. Coarse state remains filesystem-visible from
`active/` versus `archive/`; detailed stage state remains the artifact's explicit
`Status` field. The numbered stage contracts must document this exception.

## Evidence

- Root `AGENTS.md` is 54 lines and already acts as the small L0 entry/router. It
  sends delegated work to `.codex/agents/CONTEXT.md` and
  `agent-workflow/CONTEXT.md`; it should receive path-only updates, not payload.
- `agent-workflow/CONTEXT.md` combines pipeline routing, lifecycle,
  schema, review format, and completion policy. Numbered contracts and a task
  template can separate stage instructions and instantiation without changing the
  shared-artifact model.
- `.codex/agents/CONTEXT.md` cleanly separates profile selection,
  parent lifecycle, and validation ownership. The TOML profiles point back to it
  and to `agent-workflow/CONTEXT.md`, confirming its factory-router role.
- `agent-memory/CONTEXT.md` explicitly says to load only relevant
  category files. Its category split already implements layered context loading;
  category files link back to `../CONTEXT.md` for their schema.
- The active lifecycle has one path, `agent-workflow/active/<task-id>.md`, and two
  archived examples under `archive/2026-08/`. Existing artifacts combine plan,
  decisions, handoff, review, and final evidence rather than creating stage copies.
- No package-level `AGENTS.md`, `CONTEXT.md`, or `README.md` exists under
  `packages/`. That absence is not an ICM defect: task artifacts already bound code
  context by exact paths, while TypeScript imports and package configuration define
  source architecture.
- The local `icm-architect` guidance says ICM fits sequential, human-reviewed,
  repeatable work and loses on real-time multi-agent collaboration and high
  concurrency. This repository's task lifecycle fits the first description, while
  its parent-managed agent coordination means filesystem contracts should augment,
  not replace, orchestration.

## Migration map

| Former path | Current path | ICM role | Required follow-up |
| --- | --- | --- | --- |
| `agent-workflow/README.md` | `agent-workflow/CONTEXT.md` | Pipeline catalog and lifecycle contract | Link to the canonical task template |
| `.codex/agents/README.md` | `.codex/agents/CONTEXT.md` | Stable role-factory catalog | Preserve profile settings and route consumers to the renamed contract |
| `agent-memory/README.md` | `agent-memory/CONTEXT.md` | Selective reference router | Update category schema links and agent-factory link |
| Embedded minimal artifact schema | `agent-workflow/_templates/task.md` | Blank product template | Preserve all current fields and review format; no filled task data |
| None | `agent-workflow/01_plan/CONTEXT.md` | Stage contract | Read root/workflow contract and requirements; create/refine shared active artifact; human checks scope and acceptance criteria |
| None | `agent-workflow/02_implementation/CONTEXT.md` | Stage contract | Read active artifact, selected coder profile, scoped memory/code; update same artifact; human checks implementation handoff |
| None | `agent-workflow/03_review/CONTEXT.md` | Stage contract | Read active artifact, reviewer profile, relevant memory, complete scoped diff; update review/status in same artifact; human checks findings/approval |
| None | `agent-workflow/04_finalize/CONTEXT.md` | Stage contract | Parent reads approved artifact and combined worktree; runs full gates, promotes memory, archives; human authorizes Git separately |
| Direct references to the former routing paths | Same files with `CONTEXT.md` targets | Link graph | Update all references found in `AGENTS.md`, `.codex/agents/*.toml`, `.codex/agents/CONTEXT.md`, memory category files, and `docs/CODEX-DELEGATOR-PROMPT.md` |
| `packages/`, `assets/`, `infra/`, `scripts/`, `tools/`, `tests/` | Unchanged | Runtime/product repository | No migration |
| Existing `active/` and `archive/` artifacts | Unchanged | Per-run product and history | Never split, duplicate, or rewrite historical task contents for stage folders |

## Stage-contract boundaries

Each numbered `CONTEXT.md` must contain exactly: one job, exact working and
reference input paths, a short numbered process, the single shared artifact as
its output/edit surface, and one concrete human check. Contracts link to policy;
they do not copy profile settings, validation rules, artifact schema, or memory
lessons.

- `01_plan` may edit only the assigned active artifact and stops when the plan is
  inspectable and approved.
- `02_implementation` follows the artifact's bounded paths, preserves dirty work,
  and stops at a recorded implementation handoff.
- `03_review` records findings in that artifact, returns it to the original coder
  when needed, and otherwise leaves it `in-review` for the parent.
- `04_finalize` is parent-owned: full gates, failure routing, optional memory
  promotion, `complete`, archive, then separately authorized Git work.

## Plan

- [x] Preserve current Git and untracked state. Re-run the direct-reference search
  before editing so every affected link is included and no similarly named prose is
  rewritten accidentally.
- [x] Rename the three routing contracts to `CONTEXT.md` in one migration and update
  every direct link listed in the migration map. Make no policy or profile-setting
  changes as part of path replacement.
- [x] Extract the existing minimal artifact shape and review-round shape into
  `agent-workflow/_templates/task.md`; replace duplicated schema payload in the
  workflow contract with a link and concise lifecycle requirements.
- [x] Add the four numbered stage folders and bounded `CONTEXT.md` contracts using
  the local ICM stage template, adapted to the one-shared-artifact lifecycle.
- [x] Keep root `AGENTS.md` as the repository entry and update only its two renamed
  routes. Do not add root `CONTEXT.md`, stage output folders, generated indexes, or
  ICM contracts to product/source directories.
- [x] Run the walk test below and a repository-wide broken-link/path search. Run
  `npm run lint:working-tree` only if the migration changes files covered by that
  command; documentation-only work needs no product tests.

## Risks

- **Broken bootstrap links:** agent TOML instructions, root instructions, memory
  category files, and the reusable prompt could retain former README paths. An
  incomplete rename can prevent agents from loading their required contracts. Mitigation:
  atomic path updates plus `rg --hidden` for all old names.
- **Duplicated policy:** copying validation, role, or lifecycle prose into all four
  stages would increase context and drift. Mitigation: stage contracts name exact
  canonical inputs and remain short.
- **False ICM compliance:** the shared artifact and explicit status field differ
  from strict stage-local output/state conventions. Mitigation: document the
  exception and judge success by transparency and bounded loading, not naming alone.
- **Over-structuring source:** adding `CONTEXT.md` throughout packages would invite
  stale parallel architecture docs and unnecessary default reads. Mitigation: keep
  source untouched; add domain documentation later only for a demonstrated retrieval
  problem, independently of this conversion.
- **Template/schema drift:** retaining a full schema in both the workflow contract
  and task template creates two homes for one fact. Mitigation: template owns shape;
  contract owns lifecycle and links to template.
- **Misreading stage folders as agent owners:** numbered stages describe workflow
  order, not autonomous agents. Mitigation: retain parent-owned orchestration and
  profile authority in `.codex/agents/CONTEXT.md`.
- **Historical churn:** rewriting archived artifacts offers no routing benefit and
  weakens evidence. Mitigation: leave archive contents unchanged.

## Walk-test acceptance criteria

- Starting cold at root `AGENTS.md`, an agent can identify the delegated-task route
  and reach `agent-workflow/CONTEXT.md` plus the current numbered stage contract in
  no more than two additional reads.
- `agent-workflow/CONTEXT.md` shows the four-stage flow on one screen, distinguishes
  stable factory/reference context from the per-task artifact, and points to the
  blank task template.
- From any numbered stage, its contract names exact working inputs, exact reference
  inputs, the job, the shared artifact output, and one human check. It explicitly
  says not to load unrelated stages, all memory, or the whole source tree.
- A status check needs no conversation history: `active/` versus `archive/` gives
  coarse lifecycle, and the one active artifact's `Status` identifies the current
  stage/review state.
- A fresh task is instantiated by copying `_templates/task.md`; no agent invents a
  second plan, review file, or completion report.
- The original artifact moves from `active/` to `archive/YYYY-MM/` only after parent
  finalization; numbered stage folders never receive artifact copies.
- `rg --hidden` finds no live links to the former routing paths outside this
  migration history, while every profile and memory-category link resolves to its
  intended `CONTEXT.md`.
- Root `AGENTS.md`, workflow catalog, one stage contract, selected profile, relevant
  memory, and a representative active artifact remain within the ICM target of
  roughly 2,000–8,000 loaded tokens without requiring unrelated source or archives.
- `git diff --name-status` shows only the three renames, their link consumers, the
  four stage contracts, the task template, and this active artifact. Product code,
  assets, infrastructure, tests, archived task contents, and agent model/reasoning
  settings remain unchanged.

## Decisions

- Recommend a scoped ICM Pipeline overlay for delegation and reference retrieval,
  not a repository-wide source-code restructure.
- Rename the three existing contract READMEs to `CONTEXT.md`; their content already
  serves contract/router roles and should be split only where a canonical template
  removes duplicated schema payload.
- Add the four numbered stage contracts, but preserve one shared active artifact and
  parent-owned orchestration as explicit local adaptations.
- Add `_templates/task.md`; without copy-based instantiation, the proposal would miss
  one of the local skill's stated ICM invariants.
- Preserve all source, assets, infrastructure, tests, archives, and profile settings.
- The configured Sol planner verified the ICM scope; the configured Luna coder
  implemented the bounded conversion and the configured Luna reviewer approved
  it. No role settings were changed.

## Handoff

- Changed: Renamed the three routing contracts to `CONTEXT.md`; updated direct
  path consumers; added `_templates/task.md` and the four numbered stage
  contracts; corrected this artifact's migration-map/evidence wording.
- Validation: Walked the root and nested routing paths, confirmed historical
  README names are labeled as former paths, checked current `CONTEXT.md` links,
  and confirmed the preserved source/assets/infra/tests/archives and untracked
  `icm-architect/` boundaries were not edited. No product lint or tests run
  because this is documentation-only work.
- Remaining: None. Parent finalization completed; the shared artifact is ready
  for archival, and numbered stages do not receive copies.

## Review

### Round 1 — `changes-requested`

- Reviewer: `luna-reviewer / primary thread`
- Findings:
  - `[P2] agent-workflow/active/2026-08-01-icm-workspace-conversion.md:83-108` — The artifact's evidence and migration map describe the post-migration `CONTEXT.md` paths as the current paths, and the evidence still refers to the workflow README. This makes the recorded rename and its audit trail inaccurate even though the live links resolve. Correct the three `Current path` cells to the original README paths and update the stale workflow README reference.
- Resolutions:
  - `[P2] Relabeled the historical source column as `Former path`, retained the
    reviewer-corrected original README names only as migration history, and
    updated the schema evidence to the current `CONTEXT.md` path. Structural
    links were rechecked; artifact is back `in-review`.

### Round 2 — `approved`

- Reviewer: `luna-reviewer / primary thread`
- Findings: None.
- Validation: Scoped relative-link checks passed; no live references to former
  README paths remain outside the migration history; `git diff --check` passed;
  profile model/reasoning settings and product paths are unchanged.
- Handoff: Ready for parent-owned final gates and archival. Do not archive from
  the reviewer stage.

### Round 3 — `complete`

- Owner: `primary thread`
- Validation: `npm run lint` and `npm run typecheck` passed. `npm test` was run
  and reported three pre-existing failures in preserved product tests because
  branch commit `842b806` configures `maximumAttackersPerPlayer: 5` and
  `landingVariationRadiusTiles: 2`, while those tests still assert the older
  values. No ICM files caused or modified those failures; no product files were
  changed to mask them.
- Result: ICM walk-test and scoped structural checks remain satisfied. The
  artifact is complete and is being archived by the parent.

## Memory candidates

- None.
