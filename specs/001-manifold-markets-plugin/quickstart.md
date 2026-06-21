# Quickstart & Validation Guide — Manifold Markets Plugin

**Purpose**: Runnable validation scenarios that prove the feature works end-to-end. This is NOT a test suite — it documents the manual and automated steps a developer runs after building to confirm correctness. Automated test details live in [spec.md](./spec.md) and implementation lives under `src/`.

**Also see**: [spec.md](./spec.md) (requirements), [plan.md](./plan.md) (architecture), [contracts/tools.md](./contracts/tools.md) (tool names & params), [data-model.md](./data-model.md) (entity shapes).

---

## Prerequisites

| Requirement | Needed for | Notes |
|---|---|---|
| Node.js LTS (v20+) | All scenarios | `node --version` to confirm |
| npm | All scenarios | Ships with Node |
| Manifold Markets account + API key | Authenticated scenarios only (4–5) | Obtain from profile → Edit Profile → API keys → Refresh API key. Read-only scenarios (1–3, 6, 8) need NO key. |
| OpenClaw CLI | Scenario 10 (plugin install validation) | `openclaw --version` to confirm |
| Any MCP-compatible client OR `echo` over stdio | Scenario 7 (MCP parity) | Claude Desktop, Cursor, or manual `printf`/pipe to `node dist/mcp-server.js` |

---

## Setup

```bash
# Install dependencies (includes typebox, vitest, openclaw peer, MCP SDK)
npm install

# Compile TypeScript
npm run build

# Build + validate manifest sync (FR-010 gate)
npm run plugin:validate

# Run all tests (live API — requires network)
npm test
```

> **Expected**: `npm run plugin:validate` exits 0 with a valid manifest. `npm test` exits 0 with all read-only tests passing against the live API. Auth tests are skipped when `MANIFOLD_API_KEY` is not set (FR-020/Q2).

---

## Validation Scenarios

### 1. Build & Manifest Sync

**What it proves**: The compiled plugin exports exactly the tools declared in the manifest — no drift, no missing entries. This is the FR-010/SC-004 gate.

**Action**:
```bash
npm run plugin:validate
```

**Expected outcome**:
- Command exits with code 0.
- OpenClaw's validate step confirms the `contracts.tools` array in `openclaw.plugin.json` matches the tool names exported by `dist/index.js`.
- Every tool name in the manifest is prefixed with `manifold_` (FR-005).

**FR/SC coverage**: FR-010, SC-004, FR-005.

---

### 2. Read-Only Market Discovery (No Key)

**What it proves**: A user with no Manifold account can search for markets, fetch one by ID, and read its probability — all without credentials. The responses are verbatim passthrough from the upstream API (FR-003).

**Action** (via OpenClaw tool calls or MCP client):
1. Call `manifold_search_markets` with `{ term: "AI" }`.
2. From the returned array, pick a market `id` and call `manifold_get_market` with `{ id: "<market-id>" }`.
3. Call `manifold_get_market_prob` with `{ id: "<market-id>" }`.

**Expected outcome**:
- Step 1 returns an array of `LiteMarket` objects matching the search term. Each has `id`, `slug`, `question`, `probability` (a 0–1 float), and other fields — identical to the upstream `GET /v0/search-markets?term=AI` response.
- Step 2 returns a `FullMarket` object (extends `LiteMarket` with `answers`, `description` fields) matching `GET /v0/market/<id>`.
- Step 3 returns `{ probability: <float 0-1> }` matching `GET /v0/market/<id>/prob`.
- No credentials were required. No errors surfaced.

**FR/SC coverage**: US1, FR-003 (verbatim passthrough), FR-006 (no key needed), SC-001, SC-003 (read-only without credentials).

---

### 3. Read-Only User/Activity (No Key)

**What it proves**: User profiles, bets, and comments are accessible without credentials — completing the read-only exploration surface (US2).

**Action** (no `MANIFOLD_API_KEY` set):
1. Call `manifold_get_user` with `{ username: "ManifoldMarkets" }` (the official account — always exists).
2. From the returned user `id`, call `manifold_get_bets` with `{ userId: "<user-id>" }`.
3. Pick a market `id` from the bets list and call `manifold_get_comments` with `{ contractId: "<market-id>" }`.

**Expected outcome**:
- Step 1 returns a `User` object with `username`, `displayName`, `bio`, `createdTime`, etc. — matching `GET /v0/user/ManifoldMarkets`.
- Step 2 returns an array of `Bet` objects with `contractId`, `userId`, `outcome`, `amount`, `shares`, etc. — matching `GET /v0/bets?userId=<id>`.
- Step 3 returns an array of comment objects — matching `GET /v0/comments?contractId=<id>`.
- All succeed without credentials.

**FR/SC coverage**: US2, FR-015 (user tools), FR-016 (activity tools), SC-003.

---

### 4. Authenticated Read (With Key)

**What it proves**: When a valid API key is provided, authenticated tools return the caller's own data (US3).

**Action**:
```bash
export MANIFOLD_API_KEY="your-key-here"
```
Then call `manifold_get_me` (no parameters needed).

**Expected outcome**:
- Returns a `User` object matching `GET /v0/me` with the authenticated user's own profile.
- The response contains `id`, `username`, `displayName`, `balance`, `totalProfit`, and other account fields — identical to the upstream response.
- The API key is never included in the response or logged (FR-007).

**FR/SC coverage**: US3, FR-007 (key handling), FR-019 (auth tools), SC-003 (correct results with valid key).

---

### 5. Missing-Key Error (Rely-on-Upstream)

**What it proves**: When an authenticated tool is called WITHOUT a key, the upstream 401 is surfaced as a uniform `auth`-category error — not swallowed, not silently empty (FR-006/Q3).

**Action** (ensure `MANIFOLD_API_KEY` is NOT set):
```bash
unset MANIFOLD_API_KEY
```
Call `manifold_get_me`.

**Expected outcome**:
- The tool returns/throws an error with this shape:
  ```json
  {
    "category": "auth",
    "message": "<human-readable description>",
    "status": 401,
    "body": "<upstream 401 response body>"
  }
  ```
- The request WAS sent to the upstream API (no pre-check blocked it) — the 401 came from Manifold, not from a client-side gate (FR-006, Q3 decision D3).
- No empty or partial success.

**FR/SC coverage**: FR-006 (rely-on-upstream), FR-021 (uniform error shape), SC-003, SC-008, edge case "same plugin loaded with no config."

---

### 6. Uniform Error Shape — Upstream 404

**What it proves**: Non-auth upstream errors surface the HTTP status and body in the same uniform error shape (FR-021/SC-008).

**Action**: Call `manifold_get_market` with `{ id: "nonexistent_id_xyz_999" }`.

**Expected outcome**:
- The tool returns/throws an error with this shape:
  ```json
  {
    "category": "upstream",
    "message": "<human-readable description of the 404>",
    "status": 404,
    "body": "<upstream 404 response body>"
  }
  ```
- Category is `"upstream"` (not `"auth"`) because the failure is a missing resource, not a credentials issue.
- The upstream HTTP status and response body are preserved verbatim in the error (FR-012).

**FR/SC coverage**: FR-012 (surface status + body), FR-021 (uniform error shape), SC-008, edge case "non-2xx response."

---

### 7. MCP Server Parity

**What it proves**: The standalone MCP server exposes the same tool inventory and produces equivalent responses as the OpenClaw plugin (US4/SC-005).

**Action**:
```bash
export MANIFOLD_API_KEY="your-key-here"
node dist/mcp-server.js
```
Then send MCP protocol messages over stdin:

1. Send `tools/list` request:
   ```json
   { "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
   ```
2. Call a read-only tool via `tools/call`:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 2,
     "method": "tools/call",
     "params": {
       "name": "manifold_search_markets",
       "arguments": { "term": "elections" }
     }
   }
   ```

**Expected outcome**:
- Step 1 returns a tool list where every tool name is prefixed with `manifold_` — the same inventory declared in the plugin manifest and exported by `dist/index.js`. The `manifold_` prefix appears on every entry (FR-005/FR-002).
- Step 2 returns a result with the same response shape as the OpenClaw plugin would produce — a `LiteMarket` array matching the upstream `GET /v0/search-markets?term=elections` response, passed through verbatim (FR-003).
- Both artifacts share the same `api-client.ts` (FR-009), so responses are identical by construction.

**FR/SC coverage**: US4, FR-002 (MCP server), FR-003 (verbatim passthrough), FR-009 (shared client), SC-005 (parité), FR-005 (prefix).

---

### 8. Full Read-Only Test Coverage

**What it proves**: The automated test suite exercises every read-only endpoint against the live API with zero failures, and auth tests are cleanly separated (FR-020/SC-010/Q2).

**Action**:
```bash
# Without API key — read-only tests run, auth tests skip
npm test

# With API key — read-only + auth tests all run
export MANIFOLD_API_KEY="your-key-here"
npm test
```

- Without key: all ~19 public read-only endpoint tests pass. Any auth-required tests are reported as skipped (not failed). Zero failures.
- With key: all tests pass, including authenticated read tests (`manifold_get_me`, `get_portfolio`, etc.). Zero failures.
- The test file (`src/index.test.ts`) contains separate describe blocks or conditionals that distinguish public-read tests from auth-required tests.

**FR/SC coverage**: FR-020 (live API coverage, no sampling), FR-010 (tool-name/manifest sync assertions), SC-010 (full coverage, auth separation), Q2 (clarified decision).

---

### 9. Upstream 401 on Authenticated Write Without Key

**What it proves**: Write tools also rely on upstream 401 — same behavior as auth-read tools, consistent across the surface (edge case from spec).

**Action** (no `MANIFOLD_API_KEY` set):
```bash
unset MANIFOLD_API_KEY
```
Call `manifold_get_transactions` (an authenticated read endpoint).

**Expected outcome**:
- Returns the same `auth`-category error as scenario 5:
  ```json
  {
    "category": "auth",
    "message": "<description>",
    "status": 401,
    "body": "<upstream body>"
  }
  ```
- The tool did NOT silently skip the call or return an empty array. It sent the unauthenticated request and surfaced the upstream rejection.

**FR/SC coverage**: FR-006 (rely-on-upstream for ALL auth tools), edge case "same plugin loaded with no config," SC-008.

---

### 10. OpenClaw Plugin Install Validation

**What it proves**: The plugin installs and loads correctly in OpenClaw, and tools appear in the runtime tool listing (FR-001/SC-004).

**Action** (when published to npm):
```bash
openclaw plugins install npm:openclaw-plugin-manifold-markets
openclaw plugins list
```

**Or for local development** (before publishing):
```bash
openclaw plugins install ./
openclaw plugins list
```

**Expected outcome**:
- `openclaw plugins list` shows `manifold-markets` (or `Manifold Markets`) as an installed and active plugin.
- The plugin's tools appear in OpenClaw's tool listings — all `manifold_`-prefixed names are available for LLM tool calls.
- The `configSchema` accepts an optional `apiKey` field (FR-007).
- No console errors or load failures.

**FR/SC coverage**: FR-001 (installable plugin), FR-007 (config schema), SC-004 (manifest matches exports), SC-002 (all ~30 endpoints exposed).

---

## Error Shape Reference

Every validation scenario above that triggers an error should produce this uniform shape (FR-021):

| Field | Type | Always present | Description |
|---|---|---|---|
| `category` | `"upstream" \| "auth" \| "network" \| "timeout" \| "validation"` | Yes | Error classification |
| `message` | `string` | Yes | Human-readable description |
| `status` | `number` | No | Upstream HTTP status code (when applicable) |
| `body` | `string` | No | Upstream response body (when applicable) |

See [contracts/tools.md](./contracts/tools.md) for the exact TypeBox schema of tool parameters. See [data-model.md](./data-model.md) for the expected response shapes that verbatim passthrough delivers.

---

## Notes

- **Verbatim passthrough (FR-003)**: All expected outcomes reference upstream API shapes directly. The integration performs zero transformation — no probability-to-percentage, no field renaming, no filtering. What the Manifold API returns is exactly what the tool caller receives.
- **Rate limits**: The upstream Manifold API enforces 500 requests/min/IP. Validation scenarios use a handful of calls and will not hit this limit. If you do, you will see a `category: "upstream"` error with status 429.
- **Network requirements**: All scenarios require internet access to `https://api.manifold.markets/v0/`. No local mocking or fixtures are used.
- **Auth separation (Q2)**: When running `npm test` without a key, auth-required tests are skipped, not failed. This is the clarified behavior per Q2 in the spec.
