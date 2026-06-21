# Test Coverage: Manifold Markets API Plugin

**Last updated**: 2026-06-21 (test quality fixes: shape assertions, ctx.skip, 401 toMatchObject, runAuthedTest shapes)
**Total tools**: 40 (25 read + 15 write; 1 of the 25 read tools, `search_users`, is intentionally excluded)
**Total tests**: 57 (48 base when `MANIFOLD_API_KEY` is set + 9 opt-in write tests)

## Live API Tests (32 of 40 tools)

### Public Read Tools (19 tools) — always run
- manifold_search_markets
- manifold_get_market
- manifold_get_market_by_slug
- manifold_list_markets
- manifold_get_market_prob
- manifold_get_market_probs
- manifold_get_market_positions
- manifold_get_user
- manifold_get_user_lite
- manifold_get_user_by_id
- manifold_get_user_by_id_lite
- manifold_list_users
- manifold_get_bets
- manifold_get_comments
- manifold_get_groups
- manifold_get_group
- manifold_get_group_by_id
- manifold_get_leagues
- manifold_get_boost_history

### Authenticated Read Tools (5 tools) — require MANIFOLD_API_KEY
- manifold_get_me
- manifold_get_portfolio
- manifold_get_portfolio_history
- manifold_get_contract_metrics
- manifold_get_transactions

### Write Tools (9 tools) — opt-in via MANIFOLD_RUN_WRITE_TESTS=1
Default cost ~M$3. With MANIFOLD_API_KEY2 set, add M$10 for send_mana.
cancel_bet, market_group, and close_market are net-zero.

| Tool | Cost per run | Notes |
|---|---|---|
| manifold_place_bet (real) | M$1 | Gives YES shares for sell_shares test |
| manifold_place_bet (dryRun) | M$0 | Simulated bet, no state change |
| manifold_create_comment | M$1 | Flat fee per comment |
| manifold_add_liquidity | M$1 | Recoverable via sell_shares |
| manifold_sell_shares | recovers ~M$1 | Sells YES shares from place_bet |
| manifold_cancel_bet | M$0 (net) | Limit order placed then cancelled, mana refunded |
| manifold_market_group | M$0 | Tag then untag, fully reversible. Skips (not passes) if no group discovered. |
| manifold_close_market | M$0 | Updates closeTime to future, doesn't close |
| manifold_send_mana | M$10 | Requires MANIFOLD_API_KEY2. Skips (not passes) if absent. Recoverable — both accounts owned by same user. |

### Error Shape Tests (2 tests)
- 404 on unknown market throws ManifoldError (rejects.toThrow)
- 401 on authed tool without API key surfaces auth-category error (rejects.toMatchObject { category: "auth", status: 401 })

## Assertion Strategy

### Public read tools — shape-classified assertions (`runLiveTest`)
Each `runLiveTest` call passes a `shape` parameter (`"array" | "object" | "prob"`)
that asserts the response is a non-null value of the expected top-level type:
- `"array"`: `Array.isArray(result) === true` — `search_markets`, `list_markets`,
  `get_bets`, `get_comments`, `get_groups`, `get_market_positions`, `get_leagues`
- `"object"`: `typeof result === "object" && !Array.isArray(result)` — `get_market`,
  `get_market_by_slug`, `get_user` / `get_user_lite`, `get_user_by_id` /
  `get_user_by_id_lite`, `get_group`, `get_group_by_id`, `get_market_probs`,
  `get_boost_history`
- `"prob"`: probability response — `get_market_prob`; handles both binary markets
  (`{ prob: number }`) and multi-choice markets
  (`{ answerProbs: Record<string, number> }`), with all values bounded [0, 1]

### Authenticated read tools — shape-classified assertions (`runAuthedTest`)
Same `shape` parameter and null/array/typeof guards as `runLiveTest`:
- `"object"` (default): `get_me`, `get_portfolio`, `get_contract_metrics`
- `"array"`: `get_portfolio_history`

### Skip visibility — `ctx.skip()` not silent `return`
Tests that can't run due to missing prerequisites (discovery failure, missing env
var) use vitest's `ctx.skip(true, "reason")` so they appear as "skipped" in output,
not "passed" with zero assertions. Discovery failures also emit `console.warn` with
the error message so the cause is visible in test output.

Applied to: all 10 discovery-dependent public read tests, `send_mana` (`MANIFOLD_API_KEY2`),
`market_group` (no group discovered).

## Existence-Only (7 tools) — registered but never executed live

### Blocked by market type (4 tools)
| Tool | Blocker |
|---|---|
| manifold_place_multi_bet | Needs a sums-to-one MULTI_CHOICE market |
| manifold_add_answer | Needs a MULTI_CHOICE market |
| manifold_rebalance | Needs a sums-to-one multi-choice market with mixed positions |
| manifold_add_bounty | Needs a BOUNTIED_QUESTION market |

### Blocked by irreversibility (1 tool)
| Tool | Blocker |
|---|---|
| manifold_resolve_market | Irreversible — would settle the test market |

### Blocked by prerequisite state (1 tool)
| Tool | Blocker |
|---|---|
| manifold_award_bounty | Needs a bountied-question market + a comment to award |

### Blocked by cost (1 tool)
| Tool | Blocker |
|---|---|
| manifold_create_market | M$100 per call (liquidityTier floor). Has `scripts/create-test-market.ts`. Proven manually once. |

## Intentionally Excluded (1 tool)
| Tool | Reason |
|---|---|
| manifold_search_users | Redundant with `list_users` for test purposes; upstream endpoint is a thin wrapper. |

## Inventory Parity Tests (7 tests)
- Plugin declares tool metadata
- Plugin and MCP server expose the same tool names
- Total tool count is 40
- All tool names are manifold_-prefixed
- No tool name is duplicated
- MCP server tool inventory has the same count as the plugin
- Each MCP tool has a non-empty description

## Schema Audits

### Write Tools (15 tools) — audited 2026-06-20
All 15 write tools audited against upstream Zod schemas in
`common/src/api/schema.ts` and `common/src/api/market-types.ts`.
Parameter names, types, required/optional status, and enum values
verified. The audit caught the `marketId` → `contractId` bug that
existence checks missed.

### Read Tools (25 tools) — audited 2026-06-21
All 25 read tools audited against upstream Zod schemas. 14 of 25 had
mismatches — invented params, wrong types, wrong enum values, wrong
constraints, and missing params. All 14 fixed across 6 files:
`markets.ts`, `users.ts`, `activity.ts`, `groups.ts`, `misc-read.ts`,
`authed-read.ts`. Key fixes: `get_transactions` had invented `txntype`
param and wrong `limit` max (1000 → 100); `search_markets` had wrong
`sort` enum (4 of 16 values) and invented `filterClosed`/`filterResolved`
replaced with upstream `filter` enum; `get_contract_metrics` had invented
`slugs`/`fresh` params; `get_comments` and `get_boost_history` had
invented `before` params. The audit also fixed a flaky test:
`get_transactions` was querying the global txns table without a `fromId`
filter, causing intermittent 25s timeouts.

## Test Market
- **ID**: qPIlzUsCnP (default, overridable via MANIFOLD_TEST_MARKET_ID)
- **Type**: BINARY, public, closeTime ~2 years out
- **Created via**: `scripts/create-test-market.ts`
- **Stays up indefinitely** — no afterAll cleanup

## Environment Variables
| Variable | Required | Purpose |
|---|---|---|
| `MANIFOLD_API_KEY` | Yes (write tests) | Primary account API key — owns the test market |
| `MANIFOLD_API_KEY2` | Yes (send_mana only) | Second account API key — receives M$10 transfer |
| `MANIFOLD_TEST_MARKET_ID` | No | Override test market ID (default: `qPIlzUsCnP`) |
| `MANIFOLD_RUN_WRITE_TESTS` | No | Set to `1` to enable live write tests |
