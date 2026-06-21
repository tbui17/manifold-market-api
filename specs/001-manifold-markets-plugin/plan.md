# Implementation Plan: Manifold Markets API Plugin & MCP Server

**Branch**: `001-manifold-markets-plugin` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-manifold-markets-plugin/spec.md`

## Summary

Ship a Manifold Markets REST API integration as two artifacts sharing one thin HTTP client layer: (1) an OpenClaw tool plugin exposing ~30 public endpoints as individual `manifold_`-prefixed TypeBox-schema tools, and (2) a standalone stdio MCP server exposing an equivalent tool inventory. The shared client is endpoint-agnostic, performs zero response transformation, relies on upstream 401s for auth gating (no per-tool auth metadata), and wraps all errors in a uniform shape `{category, message, status?, body?}`. Read-only tools work without credentials; authenticated tools surface upstream 401s as `auth`-category errors.

## Technical Context

**Language/Version**: TypeScript 5.9+ (per constitution §Technology Stack; `devDependencies.typescript: ^5.9.0` already scaffolded)

**Primary Dependencies**:
- `typebox: ^1.1.38` (already scaffolded) — mandatory schema library for OpenClaw tool/config schemas (constitution Principle II)
- `openclaw` peer `>=2026.5.17` (scaffolded) — plugin SDK providing `defineToolPlugin` and `tool()` factory
- `@modelcontextprotocol/sdk` (to add) — standalone MCP server over stdio transport
- Node.js LTS runtime (constitution §Technology Stack: Target platform Node.js LTS)

**Storage**: N/A — stateless HTTP wrapper; no persistence layer. The integration holds no data between calls.

**Testing**: Vitest 3.x (`devDependencies.vitest: ^3.2.0` scaffolded; constitution §Technology Stack). Tests exercise all ~16 public read-only endpoints against the live API (full coverage, no sampling — per FR-020/SC-010 clarified in spec §Clarifications Q2) and clearly separate auth-required tests from public-read tests.

**Target Platform**: Node.js LTS, distributed as an npm package (`openclaw-plugin-manifold-markets`). OpenClaw plugin loaded via `openclaw plugins install npm:<package>`; MCP server run via `node dist/mcp-server.js` with `MANIFOLD_API_KEY` env var.

**Project Type**: Library — an npm package exporting two entry points: an OpenClaw tool plugin (`dist/index.js`) and a standalone MCP server (`dist/mcp-server.js`), both consuming a shared internal API client.

**Performance Goals**: Domain-specific — the integration is an HTTP passthrough; latency is dominated by the upstream Manifold API. No client-side throughput targets. The upstream rate limit is 500 requests/min/IP ( surfaced as `upstream`-category errors per FR-021; no client-side throttling per Assumptions).

**Constraints**:
- Constitution Principle II: TypeBox ONLY for schemas — no Zod, no raw JSON Schema objects.
- Constitution Principle III: thin wrapper, zero business logic — no aggregation, no derived state, no response mutation (FR-003 clarified to zero transformation in spec §Clarifications Q4).
- Constitution Principle V: shared client is platform-agnostic; platform entry points contain no business logic.
- FR-021: uniform error shape across all error categories.
- FR-006 clarified (spec §Clarifications Q3): rely on upstream 401; NO per-tool auth-required metadata or pre-check.
- API key transmitted only over HTTPS, never logged (FR-007, constitution §Security).
- Build gate: `npm run plugin:validate` must pass (constitution §Development Workflow).

**Scale/Scope**: ~30 tools (16 read-only GET + ~14 authenticated POST/authenticated-GET). Single shared client module. Two entry points. One test suite. ~500–1500 LOC estimated.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|---|---|---|
| I. API Fidelity — mirror `https://api.manifold.markets/v0/`, public endpoints only, `manifold_` prefix | PASS | FR-004 (public only), FR-005 (`manifold_` prefix), FR-003 (one endpoint per tool), base URL in FR-003 |
| II. TypeBox-Only Schemas — no Zod, no raw JSON Schema | PASS | FR-008 mandates TypeBox; constitution §Technology Stack pins `typebox: ^1.1.38`; plan uses TypeBox constructors throughout |
| III. Thin Wrapper, Zero Business Logic — no filtering/mutation except (now removed) formatting | PASS | FR-003 clarified to verbatim passthrough (spec §Clarifications Q4); shared client does no response walking |
| IV. Testable Contracts — tool names match manifest, schema validation, live-API tests, auth/public separation | PASS | FR-010 (manifest sync), FR-020 (live tests, all 16 read-only, auth/public separation), SC-004/SC-010 |
| V. Platform Parity — shared client platform-agnostic; entry points thin | PASS | FR-009 (shared client sole HTTP owner); `src/index.ts` and `src/mcp-server.ts` only wire client to transports |
| §Technology Stack — TS 5.9+, TypeBox 1.x, Vitest 3.x, openclaw SDK 2026.5.17+, MCP SDK, tsc build, npm | PASS | All matched in Technical Context above and existing `package.json` |
| §Security — HTTPS-only, keys never logged/committed, present-before-auth-call | PASS | FR-007 (HTTPS, never logged); FR-006 clarified to rely-on-upstream (constitution §Security line 85 says "validate key present before auth call" — **see Complexity Tracking below**) |
| §Development Workflow — plugin:validate + test gates, manifest sync | PASS | FR-010, SC-007; build/test commands already in `package.json` |

**Complexity Tracking — one constitution tension requiring justification**:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Constitution §Security line 85–87 ("plugin MUST validate that an API key is present before attempting any authenticated endpoint call") vs. spec FR-006 clarified (Q3: rely on upstream 401, no per-tool auth metadata) | The spec's rely-on-upstream decision was an explicit user clarification (Q3, 2026-06-20) with stated rationale: "small dev team cannot maintain per-tool auth-required metadata." Maintaining a per-tool auth-required flag table for ~30 endpoints is a maintenance burden the team declined. | Fail-fast pre-check was rejected because it requires maintaining auth-required metadata per tool that drifts when the upstream API changes; the team is small and the API is alpha-state. Rely-on-upstream keeps the client endpoint-agnostic (Principle V) and still satisfies the security *outcome* (no unauthenticated success on protected endpoints) via the upstream 401 surfaced as an `auth`-category error (FR-021). |

**Gate result**: PASS with one justified deviation documented above. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-manifold-markets-plugin/
├── plan.md              # This file
├── research.md          # Phase 0 — locked decisions log (no unknowns to research)
├── data-model.md        # Phase 1 — entity model from spec §Key Entities
├── quickstart.md        # Phase 1 — runnable validation guide
├── contracts/           # Phase 1 — tool interface contracts (the public API surface)
│   └── tools.md         # All ~30 manifold_ tools: name, endpoint, params, auth, description
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── api-client.ts        # Shared, platform-agnostic HTTP client (FR-009). Sole owner of:
│                        #   base URL, Authorization header, uniform error shape (FR-021),
│                        #   abort-signal propagation (FR-011), verbatim passthrough (FR-003).
│                        # Exports: manifoldGet(path, params?, apiKey?) , manifoldPost(path, body, apiKey?)
├── errors.ts            # Uniform error shape + category enum {upstream, auth, network, timeout, validation}
├── tools/
│   ├── markets.ts       # Read-only market tools (search, get-by-id, get-by-slug, list, prob, market-probs, positions)
│   ├── users.ts         # Read-only user tools (by-username, by-username/lite, by-id, by-id/lite, list, search)
│   ├── activity.ts      # Read-only bets + comments tools
│   ├── groups.ts        # Read-only group tools (list, by-slug, by-id)
│   ├── misc-read.ts     # Leagues + boost-history read tools
│   ├── authed-read.ts   # Authenticated read tools (me, portfolio, portfolio-history, contract-metrics, txns)
│   └── write.ts         # Authenticated POST tools (bet, multi-bet, cancel, create/resolve/sell/close/liquidity/
│                        #   answer/group/rebalance/bounty/award-bounty, managram, comment)
├── tool-builder.ts      # Helper that maps a tool spec (name, method, path, params schema, apiKey-source)
│                        #   to a TypeBox-schema tool via openclaw's tool() factory + api-client call.
│                        #   Keeps src/index.ts declarative.
├── index.ts             # OpenClaw plugin entry: defineToolPlugin with configSchema(apiKey) + tools array
│                        #   importing all tool modules. Thin wiring only (Principle V).
├── mcp-server.ts        # Standalone MCP server entry: stdio transport, MANIFOLD_API_KEY env var,
│                        #   tools/list + tools/call handlers delegating to the same tools. Thin wiring only.
└── index.test.ts        # Vitest: tool-name/manifest-sync tests, schema validation, live read-only coverage,
                         #   separated auth-required tests
```

**Structure Decision**: Single-project library layout. The shared client (`api-client.ts`, `errors.ts`) is the platform-agnostic core (Principle V). Tools are grouped by domain into modules under `src/tools/` for maintainability of ~30 tool definitions, each module exporting an array of tool specs consumed by the thin `index.ts` (OpenClaw) and `mcp-server.ts` (MCP) entry points. A `tool-builder.ts` helper centralizes the TypeBox-schema + api-client wiring so tool modules stay declarative. Tests remain in the scaffolded `src/index.test.ts` location (Vitest convention) plus the tool-name/manifest-sync assertions required by FR-010/FR-020.
