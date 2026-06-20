# Manifold Markets OpenClaw Plugin — Handoff Document

> **Purpose**: This document gives a fresh agent session everything needed to continue building the Manifold Markets OpenClaw plugin and MCP server. It captures all research, decisions, technical constraints, and the implementation plan.

---

## 1. Project Goal

Build a **Manifold Markets API integration** that ships as:

1. **An OpenClaw tool plugin** (primary deliverable) — installable via `openclaw plugins install npm:<package>`
2. **A standalone MCP server** (secondary deliverable) — usable by any MCP-compatible client (Claude Desktop, Cursor, OpenClaw, etc.)

Both artifacts wrap the Manifold Markets REST API at `https://api.manifold.markets/v0/`.

The approach is to **have an LLM generate the tool definitions** from the Manifold API docs and their TypeScript schema, rather than building a codegen pipeline. The API has ~30 public endpoints — manageable for direct generation.

---

## 2. Repository State

The repo was scaffolded with `openclaw plugins init manifold-markets --name "Manifold Markets"`.

### Current structure

```
manifold-market-api/
├── openclaw.plugin.json    # Plugin manifest (currently has placeholder "echo" tool)
├── package.json            # npm package with OpenClaw metadata
├── tsconfig.json           # TypeScript config (ES2022, NodeNext)
├── README.md               # Minimal readme
└── src/
    ├── index.ts            # defineToolPlugin entry (has sample "echo" tool)
    └── index.test.ts       # Vitest test checking tool metadata
```

### Key scaffolded files

**`src/index.ts`** — entry point using `defineToolPlugin`:
```typescript
import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";

export default defineToolPlugin({
  id: "manifold-markets",
  name: "Manifold Markets",
  description: "Add Manifold Markets tools to OpenClaw.",
  tools: (tool) => [
    tool({
      name: "echo",
      description: "Echo input text.",
      parameters: Type.Object({
        input: Type.String({ description: "Text to echo." }),
      }),
      execute: async ({ input }) => ({ input }),
    }),
  ],
});
```

**`package.json`** — key fields:
- `name`: `openclaw-plugin-manifold-markets`
- `peerDependencies`: `openclaw: >=2026.5.17`
- `dependencies`: `typebox: ^1.1.38`
- `devDependencies`: `openclaw: latest`, `typescript: ^5.9.0`, `vitest: ^3.2.0`
- `scripts`: `build`, `plugin:build`, `plugin:validate`, `test`
- `openclaw.extensions`: `["./dist/index.js"]`

**`openclaw.plugin.json`** — manifest with placeholder:
```json
{
  "id": "manifold-markets",
  "name": "Manifold Markets",
  "contracts": { "tools": ["echo"] },
  "configSchema": { "type": "object", "additionalProperties": false, "properties": {} }
}
```

### What needs to change

The `echo` tool is a placeholder. It needs to be replaced with ~30 real Manifold Markets API tools. The manifest's `contracts.tools` array and `configSchema` need to be updated to list all real tool names and the API key config field.

---

## 3. Manifold Markets API — Complete Reference

### Base URL & Auth

| Field | Value |
|---|---|
| Base URL | `https://api.manifold.markets/v0/` |
| Legacy URL (deprecated) | `https://manifold.markets/api/v0/` — do not use |
| WebSocket | `wss://api.manifold.markets/ws` |
| Auth header | `Authorization: Key {apiKey}` |
| API key generation | User profile → edit → refresh API key button |
| Rate limit | 500 requests/min per IP |

### Source of truth

Manifold has **no published OpenAPI/Swagger spec**. The authoritative source is:

- **`common/src/api/schema.ts`** (4,420 lines) in the [manifoldmarkets/manifold](https://github.com/manifoldmarkets/manifold) GitHub repo
- Defines every endpoint with: HTTP method, Zod `props` schema, TypeScript `returns` type, `visibility` flag (`'public'` | `'undocumented'` | `'private'`), and `authed` boolean
- Exported `API` object maps endpoint path strings to their definitions

**Only expose `visibility: 'public'` endpoints in the plugin.**

### Public REST endpoints (~30)

#### Markets (core entity — called "contract" internally)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/v0/markets` | No | List markets (max 1000, paginated via `before`) |
| GET | `/v0/market/[marketId]` | No | Full market with answers |
| GET | `/v0/slug/[marketSlug]` | No | Full market by slug |
| GET | `/v0/search-markets` | No | Search/filter markets |
| GET | `/v0/market/[marketId]/prob` | No | Current probability (1s cache) |
| GET | `/v0/market-probs` | No | Batch probabilities (up to 100 IDs) |
| GET | `/v0/market/[marketId]/positions` | No | Positions/leaderboard |

#### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/v0/user/[username]` | No | Full user by username |
| GET | `/v0/user/[username]/lite` | No | Display info only |
| GET | `/v0/user/by-id/[id]` | No | Full user by ID |
| GET | `/v0/user/by-id/[id]/lite` | No | Display info by ID |
| GET | `/v0/me` | **Yes** | Authenticated user |
| GET | `/v0/users` | No | List users (max 1000) |
| GET | `/v0/get-user-portfolio` | **Yes** | Live portfolio metrics |
| GET | `/v0/get-user-portfolio-history` | **Yes** | Portfolio over time |
| GET | `/v0/get-user-contract-metrics-with-contracts` | **Yes** | User's positions + contracts |

#### Groups (topics)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/v0/groups` | No | List topics |
| GET | `/v0/group/[slug]` | No | Topic by slug |
| GET | `/v0/group/by-id/[id]` | No | Topic by ID |

#### Bets

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/v0/bets` | No | List bets (filter by userId, contractId, etc.) |

#### Comments

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/v0/comments` | No | List comments (by contract or user) |

#### Transactions

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/v0/txns` | **Yes** | List transactions |

#### Leagues

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/v0/leagues` | No | League standings |

#### Boosts

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/v0/get-boost-history` | No | Boost history |

#### Authenticated actions (POST endpoints)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/v0/bet` | **Yes** | Place bet or limit order |
| POST | `/v0/multi-bet` | **Yes** | Multi-choice bet across answers |
| POST | `/v0/bet/cancel/[id]` | **Yes** | Cancel limit order |
| POST | `/v0/market` | **Yes** | Create market (costs M$50-250) |
| POST | `/v0/market/[marketId]/resolve` | **Yes** | Resolve market |
| POST | `/v0/market/[marketId]/sell` | **Yes** | Sell shares |
| POST | `/v0/market/[marketId]/close` | **Yes** | Set close time |
| POST | `/v0/market/[marketId]/add-liquidity` | **Yes** | Add liquidity |
| POST | `/v0/market/[marketId]/answer` | **Yes** | Add answer to multi-choice |
| POST | `/v0/market/[marketId]/group` | **Yes** | Tag/untag topic |
| POST | `/v0/market/[marketId]/rebalance` | **Yes** | Rebalance position |
| POST | `/v0/market/[marketId]/add-bounty` | **Yes** | Add bounty |
| POST | `/v0/market/[marketId]/award-bounty` | **Yes** | Award bounty |
| POST | `/v0/comment` | **Yes** | Create comment (M$1 fee) |
| POST | `/v0/managram` | **Yes** | Send mana to user |

### Key types

- `LiteMarket` — market without bets/comments (returned by list endpoints)
- `FullMarket` extends `LiteMarket` — includes answers, description
- `User`, `DisplayUser` — user profiles
- `Bet` — bet with fills, limit order support
- `ContractMetric` — position data per user/market
- `PortfolioMetrics` / `LivePortfolioMetrics` — portfolio data
- Market types: BINARY, FREE_RESPONSE, MULTIPLE_CHOICE, NUMERIC, PSEUDO_NUMERIC, BOUNTIED_QUESTION, POLL
- Mechanisms: cpmm-1, cpmm-multi-1, dpm-2

### WebSocket

- Endpoint: `wss://api.manifold.markets/ws`
- Subscribe to global topics: `global/new-bet`, `global/new-contract`, `global/new-comment`, `global/new-subsidy`, `global/updated-contract`
- Per-contract topics: `contract/[marketId]`, `contract/[marketId]/new-bet`, etc.
- User topics: `user/[userId]`
- Requires periodic pings every 30-60s or connection dies
- **Out of scope for initial plugin** — consider for future enhancement

### API docs URLs

- Main docs: https://docs.manifold.markets/api
- Schema source: https://github.com/manifoldmarkets/manifold/blob/main/common/src/api/schema.ts
- Existing MCP server: https://github.com/manifoldmarkets/manifold/blob/main/backend/api/src/mcp.ts

### Caveats

- API is still in **alpha** — may change without notice
- Terminology: "question" = "contract" internally = "market" in API; "topic" = "group"
- Comments through API incur **M$1 transaction fee**
- Commercial data licensing required for AI/ML training
- Some endpoints are marked `deprecated` in docs

---

## 4. Existing MCP Server (Reference Implementation)

Manifold already ships a basic MCP server at `backend/api/src/mcp.ts` in their repo. This is **server-side** — it calls internal backend functions directly with Supabase access. It is NOT suitable for external use, but it's an excellent reference for:

- Tool naming conventions
- Parameter schemas (JSON Schema format)
- Response formatting patterns
- Error handling patterns

### Existing tools (5 read-only)

| Tool name | Description | Key parameters |
|---|---|---|
| `search-markets` | Search prediction markets with filters | `term` (required), `contractType`, `limit`, `offset`, `creatorId`, `sort` |
| `get-market` | Get detailed market info | `id` (required) |
| `get-user` | Get user info by username | `username` (required) |
| `get-bets` | Get bets with filtering | `id`, `userId`, `username`, `contractId`, `contractSlug`, `answerId`, `limit`, `before`, `after`, `beforeTime`, `afterTime`, `order`, `kinds`, `minAmount`, `filterRedemptions` |
| `search-users` | Search users by username/display name | `term` (required), `limit`, `page` |

### Response formatting pattern

The existing server uses a `chancifyUltraLiteMarket` helper that converts probabilities to human-readable strings:
```typescript
probability: market.probability
  ? `${Math.round(market.probability * 100)}% chance`
  : undefined
```

This is a nice touch for LLM consumption — consider adopting a similar pattern.

### Error handling pattern

```typescript
// Zod validation errors → MCP InvalidParams
if (error instanceof z.ZodError) {
  throw new McpError(
    ErrorCode.InvalidParams,
    `Invalid parameters: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
  )
}
```

---

## 5. OpenClaw Plugin SDK — Technical Constraints

### Schema format: TypeBox ONLY

The OpenClaw plugin SDK **requires TypeBox** for tool parameter schemas. Zod is NOT supported.

```typescript
import { Type } from "typebox";  // mandatory
```

TypeBox generates JSON Schema at runtime from its constructors. Common patterns:

```typescript
Type.String({ description: "Market ID" })
Type.Optional(Type.String({ description: "Search query" }))
Type.Number({ minimum: 1, maximum: 1000 })
Type.Union([Type.Literal("asc"), Type.Literal("desc")])
Type.Array(Type.String())
```

### Plugin entry point pattern

```typescript
import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";

export default defineToolPlugin({
  id: "manifold-markets",
  name: "Manifold Markets",
  description: "Query prediction markets, users, and bets on Manifold Markets",
  configSchema: Type.Object({
    apiKey: Type.Optional(Type.String({ description: "Manifold API key for authenticated endpoints" })),
  }),
  tools: (tool) => [
    tool({
      name: "manifold_search_markets",
      description: "Search prediction markets",
      parameters: Type.Object({
        term: Type.String({ description: "Search query" }),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 1000, description: "Max results (default 100)" })),
      }),
      execute: async (params, config, context) => {
        context.signal?.throwIfAborted();
        const headers: Record<string, string> = {};
        if (config.apiKey) headers["Authorization"] = `Key ${config.apiKey}`;
        const url = new URL("https://api.manifold.markets/v0/search-markets");
        // ... build query params, fetch, return JSON
      },
    }),
    // ... more tools
  ],
});
```

### Config schema

The `configSchema` field accepts a TypeBox schema. The second argument to `execute` is typed from it. Use this for the API key:

```typescript
configSchema: Type.Object({
  apiKey: Type.Optional(Type.String({ description: "Manifold Markets API key" })),
}),
```

### Tool naming convention

Use a `manifold_` prefix for all tool names to avoid collisions with other plugins. The manifest's `contracts.tools` array must list every tool name.

### Build process

```bash
npm run build           # tsc compiles TypeScript
npm run plugin:build    # builds + openclaw plugins build (generates openclaw.plugin.json)
npm run plugin:validate # builds + validates manifest consistency
npm test                # vitest runs tests
```

`openclaw plugins build` does **static analysis** of the compiled entry to generate the manifest. Tool names must be statically resolvable. The `tools: (tool) => [...]` callback returning a plain array works fine.

### Tool execute signature

```typescript
execute: async (params, config, context) => {
  context.signal?.throwIfAborted();  // abort signal for cancellation
  // params: typed from parameters schema
  // config: typed from configSchema
  // return value is auto-wrapped in MCP response format
  return someData;  // plain object, auto-wrapped
}
```

---

## 6. Standalone MCP Server (Secondary Deliverable)

The MCP server should be a separate entry point that can run independently via stdio transport.

### SDK

```bash
npm install @modelcontextprotocol/sdk
```

### Pattern

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ... } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "manifold-markets", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// Register tools via setRequestHandler
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...] }));
server.setRequestHandler(CallToolRequestSchema, async (request) => { /* handle */ });

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Auth

The MCP server reads the API key from an environment variable:
```bash
MANIFOLD_API_KEY=your-key-here node dist/mcp-server.js
```

---

## 7. Implementation Plan

### Phase 1: API Client Layer

Create `src/api-client.ts` — a thin typed wrapper around the Manifold REST API:

```typescript
const BASE_URL = "https://api.manifold.markets/v0";

export async function manifoldGet<T>(path: string, params?: Record<string, unknown>, apiKey?: string): Promise<T> {
  const url = new URL(`${BASE_URL}/${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Key ${apiKey}`;
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`Manifold API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function manifoldPost<T>(path: string, body: Record<string, unknown>, apiKey: string): Promise<T> {
  const url = new URL(`${BASE_URL}/${path}`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Authorization": `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Manifold API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
```

### Phase 2: OpenClaw Plugin Tools

Replace the `echo` tool in `src/index.ts` with real Manifold tools. Start with read-only GET endpoints (no auth required), then add authenticated endpoints.

**Suggested tool list** (prefix all with `manifold_`):

Read-only (no auth):
1. `manifold_search_markets` — GET /v0/search-markets
2. `manifold_get_market` — GET /v0/market/[id]
3. `manifold_get_market_by_slug` — GET /v0/slug/[slug]
4. `manifold_list_markets` — GET /v0/markets
5. `manifold_get_market_prob` — GET /v0/market/[id]/prob
6. `manifold_get_market_positions` — GET /v0/market/[id]/positions
7. `manifold_get_user` — GET /v0/user/[username]
8. `manifold_get_user_by_id` — GET /v0/user/by-id/[id]
9. `manifold_list_users` — GET /v0/users
10. `manifold_search_users` — GET /v0/search-users (not in existing MCP but exists)
11. `manifold_get_bets` — GET /v0/bets
12. `manifold_get_comments` — GET /v0/comments
13. `manifold_get_groups` — GET /v0/groups
14. `manifold_get_group` — GET /v0/group/[slug]
15. `manifold_get_leagues` — GET /v0/leagues
16. `manifold_get_boost_history` — GET /v0/get-boost-history

Authenticated (require API key):
17. `manifold_get_me` — GET /v0/me
18. `manifold_get_portfolio` — GET /v0/get-user-portfolio
19. `manifold_get_portfolio_history` — GET /v0/get-user-portfolio-history
20. `manifold_get_contract_metrics` — GET /v0/get-user-contract-metrics-with-contracts
21. `manifold_get_transactions` — GET /v0/txns
22. `manifold_place_bet` — POST /v0/bet
23. `manifold_place_multi_bet` — POST /v0/multi-bet
24. `manifold_cancel_bet` — POST /v0/bet/cancel/[id]
25. `manifold_create_market` — POST /v0/market
26. `manifold_resolve_market` — POST /v0/market/[id]/resolve
27. `manifold_sell_shares` — POST /v0/market/[id]/sell
28. `manifold_close_market` — POST /v0/market/[id]/close
29. `manifold_add_liquidity` — POST /v0/market/[id]/add-liquidity
30. `manifold_send_mana` — POST /v0/managram
31. `manifold_create_comment` — POST /v0/comment

### Phase 3: Standalone MCP Server

Create `src/mcp-server.ts` — a standalone MCP server that wraps the same API client. Can share the API client layer with the plugin.

### Phase 4: Tests

Update `src/index.test.ts` to verify:
- All expected tool names are declared
- Config schema includes `apiKey` field
- Each tool's parameter schema has the right required fields

### Phase 5: Build & Validate

```bash
npm install
npm run plugin:build
npm run plugin:validate
npm test
```

### Phase 6: Git & Publish Prep

```bash
git add -A
git commit -m "Implement Manifold Markets plugin with full API coverage"
```

For npm publishing (when ready):
- Remove `"private": true` from package.json
- Choose npm scope (e.g., `@manifoldmarkets/openclaw-manifold` or your org scope)
- `npm publish --access public`
- Optionally: `clawhub package publish org/manifold-markets`

---

## 8. Research Findings — Generator Tools (For Reference)

> The decision was made to use an LLM to generate the code directly rather than building a codegen pipeline. This section documents the tools that were evaluated, for future reference if the pipeline approach is ever needed.

### Zod → OpenAPI tools

| Tool | Stars | Key trait |
|---|---|---|
| `zod-openapi` (samchungy) | 628 | Uses Zod 4 `.meta()`, no monkey-patching, handles `z.lazy()` |
| `@asteasolutions/zod-to-openapi` | 1,590 | Highest adoption, Registry pattern, monkey-patches Zod |
| `zod-to-json-schema` | 1,252 | 45M downloads, schemas only (no paths) |

### TypeScript → MCP generators

| Tool | Approach | Fit |
|---|---|---|
| Custom codegen (~50 lines) | Import Zod → emit `registerTool()` | Best if using Zod directly |
| `trpc-to-mcp` v1.3.2 | tRPC v11 procedures → MCP tools | Requires adopting tRPC |
| `mcp-generator` v1.0.9 | Scans TS via ts-morph → JSON manifest | Early stage, needs manual wiring |

### OpenAPI → MCP tools

| Tool | Approach |
|---|---|
| `@sgaluza/api-to-mcp` | Runtime bridge — point at spec, zero codegen |
| `openapi-mcp-generator` v4.0.1 | Generates full TS server project from spec |
| `opamcp` | `npx opamcp <spec-url>` — simplest |

### OpenClaw plugin generators

**None exist.** No official or widely-adopted third-party tool generates OpenClaw plugin schemas from Zod, OpenAPI, or any other source. The `openclaw plugins init` CLI scaffolds a starter project but does not generate tools from external specs.

---

## 9. Key Decisions Log

| Decision | Rationale | Date |
|---|---|---|
| Use LLM to generate code, not codegen pipeline | 30 endpoints is manageable; API is alpha and changes would break any pipeline; avoids Zod→TypeBox conversion complexity | 2026-06-20 |
| Ship both OpenClaw plugin and standalone MCP server | Plugin for OpenClaw users, MCP server for broader ecosystem (Claude Desktop, Cursor, etc.) | 2026-06-20 |
| Use TypeBox (not Zod) for plugin schemas | OpenClaw SDK requires TypeBox; no Zod support | 2026-06-20 |
| Distribute as npm package | OpenClaw plugins are just npm packages with `openclaw.plugin.json` manifest; `openclaw plugins install npm:<pkg>` | 2026-06-20 |
| Prefix tool names with `manifold_` | Avoid collisions with other plugins | 2026-06-20 |
| Start with read-only tools, then add authenticated ones | GET endpoints are safe and useful immediately; POST endpoints (betting, market creation) need careful testing | 2026-06-20 |
| WebSocket support deferred to future | Adds complexity; initial release focuses on REST tools | 2026-06-20 |

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---| 
| API is alpha — breaking changes | Pin to current API behavior; document that plugin may need updates |
| Rate limit 500 req/min | Add rate limiting awareness in tool descriptions; don't batch aggressively |
| POST endpoints can spend real money (M$) | Require API key for all POST tools; add warnings in tool descriptions |
| Comments incur M$1 fee | Document in `manifold_create_comment` tool description |
| TypeBox version compatibility | Keep `typebox: ^1.1.38` as scaffolded |
| OpenClaw CalVer moves fast | Pin `peerDependencies.openclaw: >=2026.5.17` as scaffolded |

---

## 11. Useful References

- Manifold API docs: https://docs.manifold.markets/api
- Manifold schema.ts: https://github.com/manifoldmarkets/manifold/blob/main/common/src/api/schema.ts
- Manifold existing MCP server: https://github.com/manifoldmarkets/manifold/blob/main/backend/api/src/mcp.ts
- OpenClaw tool plugins docs: https://docs.openclaw.ai/plugins/tool-plugins
- OpenClaw CLI plugins reference: https://docs.openclaw.ai/cli/plugins
- OpenClaw plugin manifest docs: https://docs.openclaw.ai/plugins/manifest
- MCP SDK (TypeScript): https://github.com/modelcontextprotocol/typescript-sdk
- TypeBox: https://github.com/sinclairzx/typebox

---

## 12. Quick Start for Fresh Agent

1. Read this document fully
2. Read the scaffolded `src/index.ts` to see the current starting point
3. Read the Manifold API docs at https://docs.manifold.markets/api for endpoint details
4. Reference the existing MCP server at https://github.com/manifoldmarkets/manifold/blob/main/backend/api/src/mcp.ts for patterns
5. Create `src/api-client.ts` (Phase 1)
6. Replace the `echo` tool in `src/index.ts` with real Manifold tools (Phase 2)
7. Create `src/mcp-server.ts` (Phase 3)
8. Update tests (Phase 4)
9. Run `npm install && npm run plugin:build && npm run plugin:validate && npm test`
10. Commit and push

**Do not** attempt to build a Zod→OpenAPI→MCP codegen pipeline. The decision is to generate the code directly via LLM.
