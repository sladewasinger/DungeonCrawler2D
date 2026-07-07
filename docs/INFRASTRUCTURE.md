# Infrastructure — AWS, Hybrid Serverless, Terraform

Constraint that drives every choice here: **minimize AWS cost over performance (within reason)**. Domain is already owned. All infra is defined in Terraform.

## How multiplayer changes the serverless answer

This is a real-time co-op game with a **server-authoritative simulation** (see [ARCHITECTURE.md](ARCHITECTURE.md)). That sim is a stateful, long-running process holding session state in memory and ticking at 20 Hz — the one workload Lambda categorically cannot host (no persistent process, no persistent connections). API Gateway WebSockets + Lambda can't host it either: they give you connections, but each message invokes a stateless function — there's nowhere for the authoritative tick loop to live, and per-message invocation pricing gets ugly at real-time rates anyway.

So the architecture is **hybrid**:

- **Game sessions** → a small, cheap, stateful **game server** (Node + `ws`) on EC2. This is the one always-on-ish component.
- **Everything else stays serverless** — static frontend, AI crafting proxy, item registry, saves. These are request/response, not latency-sensitive, and cost ~$0 idle. Crafting in particular spends seconds waiting on AI inference; a Lambda cold start is invisible there.

Rejected alternatives for the game server, with reasons:

| Option | Why not |
| --- | --- |
| API Gateway WebSocket + Lambda | No home for the stateful 20 Hz tick; per-message Lambda invocations at real-time rates cost more than a whole EC2 box |
| Fargate always-on (0.25 vCPU/0.5 GB) | ~$9/mo — 3× the EC2 nano price for the same work |
| Fargate **Spot** | ~$3/mo, but interruption kills live game sessions with 2 min warning. "Cheap over performance" has a limit, and dropping a party mid-boss is past it |
| Network Load Balancer for TLS | ~$16/mo base charge — costs more than the server it fronts. TLS terminates on the box instead (below) |

## Architecture

```
players ──▶ Route 53 (yourdomain.com)
              │
   ┌──────────┴─────────────────────────────┐
   ▼                                        ▼
CloudFront                          play.yourdomain.com (A record)
   │                                        │
   ├─ S3: static site               EC2 t4g.nano/micro
   │   (game client bundle)         ├─ Caddy: wss:// TLS termination
   │                                │   (free Let's Encrypt certs, auto-renew)
   └─ /api/* → API Gateway          └─ game-server (Node + ws)
       (HTTP API)                       ├─ authoritative sim: floor shards,
           │                            │   AOI replication, chat fan-out
           │                            └─ pulls registry defs, pushes world
           ▼                                & stash deltas to DynamoDB
       Lambda (Node 22)
       ├─ /craft → Claude API (key in SSM)
       ├─ /registry → DynamoDB
       └─ /shard-broker → tells client which
           game server/shard to connect to
           (trivial now, the scale-out seam later)
```

Component choices, each picked for cost:

| Component | Choice | Why (vs. alternative) |
| --- | --- | --- |
| DNS | Route 53 hosted zone | $0.50/mo; alias queries to AWS resources are free |
| TLS (web) | ACM certificate on CloudFront | Free, auto-renews |
| TLS (websocket) | **Caddy on the game server** | Free Let's Encrypt, zero-config renewal — avoids the $16/mo NLB entirely |
| Static hosting | S3 + CloudFront | CloudFront always-free tier: 1 TB egress + 10M requests/mo — covers us outright |
| Game server | **EC2 t4g.nano** (2 vCPU burst, 0.5 GB, ARM) at $3.06/mo; bump to t4g.micro ($6.13/mo, 1 GB) if memory-pressured | Thanks to AOI replication and active-chunk simulation (only chunks near players tick — see [ARCHITECTURE.md](ARCHITECTURE.md)), a 20 Hz Node sim hosting tens of players across floor shards is tiny. Cheapest possible stateful compute |
| API | API Gateway **HTTP API** | $1.00/M requests vs REST API's $3.50/M |
| Services compute | Lambda (Node 22, esbuild-bundled) | Always-free tier: 1M invocations + 400K GB-s/mo — $0 at our scale, $0 idle |
| Data | DynamoDB **on-demand** | No provisioned capacity while idle; 25 GB storage always free |
| Secrets | SSM Parameter Store (standard) | Free, vs Secrets Manager's $0.40/secret/mo |
| Logs | CloudWatch, 2-week retention | 5 GB/mo ingest free |
| Cost guardrail | AWS Budgets alert at $15/mo | Free; email before anything surprises us |

Region: **us-east-1** (required region for CloudFront ACM certs anyway, and cheapest).

Cost-control details:

- **Stop-when-idle option:** a stopped EC2 instance costs only its EBS volume (~$0.64/mo). During development, stop the box when nobody's playtesting (one CLI command or a scheduled Lambda that stops it after N minutes with zero sessions — the session broker knows). Pre-launch, this keeps months where nobody plays at ~$1.20 total.
- **The public IPv4 tax:** AWS charges $3.65/mo per public IPv4 on a running instance (since Feb 2024). Unavoidable for a websocket endpoint; it's the second-largest line item, which tells you how cheap everything else is.
- **Registry reads cached at CloudFront**; game servers also cache definitions in memory — accepted items are immutable.
- **Registry-first crafting** (see [AI_CRAFTING.md](AI_CRAFTING.md)): only genuinely new (ingredients + intent) combinations pay for AI inference.
- **Game traffic egress is negligible:** AOI replication caps per-player bandwidth at a constant (~16 kB/s of deltas) regardless of world size or population; 4 concurrent players ≈ 14 GB/mo at 2 h/day — inside the 100 GB/mo always-free egress tier.
- **World persistence is cheap:** hibernated-chunk deltas and stashes are periodic small writes to DynamoDB — thousands of writes/mo cost fractions of a cent on on-demand.

## Cost estimates

### Idle (deployed, nobody playing)

| Item | Game server **stopped** | Game server **running 24/7** |
| --- | --- | --- |
| Route 53 hosted zone | 0.50 | 0.50 |
| S3 + CloudWatch + misc | 0.05 | 0.05 |
| EBS root volume (8 GB gp3) | 0.64 | 0.64 |
| EC2 t4g.nano | — | 3.06 |
| Public IPv4 | — | 3.65 |
| Lambda / API GW / DynamoDB / CloudFront | 0.00 | 0.00 |
| **Total** | **≈ $1.20/mo** | **≈ $7.90/mo** |

### Active — 4 concurrent players (≈ 20–40 total players, casual daily play)

Assumptions: game server running 24/7 (t4g.nano), 4 players online at a time ~2 h/day, ~50K API requests/mo to the serverless side, ~40 new-item AI crafts/day worst case early on.

| Item | $/mo |
| --- | --- |
| Fixed + game server (from table above) | 7.90 |
| CloudFront, Lambda, game egress | 0.00 (inside always-free tiers) |
| API Gateway (~50K req) | 0.05 |
| DynamoDB (~200K reads, ~20K writes, on-demand) | 0.04 |
| **AWS infra total** | **≈ $8/mo** |
| AI API (see below) | 1 – 12 |
| **Grand total** | **≈ $9 – 20/mo** |

Two lessons: (1) the game server + its IP is now the dominant *infrastructure* cost, and it's still under $8; (2) **AI inference remains the real cost model** — everything in the crafting design that reduces AI calls (registry-first lookup, dedup, rate limits) matters more than any AWS choice.

### AI API cost per craft (Claude API, current pricing)

A crafting call ≈ 3.5K input tokens (system prompt with primitive catalog + ingredient defs + player prompt) and ~600 output tokens (the ItemProposal JSON). The system prompt is identical across calls, so prompt caching cuts its input cost ~90% on repeats.

| Model | $/MTok in/out | Cost per craft (uncached → cached) | 1,200 new crafts/mo |
| --- | --- | --- | --- |
| Haiku 4.5 | $1 / $5 | $0.007 → ~$0.004 | ~$5–8 |
| Sonnet 5 | $3 / $15 (intro $2/$10 thru Aug 2026) | $0.020 → ~$0.011 | ~$13–24 |
| Opus 4.8 | $5 / $25 | $0.033 → ~$0.018 | ~$22–36 |

1,200 new crafts/mo is the pessimistic ceiling; the registry converges and steady-state is a fraction of that. Even Opus-tier quality costs less than a coffee per month at this scale, so the model choice (AI_CRAFTING.md open question #1) can be made on **proposal quality, not price**.

### Scale-out path (documented now, built when needed)

One t4g.nano handles the entire beta comfortably — with AOI and active-chunk simulation, a 20 Hz JSON sim for tens of concurrent players is a rounding error for even half a vCPU. When (if) concurrent load outgrows one box:

1. **Vertical first:** t4g.micro → small → medium. Each step is a Terraform variable change; capacity roughly doubles per step, cost stays single-digit dollars.
2. **Horizontal via the broker:** the shard broker (already the connection point) assigns floor shards across N game servers registered in DynamoDB. A shard never spans servers, so there's no shared-state problem; cross-shard systems (global chat, DMs, registry) are already server-independent and can fan out via a tiny pub/sub (DynamoDB streams or a $0-idle Momento/API-GW hop — decided when needed).
3. **Only at real scale:** broker-launched Fargate tasks per shard pool, warm pool for cold-start hiding. Not designed further until the problem exists.

## Terraform layout

Introduced in **Epic 2 (v0.1)** — multiplayer playtesting with remote friends wants a deployed server from the first release.

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
    ├── game-server/        # EC2 instance, security group, Elastic IP + play.* record,
    │                       #   IAM role (SSM + DynamoDB), user-data (installs Caddy + node service)
    ├── services/           # (v0.5+) HTTP API, Lambdas, DynamoDB tables, SSM params, IAM
    └── guardrails/         # AWS Budgets alert, CloudWatch alarms, log retention
```

Principles:

1. **One environment until pain demands two.** Local dev runs the game server on localhost — a deployed dev copy adds nothing early.
2. **State in S3 with native locking** (`use_lockfile = true`) — no DynamoDB lock-table ceremony.
3. **Artifacts built outside Terraform** (esbuild → zip for Lambdas; the game server ships as a bundle the instance pulls). Terraform defines infrastructure, not build steps.
4. **The AI API key never touches Terraform state or the repo.** Written to SSM Parameter Store once, manually (`aws ssm put-parameter --type SecureString`); referenced by name.
5. **No SSH.** The game server is managed via SSM Session Manager (free, auditable, no open port 22).
6. **Everything tagged** (`project = dungeoncrawler2d`) so Cost Explorer can attribute every cent.

## Deployment flow

- **Frontend:** `npm run build` → sync `dist/` to S3 → CloudFront invalidation (`/index.html` only; hashed assets are immutable). GitHub Actions on push to `main`.
- **Game server:** CI builds the server bundle → uploads to S3 → SSM Run Command tells the instance to pull + restart the systemd service. Sessions end on deploy (fine pre-launch; v0.8 adds drain-then-restart: stop accepting new sessions, restart when empty).
- **Services:** esbuild bundle → zip → `terraform apply` (or `aws lambda update-function-code` for code-only changes in CI).
- **Infra changes:** PR with `terraform plan` output, apply on merge.
