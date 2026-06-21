# Tool Interface Contract: Manifold Markets API Plugin

**Purpose**: Public interface contract for the ~40 `manifold_`-prefixed tools exposed by the OpenClaw plugin and standalone MCP server. This is the surface consumed by OpenClaw, MCP clients, and their downstream LLMs.

**Spec**: [spec.md](../spec.md) · **Plan**: [plan.md](../plan.md) · **Research**: [research.md](../research.md)

---

## Design Constraints

| Constraint | Ref | Summary |
|---|---|---|
| **TypeBox-only schemas** | Principle II, D5, FR-008 | Every parameter schema uses TypeBox constructors. No Zod, no raw JSON Schema. |
| **Verbatim passthrough** | FR-003, D4 | Response bodies pass through to the caller with zero transformation. No probability-to-percentage formatting. |
| **Uniform error shape** | FR-021, D2 | All errors use `{ category: "upstream"\|"auth"\|"network"\|"timeout"\|"validation", message: string, status?: number, body?: string }`. |
| **Rely-on-upstream auth** | FR-006, D3, Q3 | Auth-requiring tools send the request with whatever key is configured (none if absent). The upstream 401 surfaces as an `auth`-category error. The plugin does **not** pre-check for a key or maintain per-tool auth-required metadata. |
| **`manifold_` prefix** | FR-005 | Every tool name is prefixed with `manifold_` to prevent collisions. |
| **Public-only endpoints** | FR-004 | Only `visibility: 'public'` upstream endpoints are exposed. |
| **One endpoint per tool** | FR-003 | Each tool wraps exactly one Manifold REST endpoint. No aggregation or multi-endpoint calls. |

### Error shape (all tools)

```typescript
interface ManifoldToolError {
  category: "upstream" | "auth" | "network" | "timeout" | "validation";
  message: string;        // human-readable description
  status?: number;        // upstream HTTP status (when applicable)
  body?: string;          // upstream response body (when applicable)
}
```

### Response convention

Every tool returns the **raw upstream JSON response** verbatim. The `Returns` column below documents the upstream response shape name (e.g., `LiteMarket[]`, `User`). Callers should consult the [Manifold schema source](https://github.com/manifoldmarkets/manifold/blob/main/common/src/api/schema.ts) for field-level type definitions.

---

## Read-Only — Markets

No authentication required for any tool in this category.

### `manifold_search_markets`

| | |
|---|---|
| **HTTP** | `GET /v0/search-markets` |
| **Auth required** | No |
| **Description** | Search and filter prediction markets by free-text term, market type, creator, and sort order. Returns a ranked list of matching markets. |
| **Returns** | `LiteMarket[]` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `term` | `Type.String()` | Yes | Free-text search query |
| `contractType` | `Type.Optional(Type.Union([Type.Literal("BINARY"), Type.Literal("MULTIPLE_CHOICE"), Type.Literal("FREE_RESPONSE"), Type.Literal("POLL"), Type.Literal("NUMERIC"), Type.Literal("PSEUDO_NUMERIC"), Type.Literal("BOUNTIED_QUESTION")]))` | No | Filter by market outcome type |
| `limit` | `Type.Optional(Type.Number({ minimum: 1, maximum: 1000 }))` | No | Max results to return |
| `offset` | `Type.Optional(Type.Number({ minimum: 0 }))` | No | Skip first N results |
| `creatorId` | `Type.Optional(Type.String())` | No | Filter by market creator user ID |
| `sort` | `Type.Optional(Type.Union([Type.Literal("liquidity"), Type.Literal("volume"), Type.Literal("newest"), Type.Literal("oldest")]))` | No | Sort order for results |
| `filterClosed` | `Type.Optional(Type.Boolean())` | No | Exclude closed markets |
| `filterResolved` | `Type.Optional(Type.Boolean())` | No | Exclude resolved markets |

---

### `manifold_get_market`

| | |
|---|---|
| **HTTP** | `GET /v0/market/{marketId}` |
| **Auth required** | No |
| **Description** | Get full market details including answers, description, resolution info, and all metadata. Returns the full market object (not the lite form). |
| **Returns** | `FullMarket` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market's unique ID |

---

### `manifold_get_market_by_slug`

| | |
|---|---|
| **HTTP** | `GET /v0/slug/{marketSlug}` |
| **Auth required** | No |
| **Description** | Get full market details by URL slug. Returns the full market object. |
| **Returns** | `FullMarket` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketSlug` | `Type.String()` | Yes | The market's URL slug (e.g., "will-ai-pass-turing-test") |

---

### `manifold_list_markets`

| | |
|---|---|
| **HTTP** | `GET /v0/markets` |
| **Auth required** | No |
| **Description** | List markets with cursor-based pagination. Maximum 1000 results per page. Pass the `before` cursor from a previous response to get the next page. |
| **Returns** | `LiteMarket[]` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `before` | `Type.Optional(Type.String())` | No | Cursor for pagination — pass the ID of the last market from the previous page |

---

### `manifold_get_market_prob`

| | |
|---|---|
| **HTTP** | `GET /v0/market/{marketId}/prob` |
| **Auth required** | No |
| **Description** | Get the current probability for a market. Returns a lightweight response (1-second cache on the upstream). |
| **Returns** | `{ probability: number, ... }` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market's unique ID |

---

### `manifold_get_market_probs`

| | |
|---|---|
| **HTTP** | `GET /v0/market-probs` |
| **Auth required** | No |
| **Description** | Batch-fetch current probabilities for multiple markets in a single request. Accepts up to **100** market IDs — requests exceeding this limit will be rejected by the upstream API. |
| **Returns** | Array of `{ id: string, probability: number, ... }` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `ids` | `Type.Array(Type.String(), { minItems: 1, maxItems: 100 })` | Yes | Array of market IDs to query (max 100) |

---

### `manifold_get_market_positions`

| | |
|---|---|
| **HTTP** | `GET /v0/market/{marketId}/positions` |
| **Auth required** | No |
| **Description** | Get the positions/leaderboard for a market — shows which users hold shares and their P&L. |
| **Returns** | Array of position objects |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market's unique ID |
| `top` | `Type.Optional(Type.Number({ minimum: 1 }))` | No | Return only the top N positions |
| `bottom` | `Type.Optional(Type.Number({ minimum: 1 }))` | No | Return only the bottom N positions |

---

## Read-Only — Users

No authentication required for any tool in this category.

### `manifold_get_user`

| | |
|---|---|
| **HTTP** | `GET /v0/user/{username}` |
| **Auth required** | No |
| **Description** | Get full user profile by username — display name, bio, creation date, follower/following counts, portfolio summary. |
| **Returns** | `User` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `username` | `Type.String()` | Yes | The user's Manifold username |

---

### `manifold_get_user_lite`

| | |
|---|---|
| **HTTP** | `GET /v0/user/{username}/lite` |
| **Auth required** | No |
| **Description** | Get display-only user info by username — name, avatar, basic profile without full portfolio data. |
| **Returns** | `DisplayUser` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `username` | `Type.String()` | Yes | The user's Manifold username |

---

### `manifold_get_user_by_id`

| | |
|---|---|
| **HTTP** | `GET /v0/user/by-id/{id}` |
| **Auth required** | No |
| **Description** | Get full user profile by unique ID. |
| **Returns** | `User` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `id` | `Type.String()` | Yes | The user's unique ID |

---

### `manifold_get_user_by_id_lite`

| | |
|---|---|
| **HTTP** | `GET /v0/user/by-id/{id}/lite` |
| **Auth required** | No |
| **Description** | Get display-only user info by unique ID. |
| **Returns** | `DisplayUser` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `id` | `Type.String()` | Yes | The user's unique ID |

---

### `manifold_list_users`

| | |
|---|---|
| **HTTP** | `GET /v0/users` |
| **Auth required** | No |
| **Description** | List users with cursor-based pagination. Maximum 1000 results per page. |
| **Returns** | `User[]` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `before` | `Type.Optional(Type.String())` | No | Cursor for pagination — pass the ID of the last user from the previous page |

---

### `manifold_search_users`

| | |
|---|---|
| **HTTP** | `GET /v0/search-users` |
| **Auth required** | No |
| **Description** | Search users by username or display name. |
| **Returns** | `DisplayUser[]` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `term` | `Type.String()` | Yes | Search query (username or display name substring) |
| `limit` | `Type.Optional(Type.Number({ minimum: 1, maximum: 1000 }))` | No | Max results per page |
| `page` | `Type.Optional(Type.Number({ minimum: 1 }))` | No | Page number (1-indexed) |

---

## Read-Only — Activity

No authentication required for any tool in this category.

### `manifold_get_bets`

| | |
|---|---|
| **HTTP** | `GET /v0/bets` |
| **Auth required** | No |
| **Description** | List bets with rich filtering. Supports filtering by user, market, answer, time range, bet kind, minimum amount, and redemption filtering. Use `before`/`after` cursors for pagination. |
| **Returns** | `Bet[]` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `userId` | `Type.Optional(Type.String())` | No | Filter by user ID |
| `username` | `Type.Optional(Type.String())` | No | Filter by username |
| `contractId` | `Type.Optional(Type.String())` | No | Filter by market/contract ID |
| `contractSlug` | `Type.Optional(Type.String())` | No | Filter by market slug |
| `answerId` | `Type.Optional(Type.String())` | No | Filter by specific answer ID |
| `limit` | `Type.Optional(Type.Number({ minimum: 1, maximum: 1000 }))` | No | Max results to return |
| `before` | `Type.Optional(Type.String())` | No | Cursor — bets before this bet ID |
| `after` | `Type.Optional(Type.String())` | No | Cursor — bets after this bet ID |
| `beforeTime` | `Type.Optional(Type.Number())` | No | Filter bets placed before this Unix timestamp (ms) |
| `afterTime` | `Type.Optional(Type.Number())` | No | Filter bets placed after this Unix timestamp (ms) |
| `order` | `Type.Optional(Type.Union([Type.Literal("asc"), Type.Literal("desc")]))` | No | Sort order by time |
| `kinds` | `Type.Optional(Type.Array(Type.String()))` | No | Filter by bet kinds (e.g., `["Bet", "Tip"]`) |
| `minAmount` | `Type.Optional(Type.Number({ minimum: 0 }))` | No | Minimum bet amount in M$ |
| `filterRedemptions` | `Type.Optional(Type.Boolean())` | No | Exclude redemption bets if `true` |

---

### `manifold_get_comments`

| | |
|---|---|
| **HTTP** | `GET /v0/comments` |
| **Auth required** | No |
| **Description** | List comments on a market or by a user. Provide `contractId` to get comments on a specific market, or `userId` to get all comments by a user. |
| **Returns** | Comment[] |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `contractId` | `Type.Optional(Type.String())` | No | Filter comments by market/contract ID |
| `userId` | `Type.Optional(Type.String())` | No | Filter comments by author user ID |
| `limit` | `Type.Optional(Type.Number({ minimum: 1, maximum: 1000 }))` | No | Max results to return |
| `before` | `Type.Optional(Type.String())` | No | Cursor — comments before this comment ID |

---

## Read-Only — Groups, Leagues & Boosts

No authentication required for any tool in this category.

### `manifold_get_groups`

| | |
|---|---|
| **HTTP** | `GET /v0/groups` |
| **Auth required** | No |
| **Description** | List topic groups (called "topics" on the Manifold website). Groups are collections of related markets. |
| **Returns** | Group[] |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `limit` | `Type.Optional(Type.Number({ minimum: 1, maximum: 1000 }))` | No | Max results to return |
| `before` | `Type.Optional(Type.String())` | No | Cursor for pagination |

---

### `manifold_get_group`

| | |
|---|---|
| **HTTP** | `GET /v0/group/{slug}` |
| **Auth required** | No |
| **Description** | Get full group/topic details by URL slug — name, description, member counts, and associated markets. |
| **Returns** | Group (full) |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `slug` | `Type.String()` | Yes | The group's URL slug |

---

### `manifold_get_group_by_id`

| | |
|---|---|
| **HTTP** | `GET /v0/group/by-id/{id}` |
| **Auth required** | No |
| **Description** | Get full group/topic details by unique ID. |
| **Returns** | Group (full) |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `id` | `Type.String()` | Yes | The group's unique ID |

---

### `manifold_get_leagues`

| | |
|---|---|
| **HTTP** | `GET /v0/leagues` |
| **Auth required** | No |
| **Description** | Get league standings — competitive leaderboards grouping users by trading performance over a period. |
| **Returns** | League standings data |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `cohort` | `Type.Optional(Type.String())` | No | Filter by cohort (e.g., "personal", "group") |
| `season` | `Type.Optional(Type.Number())` | No | Filter by season number |

---

### `manifold_get_boost_history`

| | |
|---|---|
| **HTTP** | `GET /v0/get-boost-history` |
| **Auth required** | No |
| **Description** | Get the public log of market boosts — promotions applied to markets on the platform. |
| **Returns** | Boost history data |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `limit` | `Type.Optional(Type.Number({ minimum: 1 }))` | No | Max results to return |
| `before` | `Type.Optional(Type.String())` | No | Cursor for pagination |

---

## Authenticated — Personal Data

These endpoints require a valid Manifold API key. Per **FR-006/Q3**, the plugin does **not** pre-check for a key — it sends the request with whatever key is configured (none if absent). The upstream API returns a `401 Unauthorized` which surfaces as an `auth`-category error (FR-021).

### `manifold_get_me`

| | |
|---|---|
| **HTTP** | `GET /v0/me` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Get the authenticated user's own profile — identity confirmation, account details, and balance. |
| **Returns** | `User` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| *(none)* | — | — | No parameters required |

---

### `manifold_get_portfolio`

| | |
|---|---|
| **HTTP** | `GET /v0/get-user-portfolio` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Get live portfolio metrics for the authenticated user — current account value, profit/loss, and per-market position summary. |
| **Returns** | `LivePortfolioMetrics` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `userId` | `Type.Optional(Type.String())` | No | User ID to query (defaults to authenticated user if omitted) |

---

### `manifold_get_portfolio_history`

| | |
|---|---|
| **HTTP** | `GET /v0/get-user-portfolio-history` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Get historical portfolio value over time for the authenticated user — account value series for charting/analysis. |
| **Returns** | `PortfolioMetrics` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `userId` | `Type.Optional(Type.String())` | No | User ID to query (defaults to authenticated user if omitted) |
| `period` | `Type.Optional(Type.Union([Type.Literal("daily"), Type.Literal("weekly"), Type.Literal("monthly"), Type.Literal("allTime")]))` | No | Time period for history |

---

### `manifold_get_contract_metrics`

| | |
|---|---|
| **HTTP** | `GET /v0/get-user-contract-metrics-with-contracts` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Get the authenticated user's per-market contract metrics with full contract details — positions, profit/loss, and the associated market objects for each position. |
| **Returns** | `ContractMetric[]` (with embedded contract data) |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `userId` | `Type.Optional(Type.String())` | No | User ID to query (defaults to authenticated user if omitted) |
| `slugs` | `Type.Optional(Type.Array(Type.String()))` | No | Filter to specific market slugs |
| `limit` | `Type.Optional(Type.Number({ minimum: 1 }))` | No | Max results to return |
| `fresh` | `Type.Optional(Type.Boolean())` | No | Force fresh data (bypass cache) |

---

### `manifold_get_transactions`

| | |
|---|---|
| **HTTP** | `GET /v0/txns` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | List transaction history for the authenticated user — bets, payouts, transfers, fees, and other mana movements. |
| **Returns** | Transaction data (txn objects) |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `userId` | `Type.Optional(Type.String())` | No | User ID to query (defaults to authenticated user if omitted) |
| `txntype` | `Type.Optional(Type.String())` | No | Filter by transaction type |
| `before` | `Type.Optional(Type.String())` | No | Cursor for pagination |
| `limit` | `Type.Optional(Type.Number({ minimum: 1, maximum: 1000 }))` | No | Max results to return |

---

## Authenticated — Write Actions

These endpoints **require a valid Manifold API key** and **involve real Manifold currency (M$)**. Per **FR-013**, each tool description includes the cost or fee incurred by the action. Per **FR-006/Q3**, the plugin does not pre-check for a key — the upstream 401 surfaces as an `auth`-category error.

### `manifold_place_bet`

| | |
|---|---|
| **HTTP** | `POST /v0/bet` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Place a bet on a market. **Costs real M$** — the `amount` parameter specifies the mana to wager. Supports market orders (buy at current price) and limit orders (via `limitProb`). |
| **Returns** | `Bet` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market ID to bet on |
| `outcome` | `Type.Union([Type.Literal("YES"), Type.Literal("NO")])` | Yes | Which side to bet on |
| `amount` | `Type.Number({ minimum: 1 })` | Yes | Amount of M$ to wager |
| `limitProb` | `Type.Optional(Type.Number({ minimum: 0.01, maximum: 0.99 }))` | No | Limit price for a limit order (omit for market order) |

---

### `manifold_place_multi_bet`

| | |
|---|---|
| **HTTP** | `POST /v0/multi-bet` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Place bets across multiple answers in a multi-choice or free-response market in a single request. **Costs real M$** — each bet in the array incurs its own wager amount. |
| **Returns** | Array of `Bet` objects |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market ID |
| `bets` | `Type.Array(Type.Object({ answerId: Type.String(), amount: Type.Number({ minimum: 1 }) }))` | Yes | Array of `{ answerId, amount }` — one per answer to bet on |

---

### `manifold_cancel_bet`

| | |
|---|---|
| **HTTP** | `POST /v0/bet/cancel/{betId}` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Cancel an unfilled limit order bet. Only pending limit orders can be cancelled — filled or settled bets cannot. |
| **Returns** | Cancelled `Bet` object |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `betId` | `Type.String()` | Yes | The bet ID to cancel |

---

### `manifold_create_market`

| | |
|---|---|
| **HTTP** | `POST /v0/market` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Create a new prediction market. **Costs M$50–250** depending on market type and liquidity settings. The creator is charged immediately upon creation. |
| **Returns** | `FullMarket` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `question` | `Type.String()` | Yes | The market question text |
| `outcomeType` | `Type.Union([Type.Literal("BINARY"), Type.Literal("MULTIPLE_CHOICE"), Type.Literal("FREE_RESPONSE"), Type.Literal("POLL"), Type.Literal("NUMERIC"), Type.Literal("PSEUDO_NUMERIC"), Type.Literal("BOUNTIED_QUESTION")])` | Yes | Market outcome type |
| `description` | `Type.Optional(Type.String())` | No | Market description / body text (supports Markdown) |
| `closeTime` | `Type.Optional(Type.Number())` | No | When to close the market (Unix timestamp ms) |
| `groupIds` | `Type.Optional(Type.Array(Type.String()))` | No | Topic group IDs to add the market to |
| `initialProb` | `Type.Optional(Type.Number({ minimum: 0.01, maximum: 0.99 }))` | No | Initial probability for binary markets (default 0.5) |
| `expectLabResolve` | `Type.Optional(Type.Boolean())` | No | Whether the market uses LAB resolve |
| `resolution` | `Type.Optional(Type.String())` | No | Pre-resolve value (for creating already-resolved markets) |

---

### `manifold_resolve_market`

| | |
|---|---|
| **HTTP** | `POST /v0/market/{marketId}/resolve` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Resolve a market — declare the outcome and pay out bettors. Only the market creator or an admin can resolve. **This is irreversible.** |
| **Returns** | `FullMarket` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market ID to resolve |
| `resolution` | `Type.Union([Type.Literal("YES"), Type.Literal("NO"), Type.Literal("MKT"), Type.Literal("CANCEL"), Type.Literal("N/A")])` | Yes | Resolution value: YES, NO, MKT (proportional), CANCEL (refund), N/A (bountied questions) |
| `payout` | `Type.Optional(Type.Number({ minimum: 0 }))` | No | Custom payout amount (for N/A resolution on bountied questions) |
| `answerId` | `Type.Optional(Type.String())` | No | For multi-choice: the winning answer ID (required when resolution is YES or NO on multi-choice) |

---

### `manifold_sell_shares`

| | |
|---|---|
| **HTTP** | `POST /v0/market/{marketId}/sell` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Sell shares in a market. Converts shares back to M$ at the current price. Only the authenticated user's own shares can be sold. |
| **Returns** | `Bet` (the sell transaction) |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market ID |
| `shares` | `Type.Number({ minimum: 0.01 })` | Yes | Number of shares to sell |
| `outcome` | `Type.Union([Type.Literal("YES"), Type.Literal("NO")])` | Yes | Which outcome's shares to sell |

---

### `manifold_close_market`

| | |
|---|---|
| **HTTP** | `POST /v0/market/{marketId}/close` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Set or update the close time of a market. After the close time, no new bets can be placed but the market is not yet resolved. Only the market creator can close. |
| **Returns** | `FullMarket` |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market ID to close |
| `closeTime` | `Type.Number()` | Yes | New close time (Unix timestamp ms) |

---

### `manifold_add_liquidity`

| | |
|---|---|
| **HTTP** | `POST /v0/market/{marketId}/add-liquidity` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Add liquidity to a market — subsidizes the market's liquidity pool, which reduces the spread and encourages trading. **Costs real M$.** |
| **Returns** | Updated market data |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market ID |
| `amount` | `Type.Number({ minimum: 1 })` | Yes | Amount of M$ to add as liquidity |

---

### `manifold_add_answer`

| | |
|---|---|
| **HTTP** | `POST /v0/market/{marketId}/answer` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Add a new answer to a multi-choice or free-response market. Only the market creator or admin can add answers to a multi-choice market after creation. |
| **Returns** | Updated market data with new answer |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market ID |
| `text` | `Type.String()` | Yes | The answer text |

---

### `manifold_market_group`

| | |
|---|---|
| **HTTP** | `POST /v0/market/{marketId}/group` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Tag or untag a market with a topic group. Use action `add` to tag, `remove` to untag. |
| **Returns** | Updated market-group association |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market ID |
| `groupId` | `Type.String()` | Yes | The group/topic ID |
| `action` | `Type.Union([Type.Literal("add"), Type.Literal("remove")])` | Yes | Whether to add or remove the group tag |

---

### `manifold_rebalance`

| | |
|---|---|
| **HTTP** | `POST /v0/market/{marketId}/rebalance` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Rebalance the authenticated user's position in a multi-choice market — redistribute shares across answers without withdrawing mana. |
| **Returns** | Updated position data |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market ID |
| `targetAnswerWeights` | `Type.Record(Type.String(), Type.Number({ minimum: 0 }))` | Yes | Map of answer ID to target weight (proportion) |

---

### `manifold_add_bounty`

| | |
|---|---|
| **HTTP** | `POST /v0/market/{marketId}/add-bounty` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Add a bounty to a bountied-question market — post a reward that other users can earn by providing a good answer. **Costs real M$.** |
| **Returns** | Updated bounty data |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market ID |
| `amount` | `Type.Number({ minimum: 1 })` | Yes | Bounty amount in M$ |
| `description` | `Type.Optional(Type.String())` | No | Description of what the bounty is for |

---

### `manifold_award_bounty`

| | |
|---|---|
| **HTTP** | `POST /v0/market/{marketId}/award-bounty` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Award a bounty to a comment author — transfer the bounty reward to the user who posted the winning comment. **Costs real M$.** |
| **Returns** | Award confirmation |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `marketId` | `Type.String()` | Yes | The market ID |
| `commentId` | `Type.String()` | Yes | The comment ID to award |
| `amount` | `Type.Number({ minimum: 1 })` | Yes | Amount of the bounty to award in M$ |

---

### `manifold_send_mana`

| | |
|---|---|
| **HTTP** | `POST /v0/managram` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Send mana (M$) to another user — a direct transfer. **Sends real M$ from your balance to the recipient.** This action is irreversible. |
| **Returns** | Transaction confirmation |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `toId` | `Type.String()` | Yes | Recipient user ID |
| `amount` | `Type.Number({ minimum: 1 })` | Yes | Amount of M$ to send |
| `message` | `Type.Optional(Type.String())` | No | Optional message to include with the transfer |

---

### `manifold_create_comment`

| | |
|---|---|
| **HTTP** | `POST /v0/comment` |
| **Auth required** | Yes (upstream enforces) |
| **Description** | Create a comment on a market. **Costs a flat M$1 fee** per comment, deducted from the authenticated user's balance. |
| **Returns** | Comment object |

| Param | Type (TypeBox) | Required | Description |
|---|---|---|---|
| `contractId` | `Type.String()` | Yes | The market/contract ID to comment on |
| `content` | `Type.String()` | Yes | Comment text (supports Markdown) |
| `replyToCommentId` | `Type.Optional(Type.String())` | No | ID of the parent comment to reply to |

---

## Tool Summary

| # | Tool Name | Method | Endpoint | Auth | Category |
|---|---|---|---|---|---|
| 1 | `manifold_search_markets` | GET | `/v0/search-markets` | No | Read-only — Markets |
| 2 | `manifold_get_market` | GET | `/v0/market/{marketId}` | No | Read-only — Markets |
| 3 | `manifold_get_market_by_slug` | GET | `/v0/slug/{marketSlug}` | No | Read-only — Markets |
| 4 | `manifold_list_markets` | GET | `/v0/markets` | No | Read-only — Markets |
| 5 | `manifold_get_market_prob` | GET | `/v0/market/{marketId}/prob` | No | Read-only — Markets |
| 6 | `manifold_get_market_probs` | GET | `/v0/market-probs` | No | Read-only — Markets |
| 7 | `manifold_get_market_positions` | GET | `/v0/market/{marketId}/positions` | No | Read-only — Markets |
| 8 | `manifold_get_user` | GET | `/v0/user/{username}` | No | Read-only — Users |
| 9 | `manifold_get_user_lite` | GET | `/v0/user/{username}/lite` | No | Read-only — Users |
| 10 | `manifold_get_user_by_id` | GET | `/v0/user/by-id/{id}` | No | Read-only — Users |
| 11 | `manifold_get_user_by_id_lite` | GET | `/v0/user/by-id/{id}/lite` | No | Read-only — Users |
| 12 | `manifold_list_users` | GET | `/v0/users` | No | Read-only — Users |
| 13 | `manifold_search_users` | GET | `/v0/search-users` | No | Read-only — Users |
| 14 | `manifold_get_bets` | GET | `/v0/bets` | No | Read-only — Activity |
| 15 | `manifold_get_comments` | GET | `/v0/comments` | No | Read-only — Activity |
| 16 | `manifold_get_groups` | GET | `/v0/groups` | No | Read-only — Groups |
| 17 | `manifold_get_group` | GET | `/v0/group/{slug}` | No | Read-only — Groups |
| 18 | `manifold_get_group_by_id` | GET | `/v0/group/by-id/{id}` | No | Read-only — Groups |
| 19 | `manifold_get_leagues` | GET | `/v0/leagues` | No | Read-only — Groups |
| 20 | `manifold_get_boost_history` | GET | `/v0/get-boost-history` | No | Read-only — Groups |
| 21 | `manifold_get_me` | GET | `/v0/me` | Yes | Authenticated — Personal |
| 22 | `manifold_get_portfolio` | GET | `/v0/get-user-portfolio` | Yes | Authenticated — Personal |
| 23 | `manifold_get_portfolio_history` | GET | `/v0/get-user-portfolio-history` | Yes | Authenticated — Personal |
| 24 | `manifold_get_contract_metrics` | GET | `/v0/get-user-contract-metrics-with-contracts` | Yes | Authenticated — Personal |
| 25 | `manifold_get_transactions` | GET | `/v0/txns` | Yes | Authenticated — Personal |
| 26 | `manifold_place_bet` | POST | `/v0/bet` | Yes | Authenticated — Write |
| 27 | `manifold_place_multi_bet` | POST | `/v0/multi-bet` | Yes | Authenticated — Write |
| 28 | `manifold_cancel_bet` | POST | `/v0/bet/cancel/{betId}` | Yes | Authenticated — Write |
| 29 | `manifold_create_market` | POST | `/v0/market` | Yes | Authenticated — Write |
| 30 | `manifold_resolve_market` | POST | `/v0/market/{marketId}/resolve` | Yes | Authenticated — Write |
| 31 | `manifold_sell_shares` | POST | `/v0/market/{marketId}/sell` | Yes | Authenticated — Write |
| 32 | `manifold_close_market` | POST | `/v0/market/{marketId}/close` | Yes | Authenticated — Write |
| 33 | `manifold_add_liquidity` | POST | `/v0/market/{marketId}/add-liquidity` | Yes | Authenticated — Write |
| 34 | `manifold_add_answer` | POST | `/v0/market/{marketId}/answer` | Yes | Authenticated — Write |
| 35 | `manifold_market_group` | POST | `/v0/market/{marketId}/group` | Yes | Authenticated — Write |
| 36 | `manifold_rebalance` | POST | `/v0/market/{marketId}/rebalance` | Yes | Authenticated — Write |
| 37 | `manifold_add_bounty` | POST | `/v0/market/{marketId}/add-bounty` | Yes | Authenticated — Write |
| 38 | `manifold_award_bounty` | POST | `/v0/market/{marketId}/award-bounty` | Yes | Authenticated — Write |
| 39 | `manifold_send_mana` | POST | `/v0/managram` | Yes | Authenticated — Write |
| 40 | `manifold_create_comment` | POST | `/v0/comment` | Yes | Authenticated — Write |

**Totals**: 20 read-only tools (no auth), 5 authenticated read tools, 15 authenticated write tools = **40 tools**.
