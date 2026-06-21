<!---
Package card: https://www.npmjs.com/package/openclaw-plugin-manifold-markets
-->

# Manifold Markets

[![npm version](https://img.shields.io/npm/v/openclaw-plugin-manifold-markets.svg)](https://www.npmjs.com/package/openclaw-plugin-manifold-markets)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

OpenClaw tool plugin + standalone MCP server for [Manifold Markets](https://manifold.markets), wrapping the public REST API at `https://api.manifold.markets/v0`.

This package exposes 40 `manifold_`-prefixed tools with TypeBox schemas, a shared platform-agnostic HTTP client, and a uniform error shape. Responses pass through verbatim — no mutation, no client-side formatting, no per-tool auth gating beyond what the upstream API enforces.

## Table of contents

- [Features](#features)
- [Install for OpenClaw](#install-for-openclaw)
- [Use as an MCP server](#use-as-an-mcp-server)
- [Tool inventory](#tool-inventory)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Architecture](#architecture)
- [License](#license)

## Features

- **OpenClaw plugin** — install from npm, configure your API key, call tools by name
- **Standalone MCP server** — runs over stdio for any MCP-compatible client
- **40 tools** covering markets, users, groups, bets, comments, leagues, boosts, authenticated reads, and write actions
- **TypeBox schemas** required by the OpenClaw SDK
- **Shared, platform-agnostic HTTP client** used by both the plugin and the MCP server
- **Uniform error shape** for upstream, auth, network, timeout, and validation errors
- **No response mutation** — upstream JSON passes through verbatim

## Install for OpenClaw

### 1. Install the plugin

From any shell with the `openclaw` CLI:

```bash
openclaw plugins install npm:openclaw-plugin-manifold-markets@0.2.0
```

Omit `@0.2.0` to use the latest published version. Pinning the version is recommended for reproducible setups.

### 2. Configure your API key

Get your key from your [Manifold profile](https://manifold.markets) → edit → refresh API key.

The plugin config schema accepts one field:

```json
{
  "apiKey": "<your-manifold-api-key>"
}
```

Plugin config lives at `plugins.entries.<id>.config` in `openclaw.json` (run `openclaw config file` to see the file path for your setup). The plugin ID is `manifold-markets`.

Set the key with the OpenClaw CLI:

```bash
openclaw config set plugins.entries.manifold-markets.config.apiKey "<your-manifold-api-key>"
```

For a hardened setup, use a SecretRef pointing at an env var instead of a literal value:

```bash
openclaw config set plugins.entries.manifold-markets.config.apiKey \
  --ref-provider default --ref-source env --ref-id MANIFOLD_API_KEY
```

Equivalently, edit `openclaw.json` directly:

```json
{
  "plugins": {
    "entries": {
      "manifold-markets": {
        "enabled": true,
        "config": { "apiKey": "<your-manifold-api-key>" }
      }
    }
  }
}
```

With no key, only the **public read tools** work. Authenticated read tools and all write tools return an `auth`-category 401 error.

### 3. Verify the install

List installed tools:

```bash
openclaw plugins list
```

Smoke-test a read-only tool:

```bash
openclaw tools call manifold_search_markets '{"term": "AI", "limit": 3}'
```

If you configured an API key, test an authenticated tool:

```bash
openclaw tools call manifold_get_me '{}'
```

## Use as an MCP server

Build and run the stdio server with your API key:

```bash
npm install
npm run build
MANIFOLD_API_KEY=your-key npm run mcp:start
```

The server exposes the same 40 tools over stdio. Point any MCP client at `node path/to/dist/mcp-server.js`.

For example, in Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "manifold-markets": {
      "command": "node",
      "args": [
        "/path/to/node_modules/openclaw-plugin-manifold-markets/dist/mcp-server.js"
      ],
      "env": {
        "MANIFOLD_API_KEY": "your-key"
      }
    }
  }
}
```

## Tool inventory

All tools are prefixed with `manifold_` to avoid collisions with other plugins.

### Public read tools (no API key required)

- `manifold_search_markets` — search markets by term
- `manifold_get_market` — get a market by ID
- `manifold_get_market_by_slug` — get a market by slug
- `manifold_list_markets` — list markets
- `manifold_get_market_prob` — get probability(ies) for a market
- `manifold_get_market_probs` — batch-fetch probabilities by market IDs
- `manifold_get_market_positions` — get market positions/leaderboard
- `manifold_get_user` — get user by username
- `manifold_get_user_lite` — get lite user by username
- `manifold_get_user_by_id` — get user by ID
- `manifold_get_user_by_id_lite` — get lite user by ID
- `manifold_list_users` — list users
- `manifold_search_users` — search users *(intentionally excluded from test suite; `list_users` preferred)*
- `manifold_get_bets` — list bets
- `manifold_get_comments` — get comments on a market
- `manifold_get_groups` — list groups
- `manifold_get_group` — get group by slug
- `manifold_get_group_by_id` — get group by ID
- `manifold_get_leagues` — get league cohorts
- `manifold_get_boost_history` — get boost history

### Authenticated read tools (API key required)

- `manifold_get_me` — current user
- `manifold_get_portfolio` — portfolio metrics
- `manifold_get_portfolio_history` — portfolio history over time
- `manifold_get_contract_metrics` — per-user per-market metrics
- `manifold_get_transactions` — transaction history for the authenticated user

### Write tools (API key required)

- `manifold_place_bet` — place a bet
- `manifold_place_multi_bet` — place a multi-answer bet
- `manifold_cancel_bet` — cancel a limit bet
- `manifold_create_market` — create a market
- `manifold_resolve_market` — resolve a market
- `manifold_sell_shares` — sell shares
- `manifold_close_market` — update market close time
- `manifold_add_liquidity` — add liquidity
- `manifold_add_answer` — add an answer to a multi-choice market
- `manifold_market_group` — add/remove a market from a group
- `manifold_rebalance` — rebalance a multi-choice position
- `manifold_add_bounty` — add a bounty
- `manifold_award_bounty` — award a bounty
- `manifold_send_mana` — send mana to another user
- `manifold_create_comment` — create a comment

## Configuration

The plugin accepts a single optional `apiKey`:

```json
{
  "apiKey": "string"
}
```

If you call an authenticated tool without a key, the upstream API returns a 401, which is surfaced as an `auth`-category error. The plugin never logs or exposes the key beyond sending it in the `Authorization: Key <apiKey>` header over HTTPS.

## Development

```bash
npm install
npm run build          # compile TypeScript to dist/
npm test               # run the live-API Vitest suite
npm run plugin:validate # manifest sync + validation
```

### Repository layout

```
src/
  api-client.ts      # Shared HTTP client
  errors.ts          # Uniform ManifoldError shape
  index.ts           # OpenClaw plugin entry
  mcp-server.ts      # Standalone MCP server entry
  tool-builder.ts    # makeGetTool / makePostTool helpers
  tools/             # Tool definitions by domain
  index.test.ts      # Vitest live-API suite
specs/               # Speckit spec, checklists, and planning docs
scripts/             # Development helpers (e.g. create-test-market.ts)
openclaw.plugin.json # OpenClaw plugin manifest
```

## Testing

`npm test` exercises most tools against the live Manifold API.

| Environment | Result |
|---|---|
| No `MANIFOLD_API_KEY` | 43 tests pass, 14 skipped (auth + opt-in write tests) |
| `MANIFOLD_API_KEY` set | 48 tests pass, 9 skipped (opt-in write tests only) |
| `MANIFOLD_API_KEY` + `MANIFOLD_RUN_WRITE_TESTS=1` | All 57 tests run live against the API |

### Opt-in write tests

Write tests are disabled by default because they spend mana. To run them with a single API key:

```bash
export MANIFOLD_API_KEY=your-key
export MANIFOLD_RUN_WRITE_TESTS=1
npm test
```

Default write-test cost is ~M$3 (place bet, comment, add liquidity, then recover via sell_shares). `cancel_bet`, `market_group`, and `close_market` are net-zero.

`manifold_send_mana` requires a second API key (`MANIFOLD_API_KEY2`) and costs M$10. If the key is absent, the test skips cleanly.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `auth`-category 401 error | Missing or invalid key | Add `apiKey` to the plugin config |
| `upstream`-category 404 | Unknown market/user/group ID | Check the ID/slug |
| `MANIFOLD_API_KEY not set` during `npm publish` | Auth test guard | Fixed as of v0.2.0 — publish now works without the key |
| Tests show 9 skipped | `MANIFOLD_RUN_WRITE_TESTS` not set | Set it to run opt-in live write tests |
| MCP client shows no tools | Server didn't start or wasn't registered | Verify `npm run build` and the path in your MCP config |

## Architecture

- **Thin wrapper**: the plugin performs zero response transformation. Every tool returns the exact JSON the upstream API returns.
- **Shared client**: `api-client.ts` is the only module that knows about HTTP, headers, base URL, and error wrapping. Both the OpenClaw plugin and MCP server use it.
- **Rely-on-upstream auth**: there is no per-tool auth-required metadata. The plugin sends requests with whatever key is configured (including none) and lets the upstream 401/403 surface as an `auth` or `upstream` error.
- **Uniform errors**: every failure is wrapped in `ManifoldError` with `{ category: "upstream"\|"auth"\|"network"\|"timeout"\|"validation", message, status?, body? }`.

## License

MIT — see [LICENSE](LICENSE).
