# AI Crafting Design

The signature feature (Epic 8–9). At the crafting table, the player types what they want to make and selects ingredients. An AI composes a brand-new `ItemDefinition` from the engine's existing effect vocabulary; the engine validates it and accepts or denies. Accepted items are real: craftable again by anyone with the ingredients.

**The molotov test:** the game ships with no molotov cocktail. Player selects `rag` + `vodka-bottle`, types "make a molotov cocktail." The AI returns a throwable item tagged `flammable`+`explosive-ish`, whose impact spawns `area-fire`. Validation passes (all known primitives/tags, damage within budget for those ingredients). The item now exists, with the player credited as inventor.

## Pipeline

```
1. Player: prompt + ingredient selection (crafting table UI)
2. Client → crafting Lambda (POST /craft) — API keys live server-side only.
   Crafting is request/response and not latency-sensitive, so it stays
   serverless even though gameplay runs on the stateful game server
3. Registry check: has this (ingredients + intent) been crafted before?
   ├─ yes → return existing item, no AI call (cost control + consistency)
   └─ no  → continue
4. AI call: system prompt = primitive catalog + tag vocabulary + balance rules
            + ingredient definitions; structured output = ItemProposal JSON
5. Engine validation (same zod schemas as hand-authored content):
   a. Schema validity, known primitives/statuses/tags only
   b. Balance budget: item power ≤ f(ingredient tier); numeric caps
   c. Plausibility: proposal must cite which ingredient contributes each behavior
   d. Content moderation on name/description
6. Accept → consume ingredients, persist definition, push to the player's live
   game session — the game server loads it like any content file and broadcasts
   it, so party members immediately see (and can be hit by) the new invention
   Deny  → player-facing flavor message with reason category; ingredients kept
7. (v0.6) Other players discover the item as a craftable recipe via the registry
```

## ItemProposal contract (sketch)

The AI must return exactly this shape (structured output / tool-call schema):

```jsonc
{
  "name": "Molotov Cocktail",
  "description": "A rag-stuffed bottle of cheap vodka. Light, throw, regret nothing.",
  "tags": ["throwable", "flammable", "liquid", "glass"],
  "behaviors": {
    "throwable": {
      "onImpact": [
        { "primitive": "spawn_area", "area": "area-fire", "radius": 2 },
        { "primitive": "destroy_entity" }
      ]
    }
  },
  "derivation": [   // required: every behavior must trace to an ingredient
    { "from": "vodka-bottle", "justifies": ["flammable", "liquid", "spawn_area:area-fire"] },
    { "from": "rag",          "justifies": ["throwable ignition"] }
  ],
  "sprite": { "base": "bottle", "palette": "amber", "overlay": "rag" }
}
```

Sprites are procedural: composed from a base-shape library + palette + overlay, so new items don't need new art.

## Why the engine can trust this

The AI is a **composer, not a programmer**. It cannot emit code, new primitives, or new tags — only arrangements of vocabulary the engine already implements and tests. The validator is deterministic and runs the same schema used for hand-authored content. Worst case for a malicious/nonsense prompt is a denial. Layered guards:

| Risk | Guard |
| --- | --- |
| Overpowered items ("nuke") | Balance budget from ingredient tiers; hard numeric caps per primitive |
| Nonsense combos | Derivation requirement — behaviors must trace to ingredient tags |
| Offensive names/descriptions | Moderation pass (server-side) before acceptance |
| API cost blowup | Registry-first lookup, per-player rate limits, response caching, small model for intent + cheap retry policy |
| Prompt injection via item names | Item text is data, never re-fed into prompts unescaped; description length caps |
| Duplicate spam | Canonicalization: embedding/similarity match against registry before creating |

## Dedupe & canonicalization

Same ingredients + semantically similar intent should converge on one canonical item ("molotov", "fire bomb", "flaming bottle" ⇒ the first-accepted version). Registry lookup happens *before* the AI call (exact ingredient match + intent similarity) and *after* (proposal similarity), so the world builds a shared, finite item space rather than infinite near-duplicates.

## Server evolution

Serverless on AWS, defined in Terraform — full architecture and cost model in [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

- **v0.5:** One Lambda behind API Gateway (`POST /craft`), AI API key in SSM Parameter Store, API Gateway throttling for rate limits, local (per-player) persistence of accepted items
- **v0.6:** Item registry in DynamoDB, accounts/anonymous ids, publish/discover, moderation & reporting, admin kill-switch (a DynamoDB flag checked at read time; a pulled item degrades gracefully into its ingredients for owners)
- **v1.0:** Caching/cost telemetry, model-tier routing (cheap model first, escalate on low confidence)

## Player experience details

- Crafting is diegetic: results in-fiction ("The tinkerer studies your rag and bottle…"), denials get reason-flavored messages (too powerful / doesn't make sense / try different ingredients)
- Accepted items show inventor credit and enter the discoverable codex
- First-craft moments are celebrated (unique sound/flash + "New invention!") — this is the game's sharable moment

## Open questions (to resolve before Epic 8)

1. Which AI model tier — per the cost table in [INFRASTRUCTURE.md](INFRASTRUCTURE.md), even a top-tier model costs ~$0.02–0.03 per new craft (~$36/mo at a pessimistic ceiling), so this is a quality decision, not a cost one. Also: do we allow a local fallback list of pre-authored "AI-style" recipes when the API is unreachable?
2. Should denied prompts consume a resource (to discourage spam) or stay free (to encourage experimentation)? Leaning: free but rate-limited.
3. Item ownership semantics in v0.6 — global namespace vs. per-world/per-season registries.
4. Can AI items be used as *ingredients* for further AI items (recursive crafting)? Powerful but compounds balance risk; propose capping composition depth at 2 initially.
