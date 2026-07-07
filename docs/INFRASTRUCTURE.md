# Infrastructure — AWS, Serverless, Terraform

Constraint that drives every choice here: **minimize AWS cost over performance (within reason)**. Domain is already owned. All infra is defined in Terraform.

## Can this be serverless? Yes — and it's the natural fit

The instinct that real-time games can't be serverless is right in general but doesn't apply here, because of where our real-time actually happens:

- **The game loop is client-side.** Phaser rendering, the effects-engine tick, dungeon generation, combat — all of it runs in the player's browser. The server never simulates anything in real time.
- **The backend is request/response only.** Craft an item (one POST, dominated by a multi-second AI call anyway), fetch the item registry (GET, highly cacheable), save/load (occasional PUT/GET). No websockets, no server tick, no persistent connections.

So Lambda's weaknesses (cold starts ~200–400 ms, no persistent connections) don't hurt us: a 300 ms cold start on a crafting call that takes 3–8 s of AI inference is invisible, and registry reads get cached at the CDN edge so most never reach Lambda at all.

**The line where this stops being true:** real-time *multiplayer* (co-op dungeon runs with live position/combat sync). That needs persistent connections and a server-authoritative tick. It is not on the roadmap; the "shared world" in v0.6 is asynchronous (shared item registry), which is plain request/response. If co-op ever becomes a goal, the options at that point:

| Option | Fit | Cost shape |
| --- | --- | --- |
| API Gateway WebSocket + Lambda | OK for slow-tick/turn-based sync (≤ a few msgs/sec/player); ~50–150 ms latency makes twitchy action combat feel bad | ~$1/M messages + $0.25/M connection-minutes — 4 players × 2 h/day ≈ **pennies/mo**, but per-message Lambda invocations add up at high tick rates |
| Small always-on container (Fargate/EC2) only while needed | Right answer for true real-time action co-op | ~$3–9/mo minimum, always burning |
| WebRTC peer-to-peer + serverless signaling | One player hosts the sim; server only matchmakes | Nearly free, but NAT/complexity tax |

Decision: **fully serverless now; revisit only if real-time co-op enters the roadmap.**

## Architecture

```
players ──▶ Route 53 (yourdomain.com)
              │
              ▼
          CloudFront ──────────────┬──────────────────────────┐
              │                    │                          │
        S3 (static site:      /api/* → API Gateway       cached GETs
        game bundle, assets)       (HTTP API)             (registry reads
                                   │                       served from edge)
                                   ▼
                               Lambda (Node 22, TypeScript)
                                   │            │
                                   ▼            ▼
                              DynamoDB      Claude API
                            (registry,    (AI crafting; key in
                             saves)        SSM Parameter Store)
```

Component choices, each picked for cost:

| Component | Choice | Why (vs. alternative) |
| --- | --- | --- |
| DNS | Route 53 hosted zone | $0.50/mo; alias queries to CloudFront are free |
| TLS | ACM certificate | Free, auto-renews |
| Static hosting | S3 + CloudFront | CloudFront always-free tier: 1 TB egress + 10M requests/mo — covers us outright |
| API | API Gateway **HTTP API** (not REST API) | $1.00/M requests vs REST API's $3.50/M; built-in throttling for rate limiting |
| Compute | Lambda (Node 22, esbuild-bundled) | Always-free tier: 1M invocations + 400K GB-s/mo — $0 at our scale, $0 idle |
| Data | DynamoDB **on-demand** | No provisioned capacity to pay for while idle; 25 GB storage always free; ~$0.13/M reads |
| Secrets | SSM Parameter Store (standard) | Free, vs Secrets Manager's $0.40/secret/mo |
| Logs | CloudWatch, 2-week retention | 5 GB/mo ingest free; short retention caps growth |
| Cost guardrail | AWS Budgets alert at $10/mo | Free; email before anything surprises us |

Region: **us-east-1** (required region for CloudFront ACM certs anyway, and cheapest).

Cost tricks worth naming:
- **Registry reads are cached at CloudFront**, keyed on path, short TTL. Item definitions are immutable once accepted, so repeat fetches cost $0 and never invoke Lambda.
- **Registry-first crafting** (see AI_CRAFTING.md): a craft request checks DynamoDB before calling the AI. Only genuinely new (ingredients + intent) combinations pay for inference.
- **Lambda memory tuned low** (256 MB) — our handlers are I/O-bound (waiting on Claude/DynamoDB), not CPU-bound.

## Cost estimates

### Idle (deployed, nobody playing)

| Item | $/mo |
| --- | --- |
| Route 53 hosted zone | 0.50 |
| S3 storage (~50 MB site + assets) | 0.01 |
| CloudFront, Lambda, API Gateway, DynamoDB (no traffic) | 0.00 |
| CloudWatch (retained logs) | ~0.03 |
| **Total idle** | **≈ $0.55/mo** |

(Plus the domain's annual renewal, already owned.)

### Active — 4 concurrent players (≈ 20–40 total players, casual daily play)

Assumptions: 4 players online at a time, ~2 h/day each; game bundle ~10 MB (CDN-cached after first load); ~50K API requests/mo (registry reads mostly edge-cached, saves, craft attempts); ~40 *new-item* AI crafts/day worst case early on (dedupe drives this toward zero as the registry fills).

| Item | $/mo |
| --- | --- |
| Fixed (Route 53, S3, logs) | 0.55 |
| CloudFront egress + requests | 0.00 (inside always-free tier) |
| API Gateway (~50K req) | 0.05 |
| Lambda (~50K invocations, 256 MB, avg 300 ms) | 0.00 (inside always-free tier) |
| DynamoDB (~200K reads, ~20K writes, on-demand) | 0.04 |
| **AWS infra total** | **≈ $0.65/mo** |
| AI API (the real cost — see below) | 1 – 12 |
| **Grand total** | **≈ $2 – 13/mo** |

The lesson: at this scale **infrastructure is a rounding error; AI inference is the entire cost model.** Everything in the crafting design that reduces AI calls (registry-first lookup, dedup, rate limits) is a cost-control feature, not just a design nicety.

### AI API cost per craft (Claude API, current pricing)

A crafting call ≈ 3.5K input tokens (system prompt with primitive catalog + ingredient defs + player prompt) and ~600 output tokens (the ItemProposal JSON). The system prompt is identical across calls, so prompt caching cuts its input cost ~90% on repeats.

| Model | $/MTok in/out | Cost per craft (uncached → cached) | 1,200 new crafts/mo |
| --- | --- | --- | --- |
| Haiku 4.5 | $1 / $5 | $0.007 → ~$0.004 | ~$5–8 |
| Sonnet 5 | $3 / $15 (intro $2/$10 thru Aug 2026) | $0.020 → ~$0.011 | ~$13–24 |
| Opus 4.8 | $5 / $25 | $0.033 → ~$0.018 | ~$22–36 |

1,200 new crafts/mo is the pessimistic ceiling (every player inventing 10 genuinely new items daily); realistically the registry converges and steady-state is a fraction of that — hence the $1–12 range above. Even Opus-tier quality costs less than a coffee per month at this scale, so the model choice (AI_CRAFTING.md open question #1) can be made on **proposal quality, not price**. Sensible starting point: a top-tier model for crafting (it's the product's signature moment and low-volume), with room to route to Haiku for cheap pre-checks (intent classification, dedupe assist) later.

### Sanity check vs. always-on alternatives

| Approach | Idle $/mo | Notes |
| --- | --- | --- |
| **This design (serverless)** | **~$0.55** | scales to zero |
| EC2 t4g.nano + EBS | ~$4 | cheapest always-on box, still needs the CDN/DNS spend on top |
| Fargate 0.25 vCPU / 0.5 GB | ~$9 | |
| Lightsail smallest bundle | ~$5 | |

Any always-on option costs more *idle* than the serverless stack does *under load*. For a hobby-scale game with bursty traffic, serverless wins on cost with no contest.

## Terraform layout

Introduced in **Epic 8 (v0.5)** — the first release with any backend. Frontend-only releases (v0.1–v0.4) can deploy by hand or via a trivial S3-sync action; we bring in Terraform when there's real infrastructure to define, and retrofit the frontend hosting into it at that point.

```
infra/
├── backend.tf              # S3 remote state, native lockfile locking (TF ≥ 1.10 — no DynamoDB lock table)
├── versions.tf             # pinned terraform + AWS provider versions
├── envs/
│   └── prod/               # single env to start; dev added only if ever needed
│       ├── main.tf         # composes the modules
│       └── terraform.tfvars
└── modules/
    ├── frontend/           # S3 bucket, CloudFront distro, ACM cert, Route 53 records
    ├── api/                # HTTP API, Lambda(s), DynamoDB tables, SSM params, IAM
    └── guardrails/         # AWS Budgets alert, CloudWatch alarms, log retention
```

Principles:

1. **One environment until pain demands two.** A dev copy of a stack this cheap is fine to add later; starting with envs multiplies everything for no benefit.
2. **State in S3 with native locking** (`use_lockfile = true`) — avoids the classic DynamoDB lock-table setup entirely.
3. **Lambda artifacts built outside Terraform** (esbuild → zip in CI or npm script); Terraform deploys the artifact hash. Keeps `terraform plan` fast and honest.
4. **The AI API key never touches Terraform state or the repo.** It's written to SSM Parameter Store once, manually (`aws ssm put-parameter --type SecureString`); Terraform references the parameter by name only.
5. **Everything tagged** (`project = dungeoncrawler2d`) so Cost Explorer can attribute every cent.

## Deployment flow

- **Frontend:** `npm run build` → sync `dist/` to S3 → CloudFront invalidation (`/index.html` only; hashed assets are immutable). GitHub Actions on push to `main`.
- **Backend:** esbuild bundle → zip → `terraform apply` (or `aws lambda update-function-code` for code-only changes in CI).
- **Infra changes:** PR with `terraform plan` output, apply on merge.

## What this changes in earlier docs

- ARCHITECTURE.md backend row: ~~Node + Fastify~~ → **AWS Lambda (Node + TypeScript) behind API Gateway** — same handler code style, no server process to manage. Handlers stay framework-free (plain functions) so they're testable and portable if we ever *do* need a container.
- AI_CRAFTING.md server evolution: v0.5 "minimal Node proxy" = one Lambda + HTTP API route; v0.6 registry = DynamoDB table + a few more routes; the kill-switch is a DynamoDB flag checked at read time.
